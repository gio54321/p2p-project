<script lang="ts">
	import { toast } from "@zerodevx/svelte-toast";
    import { allowedShips, boardSize } from '$lib/js/battleship'
	import { boardValues, boardShips } from "$lib/js/battleshipGrid";
    import { Trash } from 'svelte-heros-v2';
	import { Kbd } from "flowbite-svelte";


    let gridBlocks: string[] = [];
    let gridValues: number[] = [];
    let hoverIds: number[] = [];
    gridBlocks = [];
    for (let i = 0; i < boardSize * boardSize; i++) {
        gridBlocks = [...gridBlocks, `block-${i}`];
        hoverIds = [...hoverIds, 0];
    }

    let currentlySelectedShip = -1;
    $: currentShipLength = currentlySelectedShip >= 0 ? allowedShips[currentlySelectedShip].length : 1;
    let currentShipOrientation = 0;
    let hoverIdx = 0;
    $: gridValues = $boardValues;

    function handleClick(index: number) {
        let x = index % boardSize;
        let y = Math.floor(index / boardSize);
        if ((currentShipOrientation === 1 && y < boardSize - currentShipLength + 1)
        || (currentShipOrientation === 0 && x < boardSize - currentShipLength + 1)) {
            
            for (let i = 0; i < currentShipLength; i++) {
                if (gridValues[index + i*(1 + currentShipOrientation*7)] === 1) {
                    toast.push('Invalid ship placement');
                    return;
                }
            }
            boardShips.setShip(currentlySelectedShip, index, currentShipOrientation);
            currentlySelectedShip = -1;
        }
    }

    function handleMouseEnter(index: number) {
        hoverIdx = index;
        let x = index % boardSize;
        let y = Math.floor(index / boardSize);
        if ((currentShipOrientation === 1 && y < boardSize - currentShipLength + 1)
        || (currentShipOrientation === 0 && x < boardSize - currentShipLength + 1)) {
            for (let i = 0; i < currentShipLength; i++) {
                hoverIds[index + i*(1 + currentShipOrientation*7)] = 1;
            }
        }
    }

    function handleMouseLeave() {
        for (let i = 0; i < boardSize * boardSize; i++) {
            hoverIds[i] = 0;
        }
    }
    function onKeyDown(e: any) {
        if (e.keyCode == 32) {
            // space
            currentShipOrientation = 1 - currentShipOrientation;
            // refresh hover array
            handleMouseLeave();
            handleMouseEnter(hoverIdx);
        }
    }
</script>



<div class="flex justify-center">
<div class="flex justify-between flex-wrap mr-10"
style="width: {boardSize * 4 + 3}rem; height: {boardSize * 4 + 3}rem;">
    {#each gridBlocks as id, index}
        <button {id} class="border-gray-500 border-2 h-16 w-16"
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
    <div class="mb-2 font-semibold">
        Select a ship:
    </div>
    {#each allowedShips as ship, i}
        <div>
            <button
                on:click={() => {currentlySelectedShip = i; boardShips.removeShip(i)}}
                class:text-blue-500={$boardShips[i] !== null}
                class:font-bold={currentlySelectedShip == i}>
                {ship.name} ({ship.length})
            </button>

            <button
                on:click={() => boardShips.removeShip(i)}>
                <Trash size={'16'} />
            </button>
        </div>
    {/each}

    <div class="mt-10">
        Press <Kbd class="px-4 py-1.5">Spacebar</Kbd>
        <br>
        to rotate the ship.
    </div>
</div>

</div>
<svelte:window on:keydown|preventDefault={onKeyDown} />
