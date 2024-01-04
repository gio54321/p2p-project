<script lang="ts">
	import { toast } from '@zerodevx/svelte-toast';
	import {
		allowedShips,
		boardSize,
		battleshipInstance,
		commitBoard,
		boardValues,
		guessCell,
		getGamePhase,
		refreshGameState,
		gameState,
		getGameStateString,
		GameStateEnum,
		revealValue,
		opponentBoardValues,
		boardValuesRevealed,
		checkShipPlacement,
		revealBoard,
		gameWinner,
		claimWinningReward,
		clearLocalStorageAndState,
		currentGameId
	} from '$lib/js/battleship';
	import { Button, Kbd, Input, Label, NumberInput, Card } from 'flowbite-svelte';
	import { connected, boardValuesNonces } from '$lib/js/battleship';
	import { goto } from '$app/navigation';
	import AccusationCard from '$lib/components/AccusationCard.svelte';

	let currentGuess = -1;

	$: if ($connected) {
		refreshGameState();
	}

	let revealedValue = false;
	$: if ($gameState === GameStateEnum.Revealing && !revealedValue) {
		revealedValue = true;
		toast.push('Revealing value');
		revealValue();
	}

	// restore revealed value on state change
	$: if ($gameState === GameStateEnum.Guessing && revealedValue) {
		revealedValue = false;
	}

	$: if ($gameState === GameStateEnum.WaitingGuessing || $gameState === GameStateEnum.BoardReveal) {
		currentGuess = -1;
	}

	function guessCellLocal() {
		if (currentGuess < 0 || currentGuess >= $boardSize * $boardSize) {
			toast.push('Invalid guess');
			return;
		}
		let x = currentGuess % $boardSize;
		let y = Math.floor(currentGuess / $boardSize);
		guessCell(x, y);
	}

	function revealBoardLocal() {
		if ($gameState !== GameStateEnum.BoardReveal) {
			toast.push('Not the right time');
			return;
		}
		console.log('reveal board');
		revealBoard();
	}

	let winningsTx: Promise<any> = Promise.resolve(null);
	function claimWinningsLocal() {
		if ($gameWinner === null) {
			toast.push('Not the right time');
			return;
		}
		console.log('claim winnings');
		winningsTx = claimWinningReward();
	}

	function quitGame() {
		console.log('quit game');
		$currentGameId = null;
		$boardSize = 4;
		clearLocalStorageAndState();
		goto('/games');
	}
</script>

<div class="mt-16 w-full">
	<div class="flex items-center justify-center">
		<div class="mx-14 w-full xl:mx-0">
			<div class="items-right flex justify-end">
				<AccusationCard />
			</div>
			<div class="mb-10 flex items-center justify-center py-3">
				<div class="font-semibold">
					{getGameStateString($gameState)}
				</div>
			</div>
			<div class="mb-10 flex items-center justify-center py-3">
				{#if $gameWinner !== null}
					<Card>
						{#if $gameWinner && ($gameState === GameStateEnum.BoardReveal || $gameState === GameStateEnum.WaitingWinningClaim || $gameState === GameStateEnum.Finished)}
							<h5 class="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
								You won!
							</h5>
							{#if $gameState === GameStateEnum.WaitingWinningClaim}
								<Button
									class="mt-2"
									on:click={() => {
										claimWinningsLocal();
									}}>Claim winning</Button
								>
							{/if}
							{#await winningsTx then value}
								{#if value !== null}
									<div class="mt-2">
										Eth transferrred in tx<br />
										{value.transactionHash.substring(0, 10)}...
									</div>
								{/if}
							{:catch error}
								<p style="color: red">{error.message}</p>
							{/await}
						{:else}
							<h5 class="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
								You lost!
							</h5>
						{/if}
						{#if $gameState === GameStateEnum.Finished}
							<Button class="mt-2" on:click={quitGame}>Quit</Button>
						{/if}
					</Card>
				{/if}
			</div>
			<div class="flex justify-center">
				<div class="mr-16">
					<div
						class="flex flex-wrap justify-between"
						style="width: {$boardSize * 2 + 1}rem; height: {$boardSize * 2 + 1}rem;"
					>
						{#each $boardValues as _, index}
							<button
								class="h-8 w-8 border-2 border-gray-500"
								class:bg-yellow-200={currentGuess === index}
								class:bg-red-500={$opponentBoardValues[index] === 1}
								class:bg-blue-200={$opponentBoardValues[index] === 0}
								on:click={() => {
									if ($gameState !== GameStateEnum.Guessing) {
										return;
									}
									currentGuess = index;
								}}
							>
								{#if currentGuess === index}
									?
								{:else if $opponentBoardValues[index] === 1}
									X
								{/if}
							</button>
						{/each}
					</div>
					<div class="mt-2">Opponent's board</div>
					<Button class="mt-2" on:click={guessCellLocal}>Guess</Button>
				</div>
				<div>
					<div
						class="flex flex-wrap justify-between"
						style="width: {$boardSize * 2 + 1}rem; height: {$boardSize * 2 + 1}rem;"
					>
						{#each $boardValues as _, index}
							<button
								class="h-8 w-8 border-2 border-gray-500"
								class:bg-blue-500={$boardValues[index] === 1}
							>
								{#if $boardValuesRevealed[index]}
									X
								{/if}
							</button>
						{/each}
					</div>
					<div class="mt-2">My board</div>
					{#if $gameState === GameStateEnum.BoardReveal}
						<Button class="mt-2" on:click={revealBoardLocal}>Reveal the board</Button>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
