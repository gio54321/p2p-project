const Battleship = artifacts.require('Battleship');

async function createGame(battleship, account) {
    const gameTx = await battleship.createGame({'from': account});
    let events = await battleship.getPastEvents('GameCreated', {
        fromBlock:gameTx.receipt.blockNumber,
    });
    for (let e of events) {
        if (e.returnValues.owner == account) {
            return events[0].returnValues.id;
        }
    }
    return undefined;
}

exports.createGame = createGame