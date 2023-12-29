
var Battleship = artifacts.require('Battleship');

const utils = require('../utils/utils.js');

contract("Battleship", (accounts) => {
    it("should validate a board", async () => {
        const battleship = await Battleship.deployed();
        const board = [
            1, 1, 1, 0,
            0, 0, 0, 1,
            0, 1, 1, 1,
            0, 0, 0, 0];
        const boardValues = board.map(utils.generateBoardValue);

        const ships = [
            { x: 0, y: 0, length: 3, direction: true },
            { x: 1, y: 2, length: 2, direction: true },
            { x: 3, y: 1, length: 2, direction: false }
        ]

        const boardValid = await battleship.checkShipPlacement.call(4, boardValues, ships);
        assert.equal(boardValid, true, "Board is invalid");
    });

    it("should reject an intersection", async () => {
        const battleship = await Battleship.deployed();
        const board = [
            1, 1, 1, 0,
            0, 0, 0, 1,
            0, 1, 1, 1,
            0, 0, 0, 0];
        const boardValues = board.map(utils.generateBoardValue);

        const ships = [
            { x: 0, y: 0, length: 3, direction: true },
            { x: 0, y: 2, length: 2, direction: false },
            { x: 3, y: 1, length: 2, direction: false }
        ]

        const boardValid = await battleship.checkShipPlacement.call(4, boardValues, ships);
        assert.equal(boardValid, false, "Board is invalid");
    });

    it("should reject an out of bounds in x direction", async () => {
        const battleship = await Battleship.deployed();
        const board = [
            1, 1, 1, 0,
            0, 0, 0, 1,
            0, 1, 1, 1,
            0, 0, 0, 0];
        const boardValues = board.map(utils.generateBoardValue);

        const ships = [
            { x: 2, y: 0, length: 3, direction: true }, // out of bounds
            { x: 2, y: 2, length: 2, direction: false },
            { x: 3, y: 1, length: 2, direction: false }
        ]

        const boardValid = await battleship.checkShipPlacement.call(4, boardValues, ships);
        assert.equal(boardValid, false, "Board is invalid");
    });

    it("should reject an out of bounds in y direction", async () => {
        const battleship = await Battleship.deployed();
        const board = [
            1, 1, 1, 0,
            0, 0, 0, 1,
            0, 1, 1, 1,
            0, 0, 0, 0];
        const boardValues = board.map(utils.generateBoardValue);
        const ships = [
            { x: 0, y: 2, length: 3, direction: false }, // out of bounds
            { x: 2, y: 2, length: 2, direction: false },
            { x: 3, y: 1, length: 2, direction: false }
        ]
        const boardValid = await battleship.checkShipPlacement.call(4, boardValues, ships);
        assert.equal(boardValid, false, "Board is invalid");
    });

    it("should reject if the board is not the same", async () => {
        const battleship = await Battleship.deployed();
        const board = [
            1, 1, 1, 0,
            0, 0, 0, 0,
            0, 1, 1, 1,
            0, 0, 0, 1];
        const boardValues = board.map(utils.generateBoardValue);
        const ships = [
            { x: 0, y: 0, length: 3, direction: true },
            { x: 1, y: 2, length: 2, direction: true },
            { x: 3, y: 1, length: 2, direction: false }
        ]
        const boardValid = await battleship.checkShipPlacement.call(4, boardValues, ships);
        assert.equal(boardValid, false, "Board is invalid");
    });

    it("should validate an 8x8 board", async () => {
        const battleship = await Battleship.deployed();
        const board = [
            1, 1, 1, 1, 1, 0, 0, 0,
            0, 1, 1, 1, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            1, 0, 0, 0, 0, 0, 0, 0,
            1, 0, 0, 0, 0, 0, 0, 1,
            1, 0, 0, 0, 0, 0, 0, 1,
            0, 0, 0, 1, 0, 0, 0, 1,
            0, 0, 0, 1, 0, 0, 0, 1];
        const boardValues = board.map(utils.generateBoardValue);
        const ships = [
            { x: 0, y: 0, length: 5, direction: true },
            { x: 7, y: 4, length: 4, direction: false },
            { x: 1, y: 1, length: 3, direction: true },
            { x: 0, y: 3, length: 3, direction: false },
            { x: 3, y: 6, length: 2, direction: false }
        ]
        const boardValid = await battleship.checkShipPlacement.call(8, boardValues, ships);
        assert.equal(boardValid, true, "Board is invalid");
    });
});
