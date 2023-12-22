<script lang="ts">
	import Game from '$lib/components/Game.svelte';
	import { connected, battleshipInstance } from '$lib/js/battleship';
    import {selectedAccount} from 'svelte-web3'

	async function sanityCheck() {
		if ($connected) {
            console.log($battleshipInstance);
            //let asd = await $battleshipInstance.methods.sanityCheck("1234").send({"from" : $selectedAccount});
            let asd = await $battleshipInstance.methods.sanityCheck("1234").call();
            console.log(asd);
			return asd;
		}
	}

    let msg = Promise.resolve('not connected');


    $: if ($connected) {
        msg = sanityCheck();
    }
</script>

<div class="mt-16 w-full">
	<div class="flex items-center justify-center">
		<div class="mx-14 w-full xl:mx-0">
			<Game></Game>
		</div>
	</div>
</div>

{#await msg}
	<p>...waiting</p>
{:then number}
	<p>The number is {number}</p>
{:catch error}
	<p style="color: red">{error.message}</p>
{/await}
