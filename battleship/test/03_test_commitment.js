
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

});