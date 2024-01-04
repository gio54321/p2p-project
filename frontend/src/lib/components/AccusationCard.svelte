<script>
	import { Button, Dropdown, DropdownItem } from 'flowbite-svelte';
	import { ChevronDownSolid } from 'flowbite-svelte-icons';

	import {
		GameStateEnum,
		accuseIdle,
		claimAccusationReward,
		currentAccusation,
		gameState
	} from '$lib/js/battleship';
	import { toast } from '@zerodevx/svelte-toast';

	function accuse() {
		console.log('accuse');
		if ($gameState === GameStateEnum.Guessing || $gameState === GameStateEnum.Revealing) {
			toast.push('Cannot accuse in this game state');
			return;
		}
		accuseIdle();
	}

	function checkAccusation() {
		console.log('check accusation');
		claimAccusationReward();
	}

	$: if ($currentAccusation !== 0) {
		if ($currentAccusation === 1) {
			toast.push('You have been accused of being idle');
		} else if ($currentAccusation === -1) {
			toast.push('The other player has been accused of being idle');
		}
	}
</script>

<Button>Accusation<ChevronDownSolid class="ms-2 h-3 w-3 text-white dark:text-white" /></Button>
<Dropdown>
	<DropdownItem
		on:click={() => {
			accuse();
		}}>Accuse the other player of idle</DropdownItem
	>
	<DropdownItem
		on:click={() => {
			checkAccusation();
		}}>Check accusation</DropdownItem
	>
</Dropdown>
