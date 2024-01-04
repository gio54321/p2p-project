<script lang="ts">
	import '../app.pcss';
	import { page } from '$app/stores';
	import {
		Navbar,
		NavBrand,
		NavLi,
		NavUl,
		NavHamburger,
		Avatar,
		Dropdown,
		DropdownHeader,
		DropdownItem,
		DropdownDivider,
		Button
	} from 'flowbite-svelte';
	import { connected, connectProvider, disconnectProvider } from '$lib/js/battleship';
	import { selectedAccount, web3 } from 'svelte-web3';
	import { SvelteToast } from '@zerodevx/svelte-toast';
	import Balance from '$lib/components/Balance.svelte';

	$: activeUrl = $page.url.pathname;
</script>

<svelte:window />

<SvelteToast options={{ duration: 2000, reversed: true, intro: { y: 192 } }} />

<Navbar>
	<NavBrand href="/">
		<span class="self-center whitespace-nowrap text-xl font-semibold dark:text-white"
			>Hit and sunk!</span
		>
	</NavBrand>

	<div class="flex items-center md:order-2">
		{#if $connected}
			<Balance></Balance>
		{/if}

		<Avatar id="avatar-menu" />
		<NavHamburger class1="w-full md:flex md:w-auto md:order-1" />
	</div>

	<Dropdown placement="bottom" triggeredBy="#avatar-menu">
		<DropdownHeader>
			{#if !$connected}
				<span class="block text-sm">No provider connected</span>
			{:else}
				<span class="block text-sm">Account connected</span>
				<span class="block truncate text-sm font-semibold">{$selectedAccount}</span>
			{/if}
		</DropdownHeader>
		{#if !$connected}
			<DropdownItem on:click={connectProvider}>Connect</DropdownItem>
		{:else}
			<DropdownItem on:click={disconnectProvider}>Disconnect</DropdownItem>
		{/if}
	</Dropdown>

	<NavUl {activeUrl}>
		<NavLi href="/">Home</NavLi>
		<NavLi href="/games">Games</NavLi>
	</NavUl>
</Navbar>

<div class="mx-auto flex w-full px-4">
	<main class="w-full xl:mx-32">
		<slot />
	</main>
</div>

<style>
	:root {
		--toastContainerTop: 4rem;
		--toastContainerRight: auto;
		--toastContainerBottom: auto;
		--toastContainerLeft: calc(50vw - 8rem);
		--toastBarHeight: 0;
	}
</style>
