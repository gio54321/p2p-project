
var Battleship = artifacts.require('Battleship');

const utils = require('../utils/utils.js');

// clean room environment to test created games linked list functionality

contract("Battleship", (accounts) => {
    it("should let two players commit", async () => {
        const battleship = await Battleship.deployed();

        const gameId = await utils.createGame(battleship, accounts[1]);
        const joinTx = await battleship.joinGameById(gameId, {'from':accounts[2]});

        const gamePhase = await battleship.getGamePhase.call(gameId);

        console.log(gamePhase);


    });

});