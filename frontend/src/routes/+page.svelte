<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { connected, battleshipInstance, loadGameFromLocalStorage } from '$lib/js/battleship';
	import { goto } from '$app/navigation';
	async function sanityCheck() {
		if ($connected) {
			let asd = await $battleshipInstance.methods.sanityCheck('1234').call();
			return asd;
		}
	}

	let msg = Promise.resolve('not connected');

	$: if ($connected) {
		msg = sanityCheck();
	}

	function loadGame() {
		loadGameFromLocalStorage();
		goto('/play');
	}
</script>

<div class="mt-16 w-full">
	<div class="flex items-center justify-center">
		<Button on:click={loadGame}>Load game</Button>
	</div>
</div>
