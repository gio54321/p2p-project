import {
    defaultEvmStores,
    selectedAccount,
    web3
} from 'svelte-web3';
import { derived, get, writable, type Writable } from 'svelte/store';
import { toast } from '@zerodevx/svelte-toast'
import BattleshipContract from '$lib/contracts/Battleship.json';
import { computeMerkleRoot, generateBoardValue, generateCommitment } from './merkleProofs';
import { browser } from '$app/environment';

export let boardSize = 8;

export const allowedShips = [
    {
        'length': 2,
        'name': 'Destroyer'
    },
    {
        'length': 3,
        'name': 'Submarine'
    },
    {
        'length': 3,
        'name': 'Cruiser'
    },
    {
        'length': 4,
        'name': 'Battleship'
    },
    {
        'length': 5,
        'name': 'Carrier'
    }
];


export type BoardValues = number[];

export type Ship = {
    pos: number,
    isHorizontal: number,
};

function createShips() {
    let initialShips = Array(allowedShips.length).fill(null);
    const { subscribe, update } = writable<(Ship | null)[]>(initialShips);

    return {
        subscribe,
        setShip: (id: number, pos: number, isHorizontal: number) => {
            if (id < 0 || id >= allowedShips.length) {
                return;
            }

            update((arr) => {
                arr[id] = { 'pos': pos, 'isHorizontal': isHorizontal };
                return arr;
            });
        },
        removeShip: (id: number) => {
            if (id < 0 || id >= allowedShips.length) {
                return;
            }

            update((arr) => {
                arr[id] = null;
                return arr;
            });
        },
        toJSON: () => {
            return JSON.stringify(get(boardShips));
        },
        fromJSON: (json: string) => {
            let ships = JSON.parse(json);
            if (ships.length !== allowedShips.length) {
                return;
            }
            update((arr) => {
                return ships;
            });
        },
    };
}

export const boardShips = createShips();

export const boardValues = derived(boardShips, (ships) => {
    let board: (0 | 1)[] = [];
    for (let i = 0; i < boardSize * boardSize; i++) {
        board.push(0);
    }

    for (let i in ships) {
        let ship = ships[i];
        if (ship !== null) {
            for (let j = 0; j < allowedShips[i].length; j++) {
                board[ship.pos + j * (1 + ship.isHorizontal * 7)] = 1;
            }
        }
    }
    return board;
});

export const connected = derived(selectedAccount, ($a) => $a !== undefined);


// saved in local storage
export const currentGameId: Writable<null | number> = writable(null);
export const boardValuesNonces: Writable<string[]> = writable([]);

export function loadGameFromLocalStorage() {
    let utils = get(web3).utils;
    console.log(utils);
    let currentGameIdString = localStorage.getItem("currentGameId");
    console.log(currentGameIdString);
    if (currentGameIdString !== "null" && currentGameIdString !== null) {
        currentGameId.set(utils.toBigInt(currentGameIdString));
    } else {
        currentGameId.set(null);
    }
    let boardValuesNoncesString = localStorage.getItem("boardValuesNonces");
    if (boardValuesNoncesString !== null) {
        boardValuesNonces.set(JSON.parse(boardValuesNoncesString));
    }
    let boardShipsString = localStorage.getItem("boardShips");
    if (boardShipsString !== null) {
        boardShips.fromJSON(boardShipsString);
    }
}

export function saveGameToLocalStorage() {
    let currentGameIdValue = get(currentGameId);
    if (currentGameIdValue !== null) {
        localStorage.setItem("currentGameId", currentGameIdValue.toString());
    } else {
        localStorage.setItem("currentGameId", "null");
    }
    let boardValuesNoncesValue = JSON.stringify(get(boardValuesNonces));
    localStorage.setItem("boardValuesNonces", boardValuesNoncesValue);
    let boardShipsValue = boardShips.toJSON();
    localStorage.setItem("boardShips", boardShipsValue);
}

export function connectProvider() {
    defaultEvmStores.setProvider();
    toast.push("Successfully connected account");
}
export function disconnectProvider() {
    defaultEvmStores.disconnect();
    toast.push("Account disconnected");
}

export let battleshipInstance = derived(connected, (connected) => {
    if (connected) {
        let web3Instance = get(web3);
        let address = BattleshipContract.networks["5777"].address;
        return new web3Instance.eth.Contract(BattleshipContract.abi, address);
    } else {
        return null;
    }
});

export async function createGame(): Promise<null | number> {
    if (!get(connected)) {
        return null;
    }
    let battleship = get(battleshipInstance);

    let creationTx = await battleship.methods.createGame().send({ from: get(selectedAccount) });
    let events = await battleship.getPastEvents('GameCreated', {
        fromBlock: creationTx.blockNumber,
    });
    for (let e of events) {
        // We convert to lowercase the addresses because
        // addresses may have uppercase letters for checksum purposes
        // @ts-ignore
        if (e.returnValues.owner.toLowerCase() === get(selectedAccount).toLowerCase()) {
            return events[0].returnValues.id;
        }
    }
    return null;
}

export async function joinGameById(id: any): Promise<any> {
    if (!get(connected)) {
        return null;
    }
    let battleship = get(battleshipInstance);
    let joinTx = await battleship.methods.joinGameById(id).send({ from: get(selectedAccount) });
    let events = await battleship.getPastEvents('GameReady', {
        fromBlock: joinTx.blockNumber,
    });
    for (let e of events) {
        if (e.returnValues.id === id) {
            return events[0].returnValues.id;
        }
    }
    return null;
}

export async function getCreatedGames(): Promise<any[]> {
    if (!get(connected)) {
        return [];
    }
    let battleship = get(battleshipInstance);
    let ids = await battleship.methods.getCreatedGamesIds().call();
    let owners = await battleship.methods.getCreatedGamesOwners().call();
    let result = []
    for (let i in ids) {
        result.push({ 'id': ids[i], "owner": owners[i] });
    }
    result.sort((a, b) => a.id > b.id ? 1 : -1);
    return result;
}

export async function commitBoard(commitAmount: any): Promise<any> {
    if (!get(connected)) {
        return null;
    }
    let battleship = get(battleshipInstance);
    let gameId = get(currentGameId);
    let nonces = get(boardValues).map((v: 0 | 1) => generateBoardValue(v));
    boardValuesNonces.set(nonces);
    let commitments = nonces.map((nonce) => generateCommitment(nonce));
    let root = computeMerkleRoot(commitments);
    console.log(root);
    console.log(commitAmount);
    console.log(gameId);
    let commitTx = await battleship.methods.commitBoard(gameId, root).send({ from: get(selectedAccount), value: commitAmount });
    return commitTx;
}

export async function getGameState(): Promise<any> {
    if (!get(connected)) {
        return null;
    }
    let battleship = get(battleshipInstance);
    let gameId = get(currentGameId);
    let gameState = await battleship.methods.getGameState(gameId).call();
    return gameState;
}
