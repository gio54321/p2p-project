import {
    defaultEvmStores,
    selectedAccount,
    web3
} from 'svelte-web3';
import { derived, get } from 'svelte/store';

import { toast } from '@zerodevx/svelte-toast'

export const connected = derived(selectedAccount, ($a) => $a !== undefined);

export function connectProvider() {
	defaultEvmStores.setProvider();
    toast.push("Successfully connected account");
}
export function disconnectProvider() {
	defaultEvmStores.disconnect();
    toast.push("Account disconnected");
}
