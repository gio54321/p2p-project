<script lang="ts">
    import { selectedAccount, web3 } from "svelte-web3";
	let balance = '';
	$: if ($selectedAccount) {
		$web3.eth.getBalance($selectedAccount.toString())
        .then((bal: string) => {
            balance = parseFloat($web3.utils.fromWei(bal, 'ether')).toFixed(2)
        });
	}

</script>

<div class="pr-3 font-semibold text-sm text-green-500">
    {balance} ETH
</div>