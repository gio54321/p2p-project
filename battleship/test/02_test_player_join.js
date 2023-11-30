var Battleship = artifacts.require('Battleship');

const utils = require('../utils/utils.js');

contract("Battleship", (accounts) => {
    it("should let another player join by id", async () => {
        const battleship = await Battleship.deployed();

        const gameId = await utils.createGame(battleship, accounts[1]);

        const games = await battleship.getCreatedGamesIds.call();
        assert.equal(games.length, 1, "Game has not been created");
        const joinTx = await battleship.joinGameById(gameId, {'from':accounts[2]});
        const games2 = await battleship.getCreatedGamesIds.call();
        assert.equal(games2.length, 0, "Game has not been removed");
    });

    it("should store the correct player addresses", async () => {
        const battleship = await Battleship.deployed();

        const gameId = await utils.createGame(battleship, accounts[1]);

        const games = await battleship.getCreatedGamesIds.call();
        assert.equal(games.length, 1, "Game has not been created");
        const joinTx = await battleship.joinGameById(gameId, {'from':accounts[2]});
        const players = await battleship.getGamePlayers(gameId);
        assert.equal(players['0'], accounts[1], "Player addresses not stored correctly");
        assert.equal(players['1'], accounts[2], "Player addresses not stored correctly");
    });

    it("should let a player join by id", async () => {
        const battleship = await Battleship.deployed();

        const game1Id = await utils.createGame(battleship, accounts[1]);
        const game2Id = await utils.createGame(battleship, accounts[1]);

        const games = await battleship.getCreatedGamesIds.call();
        assert.equal(games.length, 2, "Game has not been created");

        const joinTx = await battleship.joinGameById(game1Id, {'from':accounts[2]});
        const games2 = await battleship.getCreatedGamesIds.call();
        assert.equal(games2.length, 1, "Game has not been removed");
        assert.equal(games2[0], game2Id, "Game has not been deleted correctly");

        const joinTx2 = await battleship.joinGameById(game2Id, {'from':accounts[2]});
        const games3 = await battleship.getCreatedGamesIds.call();
        assert.equal(games3.length, 0, "Game has not been removed");
    });

    it("should delete the last element", async () => {
        const battleship = await Battleship.deployed();

        const game1Id = await utils.createGame(battleship, accounts[1]);
        const game2Id = await utils.createGame(battleship, accounts[1]);

        const games = await battleship.getCreatedGamesIds.call();
        assert.equal(games.length, 2, "Game has not been created");

        const joinTx = await battleship.joinGameById(game2Id, {'from':accounts[2]});
        const games2 = await battleship.getCreatedGamesIds.call();
        assert.equal(games2.length, 1, "Game has not been removed");
        assert.equal(games2[0], game1Id, "Game has not been deleted correctly");

        const joinTx2 = await battleship.joinGameById(game1Id, {'from':accounts[2]});
        const games3 = await battleship.getCreatedGamesIds.call();
        assert.equal(games3.length, 0, "Game has not been removed");
    });
    
    it("should delete in the middle", async () => {
        const battleship = await Battleship.deployed();

        const game1Id = await utils.createGame(battleship, accounts[1]);
        const game2Id = await utils.createGame(battleship, accounts[1]);
        const game3Id = await utils.createGame(battleship, accounts[1]);

        const games = await battleship.getCreatedGamesIds.call();
        assert.equal(games.length, 3, "Game has not been created");

        const joinTx = await battleship.joinGameById(game2Id, {'from':accounts[2]});
        const games2 = await battleship.getCreatedGamesIds.call();
        assert.equal(games2.length, 2, "Game has not been removed");
        const joinTx2 = await battleship.joinGameById(game1Id, {'from':accounts[2]});
        const games3 = await battleship.getCreatedGamesIds.call();
        assert.equal(games3.length, 1, "Game has not been removed");
        assert.equal(games3[0], game3Id, "Game has not been deleted correctly");

        const joinTx3 = await battleship.joinGameById(game3Id, {'from':accounts[2]});
        const games4 = await battleship.getCreatedGamesIds.call();
        assert.equal(games4.length, 0, "Game has not been removed");
    });
    
    it("should join random game", async () => {

        const battleship = await Battleship.deployed();

        const game1Id = await utils.createGame(battleship, accounts[1]);
        const game2Id = await utils.createGame(battleship, accounts[1]);
        const game3Id = await utils.createGame(battleship, accounts[1]);

        const games = await battleship.getCreatedGamesIds.call();
        assert.equal(games.length, 3, "Game has not been created");

        const joinTx = await battleship.joinRandomGame({'from':accounts[2]});
        const games2 = await battleship.getCreatedGamesIds.call();
        assert.equal(games2.length, 2, "Game has not been removed");

        const joinTx2 = await battleship.joinRandomGame({'from':accounts[2]});
        const games3 = await battleship.getCreatedGamesIds.call();
        assert.equal(games3.length, 1, "Game has not been removed");

        const joinTx3 = await battleship.joinRandomGame({'from':accounts[2]});
        const games4 = await battleship.getCreatedGamesIds.call();
        assert.equal(games4.length, 0, "Game has not been removed");
    });
    
    it("should work for mixed methods of joining games", async () => {
        const battleship = await Battleship.deployed();

        const game1Id = await utils.createGame(battleship, accounts[1]);
        const game2Id = await utils.createGame(battleship, accounts[1]);
        const game3Id = await utils.createGame(battleship, accounts[1]);

        const games = await battleship.getCreatedGamesIds.call();
        assert.equal(games.length, 3, "Game has not been created");

        const joinTx = await battleship.joinGameById(game2Id, {'from':accounts[2]});
        const games2 = await battleship.getCreatedGamesIds.call();
        assert.equal(games2.length, 2, "Game has not been removed");

        const joinTx2 = await battleship.joinRandomGame({'from':accounts[2]});
        const games3 = await battleship.getCreatedGamesIds.call();
        assert.equal(games3.length, 1, "Game has not been removed");

        const joinTx3 = await battleship.joinGameById(games3[0], {'from':accounts[2]});
        const games4 = await battleship.getCreatedGamesIds.call();
        assert.equal(games4.length, 0, "Game has not been removed");
    });

});