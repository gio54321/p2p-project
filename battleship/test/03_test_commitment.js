
var Battleship = artifacts.require('Battleship');

const utils = require('../utils/utils.js');

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

        const commit1Tx = await battleship.commitBoard(gameId, root, {'from':accounts[1], value:web3.utils.toWei("42", 'lovelace')});
        let state = await battleship.getGamePhase.call(gameId);
        assert.equal(state, "WAITING_COMMITMENT", "Game phase is incorrect");

        const commit2Tx = await battleship.commitBoard(gameId, root, {'from':accounts[2], value:web3.utils.toWei("42", 'lovelace')});
        let state2 = await battleship.getGamePhase.call(gameId);
        assert.equal(state2, "WAITING_PLAYER_1_GUESS", "Game phase is incorrect");
    });

    it("should let players reveal the correct value", async () => {
        const battleship = await Battleship.deployed();
        const board1 = [1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 1];
        const boardValues1 = board1.map(utils.generateBoardValue);
        const board2 = [0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0];
        const boardValues2 = board2.map(utils.generateBoardValue);

        const gameId = await utils.setupTestGame(battleship, accounts[2], accounts[3], boardValues1, boardValues2);
        let state = await battleship.getGamePhase.call(gameId);
        assert.equal(state, "WAITING_PLAYER_1_GUESS", "Game phase is incorrect");        

        let guessTx = await battleship.guessCell(gameId, web3.utils.BN("0"), web3.utils.BN("0"), {'from':accounts[2]});
        state = await battleship.getGamePhase.call(gameId);
        assert.equal(state, "WAITING_PLAYER_2_VALUE", "Game phase is incorrect");        
        
        const proof = utils.computeMerkleProofFromValues(boardValues2, 0);
        let revealTx = await battleship.revealValue(gameId, web3.utils.BN("0"), web3.utils.BN("0"), boardValues2[0], proof, {'from':accounts[3]});
        console.log(revealTx);
    });
});