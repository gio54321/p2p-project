var Battleship = artifacts.require('Battleship')

contract("Battleship", (accounts) => {
    it("Should create a game and emit an event", async () => {
        const battleship = await Battleship.deployed();
        const gameTx = await battleship.createGame({'from': accounts[2]});

        let events = await battleship.getPastEvents('GameCreated', {
            fromBlock:gameTx.receipt.blockNumber,
            toBlock:gameTx.receipt.blockNumber
        });
        assert.equal(events.length, 1, "More than one event was emitted");
        assert.notEqual(events[0].returnValues.id, undefined, "returned id is undefined");
        assert.equal(events[0].returnValues.owner, accounts[2], "returned owner is not correct");
    });

    it("should return different ids for different games", async () => {
        const battleship = await Battleship.deployed();
        const gameTx1 = await battleship.createGame({'from':accounts[1]});
        const gameTx2 = await battleship.createGame({'from':accounts[2]});

        let events = await battleship.getPastEvents('GameCreated',{
            fromBlock:gameTx1.receipt.blockNumber,
            toBlock:gameTx2.receipt.blockNumber
        });
        assert.equal(events.length, 2, "Contract emitted wrong number of events");
        assert.notEqual(events[0].returnValues.id, events[1].returnValues.id, "returned id is undefined");
        assert.equal(events[0].returnValues.owner, accounts[1], "returned owner is not correct");
        assert.equal(events[1].returnValues.owner, accounts[2], "returned owner is not correct");
    });

    it("should let another player join by id", async () => {
        const battleship = await Battleship.deployed();
        const gameTx1 = await battleship.createGame({'from':accounts[1]});
        let events = await battleship.getPastEvents('GameCreated',{
            fromBlock:gameTx1.receipt.blockNumber,
            toBlock:gameTx1.receipt.blockNumber
        });
        const gameId = events[0].returnValues.id;

        const games = await battleship.getCreatedGamesIds.call();
        // console.log(games);

        const joinTx = await battleship.joinGameById(gameId, {'from':accounts[2]});
        // console.log(joinTx);
        const games2 = await battleship.getCreatedGamesIds.call();
        // console.log(games2);
    });
});