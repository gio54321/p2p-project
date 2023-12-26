<script lang="ts">
	import { toast } from '@zerodevx/svelte-toast';
	import {
		allowedShips,
		boardSize,
		battleshipInstance,
		commitBoard,
		boardValues,
		boardShips,
		currentGameId,
		saveGameToLocalStorage
	} from '$lib/js/battleship';
	import { Trash } from 'svelte-heros-v2';
	import { Button, Kbd, Input, Label, NumberInput } from 'flowbite-svelte';
	import { goto } from '$app/navigation';
	import { connected, boardValuesNonces } from '$lib/js/battleship';
	import { web3 } from 'svelte-web3';
</script>

<div class="mt-16 w-full">
	<div class="flex items-center justify-center">
		<div class="mx-14 w-full xl:mx-0">
			<div class="mb-10 flex items-center justify-center py-3">
				<div class="font-semibold">Guess a cell</div>
			</div>

			<div class="flex justify-center">
				<div
					class="mr-10 flex flex-wrap justify-between"
					style="width: {boardSize * 2 + 1}rem; height: {boardSize * 2 + 1}rem;"
				>
					{#each $boardValues as _, index}
						<button
							class="h-8 w-8 border-2 border-gray-500"
							class:bg-blue-500={$boardValues[index] === 1}
							on:click={() => {}}
						>
						</button>
					{/each}
				</div>
				<div
					class="mr-10 flex flex-wrap justify-between"
					style="width: {boardSize * 2 + 1}rem; height: {boardSize * 2 + 1}rem;"
				>
					{#each $boardValues as _, index}
						<button
							class="h-8 w-8 border-2 border-gray-500"
							class:bg-blue-500={$boardValues[index] === 1}
							on:click={() => {}}
						>
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
