
var Battleship = artifacts.require('Battleship');

const utils = require('../utils/utils.js');

// clean room environment to test created games linked list functionality

contract("Battleship", (accounts) => {
    it("should compute the right Merkle root from a Merkle proof", async () => {
        const battleship = await Battleship.deployed();
        const board = [1, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1];
        const boardValues = board.map(utils.generateBoardValue);
        const commitments = boardValues.map(utils.generateCommitment);

        const root = utils.computeMerkleRoot(commitments);

        for (let i=0; i<board.length; ++i) {
            const proof = utils.computeMerkleProof(commitments, i);
            const rootComputedByContract = await battleship.computeMerkleRootFromProof.call(board.length, i, boardValues[i], proof);
            assert.equal(root, rootComputedByContract);
        }
    });
    it("should let players commit a root and some wei", async () => {
        const battleship = await Battleship.deployed();
        const board = [1, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1];
        const boardValues = board.map(utils.generateBoardValue);
        const commitments = boardValues.map(utils.generateCommitment);
        const root = utils.computeMerkleRoot(commitments);

        const gameId = await utils.createGame(battleship, accounts[1]);
        const joinTx = await battleship.joinGameById(gameId, {'from':accounts[2]});
        
        const players = await battleship.getGamePlayers(gameId);
        console.log(players)

        const commit1Tx = await battleship.commitBoard(gameId, root, {'from':accounts[1], value:web3.utils.toWei("42", 'lovelace')});
        let state = await battleship.getGamePhase.call(gameId);
        assert.equal(state, "WAITING_COMMITMENT", "Game phase is incorrect");

        const commit2Tx = await battleship.commitBoard(gameId, root, {'from':accounts[2], value:web3.utils.toWei("42", 'lovelace')});
        let state2 = await battleship.getGamePhase.call(gameId);
        assert.equal(state2, "WAITING_COMMITMENT", "Game phase is incorrect");
    });
});