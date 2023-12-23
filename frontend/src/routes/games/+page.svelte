<script lang="ts">
	import { ButtonGroup, Button } from 'flowbite-svelte';
	import {
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell
	} from 'flowbite-svelte';
	import { PlusSolid, SearchSolid, ArrowRightSolid } from 'flowbite-svelte-icons';
	import {
		connected,
		battleshipInstance,
		createGame,
		getCreatedGames,
		joinGameById
	} from '$lib/js/battleship';
	import { toast } from '@zerodevx/svelte-toast';
	import { selectedAccount } from 'svelte-web3';

	let gameCreated: null | Promise<null | number> = null;
	let gameJoined: null | Promise<any> = null;
	async function createGameLocal() {
		if (!$connected) {
			toast.push('Not connected');
			return;
		}
		gameCreated = createGame();
	}

	function joinGameByIdLocal(id: number) {
		console.log(id);
		if (!$connected) {
			toast.push('Not connected');
			return;
		}
		gameJoined = joinGameById(id);
	}

	let createdGamesList: Promise<any[]> = Promise.resolve([]);
	$: if ($connected) {
		createdGamesList = getCreatedGames();
	}

	$: if ($battleshipInstance !== null) {
		$battleshipInstance.events
			.GameCreated()
			.on('data', (data) => {
		        createdGamesList = getCreatedGames();
			})
		$battleshipInstance.events
			.GameReady()
			.on('data', (data) => {
		        createdGamesList = getCreatedGames();
			})
	}
</script>

<div class="mt-16 w-full">
	<div class="flex items-center justify-center">
		<div class="mx-14 flex w-full justify-center xl:mx-0">
			<ButtonGroup>
				<Button on:click={createGameLocal}>
					<PlusSolid class="me-2 h-3 w-3" />
					Create game
				</Button>
				<Button>
					<SearchSolid class="me-2 h-3 w-3" />
					Join game by id
				</Button>
				<Button>
					<ArrowRightSolid class="me-2 h-3 w-3" />
					Join random game
				</Button>
			</ButtonGroup>
		</div>
	</div>
    {#if gameCreated !== null}
        {#await gameCreated}
            <p>Creating game...</p>
        {:then id}
            <p>Game created, you game id is {id}</p>
        {:catch error}
            <p style="color: red">{error.message}</p>
        {/await}
    {/if}

	{#await createdGamesList}
		<p>...waiting</p>
	{:then games}
		<div class="mt-16 flex items-center justify-center">
			<div class="max-w-3xl">
				<Table hoverable={true}>
					<caption
						class="bg-white p-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
					>
						Created games
					</caption>
					<TableHead>
						<TableHeadCell>Owner</TableHeadCell>
						<TableHeadCell>Game id</TableHeadCell>
						<TableHeadCell>
							<span class="sr-only">Join game</span>
						</TableHeadCell>
					</TableHead>
					<TableBody>
						{#each games as game}
							<TableBodyRow>
								<TableBodyCell>{game.owner.toLowerCase()}</TableBodyCell>
								<TableBodyCell>{game.id}</TableBodyCell>
								<TableBodyCell>
									<button
										class="font-medium text-primary-600 hover:underline dark:text-primary-500"
										on:click={() => joinGameByIdLocal(game.id)}
										>Join game
									</button>
								</TableBodyCell>
							</TableBodyRow>
						{/each}
					</TableBody>
				</Table>
			</div>
		</div>
	{:catch error}
		<p style="color: red">{error.message}</p>
	{/await}
</div>


{#if gameJoined !== null}
	{#await gameJoined}
		<p>...waiting</p>
	{:then number}
		<p>The number is {number}</p>
	{:catch error}
		<p style="color: red">{error.message}</p>
	{/await}
{/if}
