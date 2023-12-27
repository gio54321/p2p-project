<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import {
		connected,
		battleshipInstance,
		loadGameFromLocalStorage,
		clearLocalStorageAndState
	} from '$lib/js/battleship';
	import { goto } from '$app/navigation';

	function loadGame() {
		loadGameFromLocalStorage();
		goto('/play');
	}
</script>

<div class="mt-16 w-full">
	<div class="flex items-center justify-center">
		<Button class="mr-3" on:click={loadGame}>Load game</Button>
		<Button on:click={clearLocalStorageAndState}>Clear game</Button>
	</div>
</div>
