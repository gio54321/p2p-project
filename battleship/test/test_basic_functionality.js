var Battleship = artifacts.require('Battleship')

contract("HelloWorld", (accounts) => {
    it("Should create a game and emit an event", async () => {
        const battleship = await Battleship.deployed();
        const gameTx = await battleship.createGame();

        let events = await battleship.getPastEvents('GameCreated', {
            fromBlock:gameTx.receipt.blockNumber,
            toBlock:gameTx.receipt.blockNumber
        });
        assert.equal(events.length, 1, "More than one event was emitted");
        assert.notEqual(events[0].returnValues.id, undefined, "returned id is undefined");
    });

    it("should return different ids for different games", async () => {
        const battleship = await Battleship.deployed();
        const gameTx1 = await battleship.createGame();
        const gameTx2 = await battleship.createGame();

        let events = await battleship.getPastEvents('GameCreated',{
            fromBlock:gameTx1.receipt.blockNumber,
            toBlock:gameTx2.receipt.blockNumber
        });
        assert.equal(events.length, 2, "Contract emitted wrong number of events");
        assert.notEqual(events[0].returnValues.id, events[1].returnValues.id, "returned id is undefined");
        });
});