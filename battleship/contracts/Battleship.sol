// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

// enumeration of all the possible game phases
enum GamePhaseEnum {
    CREATED,
    WAITING_COMMITMENT,
    WAITING_PLAYER_1_GUESS,
    WAITING_PLAYER_2_VALUE,
    WAITING_PLAYER_2_GUESS,
    WAITING_PLAYER_1_VALUE,
    WAITING_BOARD_REVEAL,
    WAITING_WINNINGS_CLAIM,
    FINISHED
}

// structure holding one cell guess
struct CellGuessStruct {
    uint16 x;
    uint16 y;
}

// structure holding the state of a player
struct PlayerStateStruct {
    address playerAddress;
    bytes32 committedBoardRoot;
    uint256 committedAmount;
    uint16 sunkShips;
    bool boardRevealed;
}

// structure holding the state of a game
struct GameStateStruct {
    uint16 boardSize;
    GamePhaseEnum gamePhase;
    PlayerStateStruct playerState1;
    PlayerStateStruct playerState2;
    CellGuessStruct currentGuess;
    // 0 -> no winner (default)
    // 1 -> player 1
    // 2 -> player 2
    uint8 winner;
    int256 createdPtr;
    address accuser;
    uint currentAccusationBlockNumber;
}

// Structure holding one ship placement. The ship is placed
// starting from the x, y coordinates and going in the direction
// specified by the direction field, for the length specified
struct ShipPlacementStruct {
    uint16 x;
    uint16 y;
    uint16 length;
    bool direction; // true -> horizontal, false -> vertical
}

contract Battleship {
    event GameCreated(address owner, uint256 id);
    event GameReady(address player2, uint256 id);
    event GameStarted(uint256 id);
    event GamePhaseChanged(uint256 id);
    event BoardValueRevealed(
        uint256 gameId,
        uint16 x,
        uint16 y,
        uint8 playerNumber,
        bool value
    );
    event IdleAccusation(uint256 gameId, address accusedPlayer);
    event AccusationResolved(uint256 gameId);

    // Array of all the games
    GameStateStruct[] games;

    // Indexes of the currently created games, used for O(1)
    // search of a random game
    uint256[] createdGames;

    // random counter
    uint256 randomCounter;

    constructor() {
        randomCounter = 0;
    }

    // Compute the log2 of a number
    // if the number is not a power of 2, returns 0, else returns the log2 of the number
    function log2(uint16 x) private pure returns (uint16) {
        uint16 result = 0;
        while (x > 1) {
            if (x % 2 != 0) {
                return 0;
            }
            x = x / 2;
            result += 1;
        }
        return result;
    }

    // Returns a random value in the range [0, b) based on the previous block hash
    // and the internal counter.
    // Every time it is called the value will be different
    function getRandomValue(uint256 b) private returns (uint256) {
        // get the previous block's hash
        bytes32 blockHash = blockhash(block.number - 1);

        // increment the counter, to make sure that each call to this function
        // returns a different value
        randomCounter += 1;
        uint256 randValue = uint256(
            keccak256(
                bytes.concat(
                    abi.encodePacked(blockHash),
                    abi.encodePacked(bytes32(randomCounter))
                )
            )
        );
        return randValue % b;
    }

    // Insert a game in the created games set
    function insertIntoCreatedGames(uint256 id) private {
        createdGames.push(id);
        games[id].createdPtr = int256(createdGames.length - 1);
    }

    // remove the game corresponding to gameId from the created games set
    function removeFromCreatedGames(uint256 gameId) private {
        require(
            games[gameId].createdPtr >= 0,
            "Game is not in the created games set"
        );
        uint256 createdIndex = uint256(games[gameId].createdPtr);

        if (createdIndex == createdGames.length - 1) {
            // this is the last element, just pop it
            // this branch handles also the case where the length is 1
            createdGames.pop();
        } else {
            // in this branch the element to be removed is in the middle of the array
            // so we remove this element from the created games,
            // swap the last element with this position
            // and update created pointer for that game
            uint256 newElement = createdGames[createdGames.length - 1];
            createdGames.pop();
            createdGames[createdIndex] = newElement;
            games[newElement].createdPtr = int256(createdIndex);
        }
    }

    // Create a new game with the specified board size
    function createGame(uint16 boardSize) public {
        require(
            boardSize == 8 || boardSize == 4,
            "Supported board sizes are 4 and 8"
        );

        // cacluate the game's id
        uint256 id = games.length;

        // create the initial game structure
        games.push(
            GameStateStruct(
                boardSize,
                GamePhaseEnum.CREATED,
                PlayerStateStruct(msg.sender, "", 0, 0, false),
                PlayerStateStruct(address(0), "", 0, 0, false),
                CellGuessStruct(0, 0),
                0,
                -1,
                address(0),
                0
            )
        );

        // insert this game in the created games
        insertIntoCreatedGames(id);

        // emit the GameCreated event with the newly created game's id
        emit GameCreated(msg.sender, id);
    }

    // Join a random game chosen by the contract
    function joinRandomGame() public {
        require(createdGames.length > 0, "No currently available games");

        // choose a random index in the createdGames array
        uint256 idx = getRandomValue(createdGames.length);
        uint256 gameId = createdGames[idx];

        // join the game by that id
        joinGameById(gameId);
    }

    // Join a game by its id
    function joinGameById(uint256 gameId) public {
        require(gameId < games.length, "Game with that id does not exists");
        require(
            games[gameId].gamePhase == GamePhaseEnum.CREATED,
            "Game already started"
        );

        // require that the second player is different than the first one
        require(
            games[gameId].playerState1.playerAddress != msg.sender,
            "The creator cannot join its own game"
        );

        // first remove it from the createdGames set
        removeFromCreatedGames(gameId);

        // store second player information
        games[gameId].gamePhase = GamePhaseEnum.WAITING_COMMITMENT;
        games[gameId].playerState2 = PlayerStateStruct(
            msg.sender,
            "",
            0,
            0,
            false
        );

        emit GameReady(msg.sender, gameId);
    }

    // Commit a board merkle tree root for the game with the specified id and some funds.
    // Also, start the game if the other player has already committed.
    function commitBoard(
        uint256 gameId,
        bytes32 boardMerkleTreeRoot
    ) public payable {
        require(gameId < games.length, "Game does not exist");
        require(
            games[gameId].gamePhase == GamePhaseEnum.WAITING_COMMITMENT,
            "This game is not expecting a commitment"
        );
        require(
            msg.sender == games[gameId].playerState1.playerAddress ||
                msg.sender == games[gameId].playerState2.playerAddress,
            "Only players of this game can commit"
        );

        // check that the player has committed some funds
        require(
            msg.value > 0,
            "You have to commit some wei to participate to the game"
        );

        // resolve any accusation if present
        resolveAccusationIfPresent(gameId);

        bool bothPlayersCommitted = false;

        // store the commitment in the correct player state struct

        if (msg.sender == games[gameId].playerState1.playerAddress) {
            require(
                games[gameId].playerState1.committedAmount == 0,
                "Player already committed"
            );
            if (games[gameId].playerState2.committedAmount > 0) {
                require(
                    msg.value == games[gameId].playerState2.committedAmount,
                    "The committed amounts have to be the same for both players"
                );
                bothPlayersCommitted = true;
            }
            games[gameId].playerState1.committedAmount = msg.value;
            games[gameId].playerState1.committedBoardRoot = boardMerkleTreeRoot;
        } else if (msg.sender == games[gameId].playerState2.playerAddress) {
            require(
                games[gameId].playerState2.committedAmount == 0,
                "Player already committed"
            );
            if (games[gameId].playerState1.committedAmount > 0) {
                require(
                    msg.value == games[gameId].playerState1.committedAmount,
                    "The committed amounts have to be the same for both players"
                );
                bothPlayersCommitted = true;
            }
            games[gameId].playerState2.committedAmount = msg.value;
            games[gameId].playerState2.committedBoardRoot = boardMerkleTreeRoot;
        }

        if (bothPlayersCommitted) {
            // choose first player at random by drawing a random number in [0, 2)
            uint256 firstPlayer = getRandomValue(2);
            if (firstPlayer == 0) {
                games[gameId].gamePhase = GamePhaseEnum.WAITING_PLAYER_1_GUESS;
            } else {
                games[gameId].gamePhase = GamePhaseEnum.WAITING_PLAYER_2_GUESS;
            }

            emit GameStarted(gameId);
        }
    }

    // Guess a cell in the board at coordinates (x, y)
    function guessCell(uint256 gameId, uint16 x, uint16 y) public {
        require(gameId < games.length, "Game does not exists");
        GameStateStruct memory game = games[gameId];

        require(
            game.gamePhase == GamePhaseEnum.WAITING_PLAYER_1_GUESS ||
                game.gamePhase == GamePhaseEnum.WAITING_PLAYER_2_GUESS,
            "Operation not supported for the current game state"
        );

        // resolve any accusation if present
        resolveAccusationIfPresent(gameId);

        // check coordinate bounds
        require(x < game.boardSize, "x must be in the board's bounds");
        require(y < game.boardSize, "y must be in the board's bounds");

        // check sender is consistent with phase
        // and go to next state
        address guesser = msg.sender;
        if (game.gamePhase == GamePhaseEnum.WAITING_PLAYER_1_GUESS) {
            require(
                guesser == game.playerState1.playerAddress,
                "Only the correct player can guess a cell"
            );
            games[gameId].gamePhase = GamePhaseEnum.WAITING_PLAYER_2_VALUE;
        } else {
            require(
                guesser == game.playerState2.playerAddress,
                "Only the correct player can guess a cell"
            );
            games[gameId].gamePhase = GamePhaseEnum.WAITING_PLAYER_1_VALUE;
        }

        // store the guess
        games[gameId].currentGuess.x = x;
        games[gameId].currentGuess.y = y;

        emit GamePhaseChanged(gameId);
    }

    // Compute the merkle root of a tree with the specified board size from the
    // provided input data and merkle proof.
    function computeMerkleRootFromProof(
        uint256 boardSize,
        uint16 position,
        bytes32 inputData,
        bytes32[] calldata merkleProof
    ) public pure returns (bytes32) {
        require(
            boardSize == 8 || boardSize == 4,
            "Only 4x4 and 8x8 boards are supported"
        );

        // Merkle proof length has to be log2(boardSize * boardSize)
        uint16 boardSizeLog = log2(uint16(boardSize * boardSize));
        require(boardSizeLog != 0, "Incorrect board size");
        require(merkleProof.length == boardSizeLog, "Incorrect proof length");

        // compute the first value commitment
        bytes32 currHash = keccak256(abi.encodePacked(inputData));

        // navigate upwards the merkle tree, computing the hashes
        // of the intermediate nodes up to the root
        bytes memory hashInput;
        for (uint256 i = 0; i < boardSizeLog; ++i) {
            if (position % 2 == 0) {
                hashInput = bytes.concat(
                    abi.encodePacked(currHash),
                    abi.encodePacked(merkleProof[i])
                );
            } else {
                hashInput = bytes.concat(
                    abi.encodePacked(merkleProof[i]),
                    abi.encodePacked(currHash)
                );
            }
            currHash = keccak256(hashInput);
            position = position / 2; // rounds towards zero
        }

        // the last computed hash is the root
        return currHash;
    }

    // Compute the merkle root of a tree with the specified board size from the
    // provided board.
    function computeMerkleRootFromBoard(
        uint16 boardSize,
        bytes32[] calldata board
    ) public pure returns (bytes32) {
        uint16 boardSizeLog = log2(boardSize * boardSize);
        require(boardSizeLog != 0, "Incorrect board size");
        require(
            board.length == boardSize * boardSize,
            "Incorrect input data length"
        );

        bytes32[] memory buffer = new bytes32[](boardSize * boardSize);

        // first, compute the hashes of the leaves
        for (uint256 i = 0; i < boardSize * boardSize; ++i) {
            buffer[i] = keccak256(abi.encodePacked(board[i]));
        }

        // compute the hashes of the intermediate nodes, they are stored always
        // in the first part of the buffer
        for (uint256 i = boardSizeLog; i > 0; --i) {
            for (uint256 j = 0; j < (1 << i); j += 2) {
                buffer[j / 2] = keccak256(
                    bytes.concat(
                        abi.encodePacked(buffer[j]),
                        abi.encodePacked(buffer[j + 1])
                    )
                );
            }
        }

        // at the end, the root is stored in the first position of the buffer
        return buffer[0];
    }

    // Reveal a value in the board at coordinates (x, y), by providing its corresponding Merkle proof
    function revealValue(
        uint256 gameId,
        uint16 x,
        uint16 y,
        bytes32 revealedValue,
        bytes32[] calldata merkleProof
    ) public {
        // check gameId
        require(gameId < games.length, "Game does not exists");

        // resolve any accusation if present
        resolveAccusationIfPresent(gameId);

        GameStateStruct memory game = games[gameId];

        require(
            game.gamePhase == GamePhaseEnum.WAITING_PLAYER_1_VALUE ||
                game.gamePhase == GamePhaseEnum.WAITING_PLAYER_2_VALUE,
            "Operation not supported for the current game state"
        );

        // check sender is consistent with the current phase
        if (game.gamePhase == GamePhaseEnum.WAITING_PLAYER_1_VALUE) {
            require(
                msg.sender == game.playerState1.playerAddress,
                "Only the correct player can reveal a value"
            );
        } else {
            require(
                msg.sender == game.playerState2.playerAddress,
                "Only the correct player can reveal a value"
            );
        }

        // check that the revealed value is the one requested in the current guess
        require(
            x == game.currentGuess.x,
            "x coordinate does not match guessed one"
        );
        require(
            y == game.currentGuess.y,
            "y coordinate does not match guessed one"
        );

        // the actual board value is the last significant byte of the revealed value,
        // the rest is the nonce.
        uint8 cellValue = uint8(uint256(revealedValue) % 256);
        require(
            cellValue == 1 || cellValue == 0,
            "Board value can be only 0 or 1"
        );

        // check that the merkle proof is correct, to ensure that the revealed value
        // is consistent with the board commitment
        bytes32 computedRoot = computeMerkleRootFromProof(
            game.boardSize,
            y * game.boardSize + x,
            revealedValue,
            merkleProof
        );

        // check that the computed root is the same as the one committed for the revealing player
        // if it is a hit, increment the number of sunk ships for the player
        // if the other player has sunk all the ships, declare it as the winner
        // and go to the board reveal phase
        if (game.gamePhase == GamePhaseEnum.WAITING_PLAYER_1_VALUE) {
            require(
                computedRoot == game.playerState1.committedBoardRoot,
                "Merkle proof is not correct"
            );
            if (cellValue == 1) {
                game.playerState1.sunkShips += 1;
            }
            if (
                game.playerState1.sunkShips ==
                getNumberOfOccupiedCells(game.boardSize)
            ) {
                game.winner = 2;
                game.gamePhase = GamePhaseEnum.WAITING_BOARD_REVEAL;
            } else {
                game.gamePhase = GamePhaseEnum.WAITING_PLAYER_1_GUESS;
            }
        } else {
            require(
                computedRoot == game.playerState2.committedBoardRoot,
                "Merkle proof is not correct"
            );
            if (cellValue == 1) {
                game.playerState2.sunkShips += 1;
            }
            if (
                game.playerState2.sunkShips ==
                getNumberOfOccupiedCells(game.boardSize)
            ) {
                game.winner = 1;
                game.gamePhase = GamePhaseEnum.WAITING_BOARD_REVEAL;
            } else {
                game.gamePhase = GamePhaseEnum.WAITING_PLAYER_2_GUESS;
            }
        }

        // update the game
        games[gameId] = game;

        // emit that the game phase has changed
        emit GamePhaseChanged(gameId);

        // emit also that a value has been revealed
        uint8 playerNumber = getPlayerGameNumber(gameId, msg.sender);
        emit BoardValueRevealed(gameId, x, y, playerNumber, cellValue == 1);
    }

    // Returns the number of occupied cells in a board of the specified size
    // this is based on a fixed allocation of ships by the game rules
    function getNumberOfOccupiedCells(
        uint16 boardSize
    ) public pure returns (uint16) {
        require(
            boardSize == 8 || boardSize == 4,
            "Supported board sizes are 4 and 8"
        );

        if (boardSize == 8) {
            // 5 + 4 + 3 + 3 + 2 = 17
            return 17;
        } else {
            // 3 + 2 + 2 = 7
            return 7;
        }
    }

    // Reveal a board by providing the board itself and the ships placement.
    // The ships items must be in decreasing order of length in order for the
    // check to pass.
    function revealBoard(
        uint256 gameId,
        bytes32[] calldata board,
        ShipPlacementStruct[] calldata ships
    ) public {
        require(gameId < games.length, "Game does not exists");
        GameStateStruct memory game = games[gameId];

        require(
            game.gamePhase == GamePhaseEnum.WAITING_BOARD_REVEAL,
            "Operation not supported for the current game state"
        );

        // this should never be false if the
        require(game.winner != 0, "No winner has been declared yet");

        // resolve any accusation if present
        resolveAccusationIfPresent(gameId);

        // check board size
        require(
            board.length == game.boardSize * game.boardSize,
            "Incorrect board size"
        );

        // check that the ships have been placed legally on the board
        require(
            checkShipPlacement(game.boardSize, board, ships),
            "Incorrect ship placement"
        );

        // compute the Merkle root from the provided board
        bytes32 computedRoot = computeMerkleRootFromBoard(
            game.boardSize,
            board
        );

        // check that the computed root is the same as the one committed for the revealing player
        if (msg.sender == game.playerState1.playerAddress) {
            require(
                computedRoot == game.playerState1.committedBoardRoot,
                "Merkle root is not correct"
            );

            game.playerState1.boardRevealed = true;
        } else {
            require(
                computedRoot == game.playerState2.committedBoardRoot,
                "Merkle root is not correct"
            );
            game.playerState2.boardRevealed = true;
        }

        // if both players have revealed their boards, go to the next phase
        if (
            game.playerState1.boardRevealed && game.playerState2.boardRevealed
        ) {
            game.gamePhase = GamePhaseEnum.WAITING_WINNINGS_CLAIM;
            emit GamePhaseChanged(gameId);
        }

        // update the game
        games[gameId] = game;
    }

    // check that the ships have been placed legally on the board, and that the ships description
    // is consistent with the provided board. This is implemented by "simulating" the placement of
    // the ships on the board and checking bounds and that there are no overlapping ships. Then
    // the provided board is checked to be the same as the one obtained by the "simulation".
    function checkShipPlacement(
        uint16 boardSize,
        bytes32[] calldata board,
        ShipPlacementStruct[] calldata ships
    ) public pure returns (bool) {
        require(boardSize == 8 || boardSize == 4, "Incorrect board size");
        require(board.length == boardSize * boardSize, "Incorrect board size");

        // check ship lengths, must be provided by the caller in decreasing order
        // for the check to pass
        if (boardSize == 8) {
            if (ships.length != 5) {
                return false;
            }

            if (
                ships[0].length != 5 ||
                ships[1].length != 4 ||
                ships[2].length != 3 ||
                ships[3].length != 3 ||
                ships[4].length != 2
            ) {
                return false;
            }
        } else {
            if (ships.length != 3) {
                return false;
            }
            if (
                ships[0].length != 3 ||
                ships[1].length != 2 ||
                ships[2].length != 2
            ) {
                return false;
            }
        }

        // check that the ships are valid in the board
        // and there are no overlapping ships
        bool[] memory newBoard = new bool[](boardSize * boardSize);
        for (uint256 i = 0; i < ships.length; ++i) {
            ShipPlacementStruct memory ship = ships[i];
            if (ship.direction) {
                // horizontal
                if (ship.x + ship.length > boardSize) {
                    return false;
                }
                for (uint256 j = 0; j < ship.length; ++j) {
                    if (newBoard[ship.y * boardSize + ship.x + j]) {
                        return false;
                    }
                    newBoard[ship.y * boardSize + ship.x + j] = true;
                }
            } else {
                // vertical
                if (ship.y + ship.length > boardSize) {
                    return false;
                }
                for (uint256 j = 0; j < ship.length; ++j) {
                    if (newBoard[(ship.y + j) * boardSize + ship.x]) {
                        return false;
                    }
                    newBoard[(ship.y + j) * boardSize + ship.x] = true;
                }
            }
        }

        // check that the provided board is the same
        for (uint256 i = 0; i < boardSize * boardSize; ++i) {
            bool boardValue = uint8(uint256(board[i]) % 256) == 1;
            if (boardValue && !newBoard[i]) {
                return false;
            }
        }

        return true;
    }

    // Accuse the other player of being idle
    function accuseIdle(uint256 gameId) public {
        require(gameId < games.length, "Game does not exists");
        require(
            games[gameId].accuser == address(0),
            "An accusation is already present"
        );

        GamePhaseEnum phase = games[gameId].gamePhase;

        // the player can accuse only if it is currently waiting for the other player
        // to perform an action, this is:
        // - guess a cell
        // - reveal a value
        // - commit a board and the accusing player has already committed a board
        // - reveal a board and the accusing player has already revealed a board
        if (msg.sender == games[gameId].playerState1.playerAddress) {
            require(
                phase == GamePhaseEnum.WAITING_PLAYER_2_GUESS ||
                    phase == GamePhaseEnum.WAITING_PLAYER_2_VALUE ||
                    (phase == GamePhaseEnum.WAITING_BOARD_REVEAL &&
                        games[gameId].playerState1.boardRevealed) ||
                    (phase == GamePhaseEnum.WAITING_COMMITMENT &&
                        games[gameId].playerState1.committedAmount > 0),
                "You cannot accuse the other player at this time"
            );
        } else {
            require(
                phase == GamePhaseEnum.WAITING_PLAYER_1_GUESS ||
                    phase == GamePhaseEnum.WAITING_PLAYER_1_VALUE ||
                    (phase == GamePhaseEnum.WAITING_BOARD_REVEAL &&
                        games[gameId].playerState2.boardRevealed) ||
                    (phase == GamePhaseEnum.WAITING_COMMITMENT &&
                        games[gameId].playerState2.committedAmount > 0),
                "You cannot accuse the other player at this time"
            );
        }

        // store the accusation
        games[gameId].accuser = msg.sender;
        games[gameId].currentAccusationBlockNumber = block.number;

        // emit the accusation event
        address accusedPlayer;
        if (msg.sender == games[gameId].playerState1.playerAddress) {
            accusedPlayer = games[gameId].playerState2.playerAddress;
        } else {
            accusedPlayer = games[gameId].playerState1.playerAddress;
        }
        emit IdleAccusation(gameId, accusedPlayer);
    }

    // Resolve an accusation if present, the accusation is simply erased
    function resolveAccusationIfPresent(uint256 gameId) private {
        require(gameId < games.length, "Game does not exists");
        if (games[gameId].accuser != address(0)) {
            games[gameId].accuser = address(0);
            games[gameId].currentAccusationBlockNumber = 0;
        }
    }

    // Claim the reward for an accusation if the other player has not performed
    // any action for 5 blocks
    function claimAccusationReward(uint256 gameId) public {
        // check game state
        require(gameId < games.length, "Game does not exists");
        require(
            games[gameId].accuser != address(0),
            "There is no accusation to claim"
        );
        require(
            games[gameId].gamePhase != GamePhaseEnum.FINISHED,
            "Game is finished"
        );
        require(
            msg.sender == games[gameId].accuser,
            "Only the accuser can claim the reward"
        );

        if (block.number - games[gameId].currentAccusationBlockNumber > 5) {
            // avoid reentrancy by setting the game phase to finished before
            // sending the reward
            games[gameId].gamePhase = GamePhaseEnum.FINISHED;
            games[gameId].winner = getPlayerGameNumber(gameId, msg.sender);
            payable(msg.sender).transfer(
                games[gameId].playerState1.committedAmount +
                    games[gameId].playerState2.committedAmount
            );
            emit GamePhaseChanged(gameId);
        }
    }

    // Claim the reward for winning a game
    function claimWinningReward(uint256 gameId) public {
        require(
            games[gameId].gamePhase == GamePhaseEnum.WAITING_WINNINGS_CLAIM,
            "Game is not finished yet"
        );
        require(
            games[gameId].winner == getPlayerGameNumber(gameId, msg.sender),
            "You are not the winner of this game"
        );

        // avoid reentrancy by setting the game phase to finished before
        // sending the reward
        games[gameId].gamePhase = GamePhaseEnum.FINISHED;
        payable(msg.sender).transfer(
            games[gameId].playerState1.committedAmount +
                games[gameId].playerState2.committedAmount
        );
        emit GamePhaseChanged(gameId);
    }

    // Get the ids of all the currently created games
    function getCreatedGamesIds() public view returns (uint256[] memory) {
        return createdGames;
    }

    // Get the addresses of all the owners of the currently created games
    function getCreatedGamesOwners() public view returns (address[] memory) {
        address[] memory result = new address[](createdGames.length);
        for (uint i = 0; i < createdGames.length; ++i) {
            result[i] = games[createdGames[i]].playerState1.playerAddress;
        }
        return result;
    }

    // Get a string of the current game phase
    function getGamePhase(uint256 gameId) public view returns (string memory) {
        require(gameId < games.length, "Game does not exists");
        GamePhaseEnum gamePhase = games[gameId].gamePhase;
        if (gamePhase == GamePhaseEnum.CREATED) {
            return "CREATED";
        } else if (gamePhase == GamePhaseEnum.WAITING_COMMITMENT) {
            return "WAITING_COMMITMENT";
        } else if (gamePhase == GamePhaseEnum.WAITING_PLAYER_1_GUESS) {
            return "WAITING_PLAYER_1_GUESS";
        } else if (gamePhase == GamePhaseEnum.WAITING_PLAYER_2_GUESS) {
            return "WAITING_PLAYER_2_GUESS";
        } else if (gamePhase == GamePhaseEnum.WAITING_PLAYER_1_VALUE) {
            return "WAITING_PLAYER_1_VALUE";
        } else if (gamePhase == GamePhaseEnum.WAITING_PLAYER_2_VALUE) {
            return "WAITING_PLAYER_2_VALUE";
        } else if (gamePhase == GamePhaseEnum.WAITING_BOARD_REVEAL) {
            return "WAITING_BOARD_REVEAL";
        } else if (gamePhase == GamePhaseEnum.WAITING_WINNINGS_CLAIM) {
            return "WAITING_WINNINGS_CLAIM";
        } else if (gamePhase == GamePhaseEnum.FINISHED) {
            return "FINISHED";
        } else {
            return "";
        }
    }

    // get the addresses of the players in the game
    function getGamePlayers(
        uint256 gameId
    ) public view returns (address, address) {
        require(gameId < games.length, "Game does not exists");
        return (
            games[gameId].playerState1.playerAddress,
            games[gameId].playerState2.playerAddress
        );
    }

    // get the x and y coordinates of the current guess
    function getCurrentGuess(
        uint256 gameId
    ) public view returns (uint16, uint16) {
        require(gameId < games.length, "Game does not exists");
        return (games[gameId].currentGuess.x, games[gameId].currentGuess.y);
    }

    // get the board size of the game
    function getBoardSize(uint256 gameId) public view returns (uint16) {
        require(gameId < games.length, "Game does not exists");
        return games[gameId].boardSize;
    }

    //Returns the number of the player in the game
    // returns 0 if the player is not in the game, 1 if it is player 1, 2 if it is player 2
    function getPlayerGameNumber(
        uint256 gameId,
        address player
    ) public view returns (uint8) {
        require(gameId < games.length, "Game does not exists");
        if (player == games[gameId].playerState1.playerAddress) {
            return 1;
        } else if (player == games[gameId].playerState2.playerAddress) {
            return 2;
        } else {
            require(false, "Player is not in the game");
            return 0; // this is never reached, but the compiler complains
        }
    }

    // get the winner of the game, returns 0 if there is no winner yet
    function getWinner(uint256 gameId) public view returns (uint8) {
        require(gameId < games.length, "Game does not exists");
        return games[gameId].winner;
    }
}
