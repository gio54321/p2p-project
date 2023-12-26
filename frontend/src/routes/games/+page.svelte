<script lang="ts">
	import { ButtonGroup, Button, Spinner } from 'flowbite-svelte';
	import {
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		Card
	} from 'flowbite-svelte';
	import { PlusSolid, SearchSolid, ArrowRightSolid } from 'flowbite-svelte-icons';
	import {
		connected,
		battleshipInstance,
		createGame,
		getCreatedGames,
		joinGameById,
		currentGameId
	} from '$lib/js/battleship';
	import { toast } from '@zerodevx/svelte-toast';
	import { goto } from '$app/navigation';

	let gameCreated: null | Promise<null | number> = null;
	let gameJoined: null | Promise<any> = null;
	async function createGameLocal() {
		if (!$connected) {
			toast.push('Not connected');
			return;
		}
		gameCreated = createGame();
		$currentGameId = await gameCreated;
	}

	function joinGameByIdLocal(id: number) {
		console.log(id);
		if (!$connected) {
			toast.push('Not connected');
			return;
		}
		gameJoined = joinGameById(id).then(() => {
			$currentGameId = id;
			goto('/commit-board');
		});
	}

	let createdGamesList: Promise<any[]> = Promise.resolve([]);
	let showCreatedGames = false;
	$: if ($connected) {
		createdGamesList = getCreatedGames();
	}

	let eventHandlersRegistered = false;
	$: if ($battleshipInstance !== null && !eventHandlersRegistered) {
		$battleshipInstance.events.GameCreated().on('data', () => {
			console.log('game created event');
			createdGamesList = getCreatedGames();
		});
		$battleshipInstance.events.GameReady().on('data', (data: any) => {
			createdGamesList = getCreatedGames();
			console.log(data);
			if (data.returnValues.id == $currentGameId) {
				toast.push('Second player joined');
				goto('/commit-board');
			}
		});
		eventHandlersRegistered = true;
	}
</script>

<div class="mt-16 w-full">
	<div class="flex items-center justify-center">
		<div class="mx-14 flex w-full justify-center xl:mx-0">
			<ButtonGroup>
				<Button
					on:click={() => {
						showCreatedGames = false;
						createGameLocal();
					}}
				>
					<PlusSolid class="me-2 h-3 w-3" />
					Create game
				</Button>
				<Button
					on:click={() => {
						showCreatedGames = !showCreatedGames;
					}}
				>
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
		<div class="mt-10 flex items-center justify-center">
			{#await gameCreated}
				<Card>
					<h5 class="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
						Creating game
					</h5>
					<div class="mt-2 flex items-center justify-center"><Spinner /></div>
				</Card>
			{:then id}
				<Card>
					<h5 class="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
						Game created
					</h5>
					The game id is<br />
					<h4 class="my-2 text-center text-xl font-semibold">{id}</h4>
					<br />
					Waiting for another player
					<div class="mt-2 flex items-center justify-center"><Spinner /></div>
				</Card>
			{:catch error}
				<p style="color: red">{error.message}</p>
			{/await}
		</div>
	{/if}
	{#if showCreatedGames}
		{#await createdGamesList}
			<p>...waiting</p>
		{:then games}
			<div class="my-16 flex items-center justify-center">
				<div class="max-w-3xl">
					<Table hoverable={true}>
						<caption
							class="bg-white p-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
						>
							Join game by id
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
	{/if}
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
