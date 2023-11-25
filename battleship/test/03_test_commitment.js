
var Battleship = artifacts.require('Battleship');

const utils = require('../utils/utils.js');

// clean room environment to test created games linked list functionality

contract("Battleship", (accounts) => {
    it("should compute the right Merkle root from a Merkle proof", async () => {
        const battleship = await Battleship.deployed();
        const board = [1, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1];
        const boardValues = board.map(utils.generateBoardValue);
        // console.log(boardValues);
        const commitments = boardValues.map(utils.generateCommitment);
        // console.log(commitments);

        const root = utils.computeMerkleRoot(commitments);
        // console.log('root', root);

        for (let i=0; i<board.length; ++i) {
            const proof = utils.computeMerkleProof(commitments, i);
            // console.log(proof);

            const rootComputedByContract = await battleship.computeMerkleRootFromProof.call(board.length, i, boardValues[i], proof);
            // console.log('result from contract', rootComputedByContract);
            assert.equal(root, rootComputedByContract);
        }


    });

});