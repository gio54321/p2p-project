import {
    defaultEvmStores,
    selectedAccount,
    web3
} from 'svelte-web3';
import { derived, get } from 'svelte/store';

import { toast } from '@zerodevx/svelte-toast'

import BattleshipContract from '$lib/contracts/Battleship.json';

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

export const connected = derived(selectedAccount, ($a) => $a !== undefined);

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
        fromBlock:creationTx.blockNumber,
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
    console.log('cazzi', id, typeof id);
    let joinTx = await battleship.methods.joinGameById(id).send({ from: get(selectedAccount) });
    console.log(joinTx)
    return joinTx;
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
        result.push({'id': ids[i], "owner": owners[i]});
    }
    return result;
}

