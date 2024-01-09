import {
    defaultEvmStores,
    selectedAccount,
    web3,
    connected as connected_web3,
} from 'svelte-web3';
import { derived, get, writable, type Readable, type Writable } from 'svelte/store';
import { toast } from '@zerodevx/svelte-toast'
import BattleshipContract from '$lib/contracts/Battleship.json';
import { computeMerkleProof, computeMerkleRoot, generateBoardValue, generateCommitment } from './merkleProofs';

// the board size of the game
export let boardSize = writable(4);

const allowedShipsMap = {
    // 8x8 board
    8: [{
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
    }],
    // 4x4 board
    4: [{
        'length': 2,
        'name': 'Destroyer'
    },
    {
        'length': 2,
        'name': 'Submarine'
    },
    {
        'length': 3,
        'name': 'Cruiser'
    }]
};

// allowed ships, reactive with the current board size
export const allowedShips = derived(boardSize, (size) => {
    // @ts-ignore
    return allowedShipsMap[size];
});


export type BoardValues = number[];

export type Ship = {
    pos: number,
    isHorizontal: number,
};

export enum GameStateEnum {
    WaitingForPlayer,
    WaitingForCommit,
    Guessing,
    Revealing,
    WaitingGuessing,
    WaitingRevealing,
    BoardReveal,
    WaitingWinningClaim,
    Finished,
}

export let gameState = writable(GameStateEnum.WaitingForPlayer);

// returns a user-friendly description of the game state
export function getGameStateString(state: GameStateEnum): string {
    switch (state) {
        case GameStateEnum.WaitingForPlayer:
            return "Waiting for player";
        case GameStateEnum.WaitingForCommit:
            return "Waiting for commitment";
        case GameStateEnum.Guessing:
            return "Guess a cell";
        case GameStateEnum.Revealing:
            return "You need to reveal a cell";
        case GameStateEnum.WaitingGuessing:
            return "Waiting for other player to guess";
        case GameStateEnum.WaitingRevealing:
            return "Waiting for other player to reveal the cell";
        case GameStateEnum.BoardReveal:
            return "Game finished, you need to reveal the board";
        case GameStateEnum.WaitingWinningClaim:
            return "Waiting for the winner to claim the winnings";
        case GameStateEnum.Finished:
            return "Finished";
    }
}


// call the contract to get the current game phase
export async function getGamePhase(): Promise<any> {
    if (!get(connected)) {
        return null;
    }
    let battleship = get(battleshipInstance);
    let gameId = get(currentGameId);
    if (gameId === null) {
        return null;
    }
    let gameState = await battleship.methods.getGamePhase(gameId).call();
    return gameState;
}

// call the contract to get the current player number
// that is playing the game
async function getPlayerNumber(): Promise<any> {
    if (!get(connected)) {
        return null;
    }
    let battleship = get(battleshipInstance);
    let gameId = get(currentGameId);
    if (gameId === null) {
        return null;
    }
    let address = get(selectedAccount);
    let playerNumber = await battleship.methods.getPlayerGameNumber(gameId, address).call();
    return playerNumber;
}

// call the contract to get the winner of the current game
async function getWinner(): Promise<any> {
    if (!get(connected)) {
        return null;
    }
    let battleship = get(battleshipInstance);
    let gameId = get(currentGameId);
    if (gameId === null) {
        return null;
    }
    let winner = await battleship.methods.getWinner(gameId).call();
    return winner;
}

// refresh the game state, called when the game phase changed event is received
// updates the gameState store, as well as the gameWinner store
export async function refreshGameState() {
    let gamePhase = await getGamePhase();
    console.log(gamePhase);

    let playerNumber = await getPlayerNumber();

    let myPlayerNumber = playerNumber.toString();
    let otherPlayerNumber = myPlayerNumber === "1" ? "2" : "1";

    if (gamePhase === `CREATED`) {
        gameState.set(GameStateEnum.WaitingForPlayer);
    } else if (gamePhase === `WAITING_COMMITMENT`) {
        gameState.set(GameStateEnum.WaitingForCommit);
    } else if (gamePhase === `WAITING_PLAYER_${myPlayerNumber}_GUESS`) {
        gameState.set(GameStateEnum.Guessing);
    } else if (gamePhase === `WAITING_PLAYER_${otherPlayerNumber}_GUESS`) {
        gameState.set(GameStateEnum.WaitingGuessing);
    } else if (gamePhase === `WAITING_PLAYER_${myPlayerNumber}_VALUE`) {
        gameState.set(GameStateEnum.Revealing);
    } else if (gamePhase === `WAITING_PLAYER_${otherPlayerNumber}_VALUE`) {
        gameState.set(GameStateEnum.WaitingRevealing);
    } else if (gamePhase === `WAITING_BOARD_REVEAL`) {
        gameState.set(GameStateEnum.BoardReveal);
    } else if (gamePhase === `WAITING_WINNINGS_CLAIM`) {
        gameState.set(GameStateEnum.WaitingWinningClaim);
    } else if (gamePhase === `FINISHED`) {
        gameState.set(GameStateEnum.Finished);
    }

    let winner = await getWinner();
    if (winner.toString() !== "0") {
        gameWinner.set(winner.toString() === myPlayerNumber);
    } else {
        gameWinner.set(null);
    }
}

// create a ships custom store, that exposes some useful methds for interacting with the ships
function createShips() {
    let initialShips = Array(get(allowedShips).length).fill(null);
    const { subscribe, update } = writable<(Ship | null)[]>(initialShips);

    return {
        subscribe,
        setShip: (id: number, pos: number, isHorizontal: number) => {
            // set a ship at the given position

            if (id < 0 || id >= get(allowedShips).length) {
                return;
            }

            update((arr) => {
                arr[id] = { 'pos': pos, 'isHorizontal': isHorizontal };
                return arr;
            });
        },
        removeShip: (id: number) => {
            // remove a ship from its id

            if (id < 0 || id >= get(allowedShips).length) {
                return;
            }

            update((arr) => {
                arr[id] = null;
                return arr;
            });
        },
        isValid: () => {
            let shipNumber = get(boardShips).filter((s) => s !== null).length;
            return shipNumber === get(allowedShips).length;
        },
        toJSON: () => {
            return JSON.stringify(get(boardShips));
        },
        fromJSON: (json: string) => {
            let ships = JSON.parse(json);
            if (ships.length !== get(allowedShips).length) {
                return;
            }
            update((arr) => {
                return ships;
            });
        },
        clear: () => {
            update((arr) => {
                return Array(get(allowedShips).length).fill(null);
            });
        },
        toContractStructs: () => {
            // returns the ships in the format expected by the contract
            // for a boardReveal call

            let ships = get(boardShips);
            let result = [];
            for (let i in ships) {
                let ship = ships[i];
                if (ship === null) {
                    return null;
                }
                let x = ship.pos % get(boardSize);
                let y = Math.floor(ship.pos / get(boardSize));
                let length = get(allowedShips)[i].length;
                let direction = ship.isHorizontal;
                result.push({
                    'x': x,
                    'y': y,
                    'length': length,
                    'direction': direction === 0
                });
            }
            // sort resut by length descending
            result.sort((a, b) => a.length < b.length ? 1 : -1);
            return result;
        },
    };
}

export const boardShips = createShips();

// derived store that computes the actual cell values from the ships representation
export const boardValues = derived(boardShips, (ships) => {
    let board: (0 | 1)[] = [];
    let size = get(boardSize);
    for (let i = 0; i < size * size; i++) {
        board.push(0);
    }

    for (let i in ships) {
        let ship = ships[i];
        if (ship !== null) {
            for (let j = 0; j < get(allowedShips)[i].length; j++) {
                board[ship.pos + j * (1 + ship.isHorizontal * (get(boardSize) - 1))] = 1;
            }
        }
    }
    return board;
});

export const connected = connected_web3;

// game state variales that are saved in local storage
export const currentGameId: Writable<null | number> = writable(null);
export const boardValuesNonces: Writable<string[]> = writable([]);
export const opponentBoardValues: Writable<(0 | 1 | null)[]> = writable([]);
export const boardValuesRevealed: Writable<boolean[]> = writable([]);
export const createdGames: Writable<any[]> = writable([]);
export const gameReady: Writable<boolean> = writable(false);
export const gameStarted: Writable<boolean> = writable(false);

// 0 is no accusation, 1 current player is accused, -1 current player is accuser
export const currentAccusation: Writable<number> = writable(0);

// null if no winner yet, true if the player won, false if the player lost
export const gameWinner: Writable<null | boolean> = writable(null);

// load all the game state from local storage
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
    let opponentBoardValuesString = localStorage.getItem("opponentBoardValues");
    if (opponentBoardValuesString !== null) {
        opponentBoardValues.set(JSON.parse(opponentBoardValuesString));
    }
    let boardValuesRevealedString = localStorage.getItem("boardValuesRevealed");
    if (boardValuesRevealedString !== null) {
        boardValuesRevealed.set(JSON.parse(boardValuesRevealedString));
    }
    let boardSizeString = localStorage.getItem("boardSize");
    if (boardSizeString !== null) {
        boardSize.set(parseInt(boardSizeString));
    }
}

// save all the game state to local storage
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
    let opponentBoardValuesValue = JSON.stringify(get(opponentBoardValues));
    localStorage.setItem("opponentBoardValues", opponentBoardValuesValue);
    let boardValuesRevealedValue = JSON.stringify(get(boardValuesRevealed));
    localStorage.setItem("boardValuesRevealed", boardValuesRevealedValue);
    let boardSizeValue = get(boardSize);
    localStorage.setItem("boardSize", boardSizeValue.toString());
}

// clear all the game state on local storage
export function clearLocalStorageAndState() {
    localStorage.removeItem("currentGameId");
    localStorage.removeItem("boardValuesNonces");
    localStorage.removeItem("boardShips");
    localStorage.removeItem("opponentBoardValues");
    localStorage.removeItem("boardValuesRevealed");
    boardValuesNonces.set([]);
    boardShips.clear();
    opponentBoardValues.set([]);
    boardValuesRevealed.set([]);
    gameReady.set(false);
    gameStarted.set(false);
    // NOTE: this does not clear boardSize and currentGameId
}

export async function connectProvider() {
    await defaultEvmStores.setProvider();
    toast.push("Successfully connected account");
}

export async function disconnectProvider() {
    await defaultEvmStores.disconnect();
    toast.push("Account disconnected");
}

let subscriptions: any = {};
let lastEvent: any = {
    'GameStarted': null,
    'GamePhaseChanged': null,
    'BoardValueRevealed': null,
    'GameCreated': null,
    'GameReady': null,
    'IdleAccusation': null,
};

// subscribe to an event, and save the subscription id in the subscriptions variable
// the last event hash is saved in the lastEvent variable, to avoid duplicate events, since web3js
// sometimes sends the same event multiple times
// see: https://ethereum.stackexchange.com/questions/15402/duplicate-events-firing-in-a-web3-listener
function subscribeToEvent(contract: any, event: string, callback: (data: any) => void) {
    if (event in subscriptions) {
        return;
    }
    contract.events[event]()
        .on('connected', (subscriptionId: string) => {
            subscriptions[event] = subscriptionId;
        })
    contract.events[event]().on('data', (data: any) => {
        // ensure that the event is not duplicated
        if (lastEvent[event] === data.transactionHash) {
            return;
        }

        // store the last event hash
        lastEvent[event] = data.transactionHash;

        // invoke the callback
        callback(data);
    });
}

// main contract instance store
export let battleshipInstance: Readable<any> = derived(connected, (connected) => {
    if (connected) {
        let web3Instance = get(web3);
        let address = BattleshipContract.networks["5777"].address;

        // if the instance is already created, just return it
        if (get(battleshipInstance) !== null && get(battleshipInstance) !== undefined) {
            return get(battleshipInstance);
        }

        let contract = new web3Instance.eth.Contract(BattleshipContract.abi, address);

        // install event listeners callbacks
        subscribeToEvent(contract, 'GameCreated', (data: any) => {
            refreshCreatedGames();
        });

        subscribeToEvent(contract, 'GameStarted', (data: any) => {
            if (data.returnValues.id.toString() === get(currentGameId)?.toString()) {
                gameStarted.set(true);
            }
        });

        subscribeToEvent(contract, 'GamePhaseChanged', (data: any) => {
            refreshGameState();
            saveGameToLocalStorage();
        });

        subscribeToEvent(contract, 'BoardValueRevealed', async (data: any) => {
            if (data.returnValues.gameId.toString() !== get(currentGameId)?.toString()) {
                return;
            }

            // upon board reveal, update the UI to reflect the revealed cell for both players
            let playerNumber = await getPlayerNumber();
            let size = get(boardSize);
            if (data.returnValues.playerNumber.toString() === playerNumber.toString()) {
                let index = parseInt(data.returnValues.x) + parseInt(data.returnValues.y) * size;
                let revealed = get(boardValuesRevealed);
                revealed[index] = true;
                boardValuesRevealed.set(revealed);
            } else {
                let index = parseInt(data.returnValues.x) + parseInt(data.returnValues.y) * size;
                let opponentBoard = get(opponentBoardValues);
                let value: (0 | 1) = data.returnValues.value ? 1 : 0;
                opponentBoard[index] = value;
                opponentBoardValues.set(opponentBoard);
            }
            saveGameToLocalStorage();
        });

        subscribeToEvent(contract, 'GameReady', (data: any) => {
            refreshCreatedGames();
            if (data.returnValues.id.toString() === get(currentGameId)?.toString()) {
                gameReady.set(true);
            }
        });

        subscribeToEvent(contract, 'IdleAccusation', (data: any) => {
            // if the current player is accused, set the currentAccusation store to 1,
            // if the current player is the accuser, set the currentAccusation store to -1
            if (data.returnValues.gameId.toString() === get(currentGameId)?.toString()) {
                if (data.returnValues.accusedPlayer.toString().toLowerCase() === get(selectedAccount)?.toString().toLowerCase()) {
                    currentAccusation.set(1);
                } else {
                    currentAccusation.set(-1);
                }
            }
        });

        subscribeToEvent(contract, 'AccusationResolved', (data: any) => {
            if (data.returnValues.gameId.toString() === get(currentGameId)?.toString()) {
                currentAccusation.set(0);
                toast.push("Accusation resolved");
            }
        });
        return contract;
    } else {
        return null;
    }
});

// make a transaction to the contract to create a game, and return the game id
export async function createGame(boardSize: number): Promise<null | number> {
    if (!get(connected)) {
        return null;
    }
    let battleship = get(battleshipInstance);

    let creationTx = await battleship.methods.createGame(boardSize).send({ from: get(selectedAccount) });
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

// make a transaction to the contract to join a game by id
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

// make a transaction to the contract to join a random game, and return the joined game id
export async function joinRandomGame(): Promise<any> {
    if (!get(connected)) {
        return null;
    }
    let battleship = get(battleshipInstance);
    let joinTx = await battleship.methods.joinRandomGame().send({ from: get(selectedAccount) });
    let events = await battleship.getPastEvents('GameReady', {
        fromBlock: joinTx.blockNumber,
    });
    for (let e of events) {
        if (e.returnValues.player2.toLowerCase() === get(selectedAccount)?.toLowerCase()) {
            return events[0].returnValues.id;
        }
    }
    return null;
}

// get the board size of a game by id
export async function getBoardSize(gameId: any): Promise<any> {
    if (!get(connected)) {
        return null;
    }
    let battleship = get(battleshipInstance);
    let boardSize = await battleship.methods.getBoardSize(gameId).call();
    return boardSize;
}

// get all the created games from the contract, and return them as an array
// of objects of the form {id: number, owner: string, boardSize: number}, sorted by id
export async function getCreatedGames(): Promise<any[]> {
    if (!get(connected)) {
        return [];
    }
    let battleship = get(battleshipInstance);
    let ids = await battleship.methods.getCreatedGamesIds().call();
    let owners = await battleship.methods.getCreatedGamesOwners().call();
    let result = []
    for (let i in ids) {
        let boardSize = await battleship.methods.getBoardSize(ids[i]).call();
        result.push({ 'id': ids[i], "owner": owners[i], "boardSize": parseInt(boardSize.toString()) });
    }
    result.sort((a, b) => a.id > b.id ? 1 : -1);
    return result;
}

// refresh the created games store by calling the contract
export async function refreshCreatedGames() {
    let games = await getCreatedGames();
    createdGames.set(games);
}


// make a transaction to the contract to commit the current board values,
// generates the nonces, the commitments, and the Merkle tree root,
// returns the transaction object
export async function commitBoard(commitAmount: any): Promise<any> {
    if (!get(connected)) {
        return null;
    }
    let battleship = get(battleshipInstance);
    let gameId = get(currentGameId);
    if (gameId === null) {
        return null;
    }
    // generated the 32 bytes values, where the board value is the last significan byte
    let nonces = get(boardValues).map((v: 0 | 1) => generateBoardValue(v));
    boardValuesNonces.set(nonces);

    // compute the Merkle tree root
    let commitments = nonces.map((nonce) => generateCommitment(nonce));
    let root = computeMerkleRoot(commitments);

    // commit the Merkle tree root and the commit amount
    let commitTx = await battleship.methods.commitBoard(gameId, root).send({ from: get(selectedAccount), value: commitAmount });
    return commitTx;
}

// make a transaction to the contract to guess a cell,
// returns the transaction object
export async function guessCell(x: number, y: number): Promise<any> {
    if (!get(connected)) {
        return null;
    }
    let battleship = get(battleshipInstance);
    let gameId = get(currentGameId);
    if (gameId === null) {
        return null;
    }
    let guessTx = await battleship.methods.guessCell(gameId, x, y).send({ from: get(selectedAccount) });
    return guessTx;
}

// make a transaction to the contract to reveal a value,
// returns the transaction object
export async function revealValue(): Promise<any> {
    if (!get(connected)) {
        return null;
    }
    let battleship = get(battleshipInstance);
    let gameId = get(currentGameId);
    if (gameId === null) {
        return null;
    }
    let guess = await getCurrentGuess();
    console.log(guess);

    // we can use a plain js number here because the board size is small
    let x = parseInt(guess[0].toString());
    let y = parseInt(guess[1].toString());
    let index = x + y * get(boardSize);

    // generate a Merkle proof for the current guess
    let nonce = get(boardValuesNonces)[index];
    let commitments = get(boardValuesNonces).map((x) => generateCommitment(x));
    let proof = computeMerkleProof(commitments, index);

    // make the transaction
    let revealTx = await battleship.methods.revealValue(gameId, x, y, nonce, proof).send({ from: get(selectedAccount) });
    return revealTx;
}

// make a contract call to get the current guess
async function getCurrentGuess(): Promise<any> {
    if (!get(connected)) {
        return null;
    }
    let battleship = get(battleshipInstance);
    let gameId = get(currentGameId);
    if (gameId === null) {
        return null;
    }
    let guess = await battleship.methods.getCurrentGuess(gameId).call();
    return guess;
}

// make a contract call to check the current placement of the ships
export async function checkShipPlacement(): Promise<boolean> {
    if (!get(connected)) {
        return false;
    }
    let battleship = get(battleshipInstance);
    let ships = boardShips.toContractStructs();
    let nonces = get(boardValuesNonces);
    let result = await battleship.methods.checkShipPlacement(get(boardSize), nonces, ships).call();
    return result;
}

// make a transaction to reveal the current board,
// returns the transaction object
export async function revealBoard(): Promise<any> {
    if (!get(connected)) {
        return null;
    }
    let battleship = get(battleshipInstance);
    let gameId = get(currentGameId);
    if (gameId === null) {
        return null;
    }
    let nonces = get(boardValuesNonces);
    let ships = boardShips.toContractStructs();
    let revealTx = await battleship.methods.revealBoard(gameId, nonces, ships).send({ from: get(selectedAccount) });
    return revealTx;
}

// make a transaction to claim the winning reward,
// returns the transaction object
export async function claimWinningReward(): Promise<any> {
    if (!get(connected)) {
        return null;
    }
    let battleship = get(battleshipInstance);
    let gameId = get(currentGameId);
    if (gameId === null) {
        return null;
    }
    let claimTx = await battleship.methods.claimWinningReward(gameId).send({ from: get(selectedAccount) });
    console.log(claimTx);
    return claimTx;
}

// make a transaction to accuse the other player of being idle,
// returns the transaction object
export async function accuseIdle(): Promise<any> {
    if (!get(connected)) {
        return null;
    }
    let battleship = get(battleshipInstance);
    let gameId = get(currentGameId);
    if (gameId === null) {
        return null;
    }
    let claimTx = await battleship.methods.accuseIdle(gameId).send({ from: get(selectedAccount) });
    console.log(claimTx);
    return claimTx;
}

// make a transaction to claim the accusation reward,
// returns the transaction object
export async function claimAccusationReward(): Promise<any> {
    if (!get(connected)) {
        return null;
    }
    let battleship = get(battleshipInstance);
    let gameId = get(currentGameId);
    let claimTx = await battleship.methods.claimAccusationReward(gameId).send({ from: get(selectedAccount) });
    console.log(claimTx);
    return claimTx;
}