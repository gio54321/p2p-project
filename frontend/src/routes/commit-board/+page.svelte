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
		saveGameToLocalStorage,
		clearLocalStorageAndState
	} from '$lib/js/battleship';
	import { Trash } from 'svelte-heros-v2';
	import { Button, Kbd, Input, Label, NumberInput } from 'flowbite-svelte';
	import { goto } from '$app/navigation';
	import { connected, boardValuesNonces } from '$lib/js/battleship';
	import { web3 } from 'svelte-web3';

	import { computeMerkleRoot, generateBoardValue, generateCommitment } from '$lib/js/merkleProofs';

	let commitAmount = '0';

	let gridBlocks: string[] = [];
	let gridValues: number[] = [];
	let hoverIds: number[] = [];
	gridBlocks = [];
	for (let i = 0; i < $boardSize * $boardSize; i++) {
		gridBlocks = [...gridBlocks, `block-${i}`];
		hoverIds = [...hoverIds, 0];
	}

	let currentlySelectedShip = -1;
	$: currentShipLength =
		currentlySelectedShip >= 0 ? $allowedShips[currentlySelectedShip].length : 1;
	let currentShipOrientation = 0;
	$: gridValues = $boardValues;

	function handleClick(index: number) {
		let x = index % $boardSize;
		let y = Math.floor(index / $boardSize);
		if (
			(currentShipOrientation === 1 && y < $boardSize - currentShipLength + 1) ||
			(currentShipOrientation === 0 && x < $boardSize - currentShipLength + 1)
		) {
			for (let i = 0; i < currentShipLength; i++) {
				if (gridValues[index + i * (1 + currentShipOrientation * ($boardSize - 1))] === 1) {
					toast.push('Invalid ship placement');
					return;
				}
			}
			boardShips.setShip(currentlySelectedShip, index, currentShipOrientation);
			currentlySelectedShip = -1;
		}
	}

	function handleMouseEnter(index: number) {
		let x = index % $boardSize;
		let y = Math.floor(index / $boardSize);
		if (
			(currentShipOrientation === 1 && y < $boardSize - currentShipLength + 1) ||
			(currentShipOrientation === 0 && x < $boardSize - currentShipLength + 1)
		) {
			for (let i = 0; i < currentShipLength; i++) {
				hoverIds[index + i * (1 + currentShipOrientation * ($boardSize - 1))] = 1;
			}
		}
	}

	function handleMouseLeave() {
		for (let i = 0; i < $boardSize * $boardSize; i++) {
			hoverIds[i] = 0;
		}
	}
	function rotateShip() {
		// space
		currentShipOrientation = 1 - currentShipOrientation;
	}

	let commit: any = null;

	function commitBoardLocal() {
		if (!$connected) {
			toast.push('Not connected');
			return;
		}

		console.log($currentGameId);

		let commitAmountWei;
		try {
			commitAmountWei = $web3.utils.toWei(commitAmount, 'wei');
		} catch (e) {
			toast.push('Invalid commit amount');
			return;
		}

		if (commitAmountWei <= 0) {
			toast.push('Invalid commit amount');
			return;
		}

		// TODO: check if the board is valid

		commit = commitBoard(commitAmountWei);
	}

	let eventHandlersRegistered = false;
	$: if ($battleshipInstance !== null && !eventHandlersRegistered) {
		$battleshipInstance.events.GameStarted().on('data', (data: any) => {
			console.log(data);
			if (data.returnValues.id == $currentGameId) {
				toast.push('Game started');
				saveGameToLocalStorage();
				goto('/play');
			}
		});
		eventHandlersRegistered = true;
	}
</script>

<div class="mt-16 w-full">
	<div class="flex items-center justify-center">
		<div class="mx-14 w-full xl:mx-0">
			<div class="mb-10 flex items-center justify-center py-3">
				<div class="font-semibold">Choose the ships placement and commit the board</div>
			</div>

			<div class="flex justify-center">
				<div
					class="mr-10 flex flex-wrap justify-between"
					style="width: {$boardSize * 4 + 3}rem; height: {$boardSize * 4 + 3}rem;"
				>
					{#each gridBlocks as id, index}
						<button
							{id}
							class="h-16 w-16 border-2 border-gray-500"
							class:bg-blue-500={gridValues[index] === 1}
							class:bg-gray-400={hoverIds[index] === 1 && gridValues[index] !== 1}
							class:bg-orange-700={gridValues[index] === 1 && hoverIds[index] === 1}
							on:click={() => handleClick(index)}
							on:mouseenter={() => handleMouseEnter(index)}
							on:mouseleave={() => handleMouseLeave()}
						>
						</button>
					{/each}
				</div>

				<div>
					<div class="mb-2 font-semibold">Select a ship:</div>
					{#each $allowedShips as ship, i}
						<div>
							<button
								on:click={() => {
									currentlySelectedShip = i;
									boardShips.removeShip(i);
								}}
								class:text-blue-500={$boardShips[i] !== null}
								class:font-bold={currentlySelectedShip == i}
							>
								{ship.name} ({ship.length})
							</button>

							<button on:click={() => boardShips.removeShip(i)}>
								<Trash size={'16'} />
							</button>
						</div>
					{/each}

					<Button class="mt-4" on:click={rotateShip}>Rotate ship</Button>

					<Label class="mt-10 space-y-2">
						<span>Commit Amount (wei)</span>
						<Input bind:value={commitAmount} />
					</Label>

					<Button class="mt-10" on:click={commitBoardLocal}>Commit</Button>
				</div>
			</div>

			{#if commit !== null}
				<div class="mt-10 flex items-center justify-center">
					{#await commit}
						waiting
					{:then tx}
						{tx}
					{:catch error}
						<p style="color: red">{error.message}</p>
					{/await}
				</div>
			{/if}
		</div>
	</div>
</div>
