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
