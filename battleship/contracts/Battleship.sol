// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;


enum GamePhaseEnum {
	CREATED,
	WAITING_COMMITMENT,
	WAITING_PLAYER_1_GUESS,
	WAITING_PLAYER_2_VALUE,
	WAITING_PLAYER_2_GUESS,
	WAITING_PLAYER_1_VALUE,
	WAITING_BOARD_REVEAL,
	FINISHED
}

struct CellGuessStruct {
	uint16 x;
	uint16 y;
}

struct PlayerStateStruct {
	address playerAddress;
	bytes32 committedBoardRoot;
	uint256 committedAmount;
	uint16 sunkShips;
}

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
}

contract Battleship {
	//TODO this is variable with board size
	uint16 constant TOTAL_SHIPS_ON_BOARD = 6;

	event GameCreated(address owner, uint256 id);
	event GameReady(address player2, uint256 id);
	event GameStarted(uint256 id);
	event GamePhaseChanged(uint256 id);
	event BoardValueRevealed(uint256 gameId, uint16 x, uint16 y, uint16 playerNumber, bool value);

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

	function log2(uint16 x) private pure returns (uint16) {
		// returns the log2 of x, rounded down
		// if x is not a power of 2, returns 0
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

	function getRandomValue(uint256 b) private returns (uint256) {
		// returns a random value in the range [0, b)
		// based on the previous block hash
		// and the internal counter
		// every time it is called the value will be different
		//
		// NOTE: this random generation can be biased for some choices of b
		// because this function generates a uniform number in the range [0, 2^256-1]
		// and then applies the modulo b operation.
		// If for example b = 2^255 + 2^254 then the values in the range [0, 2^254-1] are
		// twice as likely to be drawn w.r.t. the other values. For smaller choices of b, this effect
		// is reduced and can be considered negligible.

		bytes32 blockHash = blockhash(block.number-1);
		randomCounter += 1;
		uint256 randValue = uint256(keccak256(bytes.concat(
					abi.encodePacked(blockHash),
					abi.encodePacked(bytes32(randomCounter))
				)));
		return randValue % b;
	}

	function insertIntoCreatedGames(uint256 id) private {
		createdGames.push(id);
		games[id].createdPtr = int256(createdGames.length - 1);
	}

	function removeFromCreatedGames(uint256 gameId) private {
		// remove the game corresponding to gameId from the created games set
		require(games[gameId].createdPtr >= 0, "Game is not in the created games set");
		uint256 createdIndex = uint256(games[gameId].createdPtr);

		if (createdIndex == createdGames.length - 1){
			// this is the last element, just pop it
			// this handles also the case where the length is 1
			createdGames.pop();
		} else {
			// remove this element from the created games
			// swap the last element with this position
			// and update created pointer for that game
			uint256 newElement = createdGames[createdGames.length - 1];
			createdGames.pop();
			createdGames[createdIndex] = newElement;
			games[newElement].createdPtr = int256(createdIndex);
		}
	}

	function createGame() public {
		// cacluate the game's id
		uint256 id = games.length;

		// create the game struct
		games.push(GameStateStruct(
			8, // TODO make this parametric?
			GamePhaseEnum.CREATED,
			PlayerStateStruct(msg.sender, "", 0, 0),
			PlayerStateStruct(address(0), "", 0, 0),
			CellGuessStruct(0, 0),
			0,
			-1
		));

		// insert this game in the created games linked list
		insertIntoCreatedGames(id);

		// emit the GameCreated event with the newly created game's id
		emit GameCreated(msg.sender, id);
	}

	function joinRandomGame() public {
		require(createdGames.length > 0, "No currently available games");
		uint256 idx = getRandomValue(createdGames.length);
		uint256 gameId = createdGames[idx];

		// join the game by that id
		joinGamePlayer2ById(gameId, msg.sender);
	}

	function getCreatedGamesIds() public view returns (uint256[] memory) {
		return createdGames;
	}

	function getCreatedGamesOwners() public view returns (address[] memory) {
        address[] memory result = new address[](createdGames.length);
        for (uint i=0; i < createdGames.length; ++i) {
            result[i] = games[createdGames[i]].playerState1.playerAddress;
        }
        return result;
	}

	function joinGameById(uint256 gameId) public {
		require(gameId < games.length, "Game with that id does not exists");

		// TODO if a game is deleted??!? I don't care ftm
		require(games[gameId].gamePhase == GamePhaseEnum.CREATED, "Game already started");
		joinGamePlayer2ById(gameId, msg.sender);
	}

	function joinGamePlayer2ById(uint256 gameId, address player2) private {
		// make a player join a game
		require(gameId < games.length, "Game with that id does not exists");
		require(games[gameId].gamePhase == GamePhaseEnum.CREATED, "Game already started");

        // require that the second player is different than the first one
        require(games[gameId].playerState1.playerAddress != msg.sender, "The creator cannot join its own game");

		// first remove it from the createdGames set
		removeFromCreatedGames(gameId);

		// store second player information
		games[gameId].gamePhase = GamePhaseEnum.WAITING_COMMITMENT;
		games[gameId].playerState2 = PlayerStateStruct(player2, "", 0, 0);

		emit GameReady(player2, gameId);
	}

	function commitBoard(uint256 gameId, bytes32 boardMerkleTreeRoot) public payable {
		// check gameId
		require(gameId < games.length, "Game does not exist");
		require(games[gameId].gamePhase == GamePhaseEnum.WAITING_COMMITMENT, "This game is not expecting a commitment");
		require(msg.sender == games[gameId].playerState1.playerAddress || msg.sender == games[gameId].playerState2.playerAddress,
			"Only players of this game can commit");
		
		require(msg.value > 0, "You have to commit some wei to participate to the game");

		bool bothPlayersCommitted = false;

		if (msg.sender == games[gameId].playerState1.playerAddress) {
			require(games[gameId].playerState1.committedAmount == 0, "Player already committed");
			if (games[gameId].playerState2.committedAmount > 0) {
				require(msg.value == games[gameId].playerState2.committedAmount, "The committed amounts have to be the same for both players");
				bothPlayersCommitted = true;
			} 
			games[gameId].playerState1.committedAmount = msg.value;
			games[gameId].playerState1.committedBoardRoot = boardMerkleTreeRoot;
		} else if (msg.sender == games[gameId].playerState2.playerAddress) {
			require(games[gameId].playerState2.committedAmount == 0, "Player already committed");
			if (games[gameId].playerState1.committedAmount > 0) {
				require(msg.value == games[gameId].playerState1.committedAmount, "The committed amounts have to be the same for both players");
				bothPlayersCommitted = true;
			} 
			games[gameId].playerState2.committedAmount = msg.value;
			games[gameId].playerState2.committedBoardRoot = boardMerkleTreeRoot;
		}

		if (bothPlayersCommitted) {
			// TODO some kind of randomization to who starts?
			games[gameId].gamePhase = GamePhaseEnum.WAITING_PLAYER_1_GUESS;
			emit GameStarted(gameId);
		}
	}

	function guessCell(uint256 gameId, uint16 x, uint16 y) public {
		// check gameId
		require(gameId < games.length, "Game does not exists");
		GameStateStruct memory game = games[gameId];

		require(
			game.gamePhase == GamePhaseEnum.WAITING_PLAYER_1_GUESS || 
			game.gamePhase == GamePhaseEnum.WAITING_PLAYER_2_GUESS,
			"Operation not supported for the current game state");

		// check coordinate bounds 
		require(x < game.boardSize, "x must be in the board's bounds");
		require(y < game.boardSize, "y must be in the board's bounds");

		// check sender is consistent with phase
		// and go to next state
		address guesser = msg.sender;
		if(game.gamePhase == GamePhaseEnum.WAITING_PLAYER_1_GUESS) {
			require(guesser == game.playerState1.playerAddress, "Only the correct player can guess a cell");
			games[gameId].gamePhase = GamePhaseEnum.WAITING_PLAYER_2_VALUE;
		} else {
			require(guesser == game.playerState2.playerAddress, "Only the correct player can guess a cell");
			games[gameId].gamePhase = GamePhaseEnum.WAITING_PLAYER_1_VALUE;
		}

		// store the guess
		games[gameId].currentGuess.x = x;
		games[gameId].currentGuess.y = y;

		emit GamePhaseChanged(gameId);
	}

	function computeMerkleRootFromProof(uint256 boardSize, uint16 position, bytes32 inputData, bytes32[] calldata merkleProof)
			public pure returns (bytes32) {
		uint16 boardSizeLog = log2(uint16(boardSize*boardSize));
		require(boardSizeLog != 0, "Incorrect board size");
		require(merkleProof.length == boardSizeLog, "Incorrect proof length");

		bytes32 currHash = keccak256(abi.encodePacked(inputData));
		bytes memory hashInput;
		for(uint256 i=0; i < boardSizeLog; ++i) {
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
		return currHash;
	}

	function revealValue(uint256 gameId, uint16 x, uint16 y, bytes32 revealedValue, bytes32[] calldata merkleProof) public {
		// check gameId
		require(gameId < games.length, "Game does not exists");
		GameStateStruct memory game = games[gameId];

		require(
			game.gamePhase == GamePhaseEnum.WAITING_PLAYER_1_VALUE || 
			game.gamePhase == GamePhaseEnum.WAITING_PLAYER_2_VALUE,
			"Operation not supported for the current game state");
		
		// check sender is consistent with phase
		if (game.gamePhase == GamePhaseEnum.WAITING_PLAYER_1_VALUE) {
			require(msg.sender == game.playerState1.playerAddress, "Only the correct player can reveal a value");
		} else {
			require(msg.sender == game.playerState2.playerAddress, "Only the correct player can reveal a value");
		}

		require(x == game.currentGuess.x, "x coordinate does not match guessed one");
		require(y == game.currentGuess.y, "y coordinate does not match guessed one");

		uint8 cellValue = uint8(uint256(revealedValue) % 256);
		require(cellValue == 1 || cellValue == 0, "Board value can be only 0 or 1");

		// check merkle proof
		bytes32 computedRoot = computeMerkleRootFromProof(game.boardSize,
			y * game.boardSize + x,
			revealedValue,
			merkleProof);
		
		if (game.gamePhase == GamePhaseEnum.WAITING_PLAYER_1_VALUE) {
			require(computedRoot == game.playerState1.committedBoardRoot, "Merkle proof is not correct");
			if (cellValue == 1) {
				game.playerState1.sunkShips += 1;
			}
			if (game.playerState1.sunkShips == TOTAL_SHIPS_ON_BOARD) {
				game.winner = 2;
				game.gamePhase = GamePhaseEnum.WAITING_BOARD_REVEAL;
			} else {
				game.gamePhase = GamePhaseEnum.WAITING_PLAYER_1_GUESS;
			}
		} else {
			require(computedRoot == game.playerState2.committedBoardRoot, "Merkle proof is not correct");
			if (cellValue == 1) {
				game.playerState1.sunkShips += 1;
			}
			if (game.playerState2.sunkShips == TOTAL_SHIPS_ON_BOARD) {
				game.winner = 1;
				game.gamePhase = GamePhaseEnum.WAITING_BOARD_REVEAL;
			} else {
				game.gamePhase = GamePhaseEnum.WAITING_PLAYER_2_GUESS;
			}
		}

		// TODO refactora sta cosa pls
		// io del futuro: no
		// terza volta che vedo sto todo: no
		games[gameId] = game;

		emit GamePhaseChanged(gameId);

		uint16 playerNumber = getPlayerGameNumber(gameId, msg.sender);
		emit BoardValueRevealed(gameId, x, y, playerNumber, cellValue == 1);
	}

	function accuseIdle(uint256 gameId) public {
		// check game state
		// emit event
	}

	function claimReward(uint256 gameId) public {
		// reward is claimed if either a game has finished and the msg.sender is the winner
		// or there is an unresolved accusation for that game, initiated more than 5 blocks ago.
	}

	function getGamePhase(uint256 gameId) public view returns (string memory) {
		require(gameId < games.length, "Game does not exists");
		GamePhaseEnum gamePhase = games[gameId].gamePhase;
		if (gamePhase == GamePhaseEnum.CREATED) {
			return "CREATED";
		} else if (gamePhase == GamePhaseEnum.WAITING_COMMITMENT){
			return "WAITING_COMMITMENT";
		} else if (gamePhase == GamePhaseEnum.WAITING_PLAYER_1_GUESS){
			return "WAITING_PLAYER_1_GUESS";
		} else if (gamePhase == GamePhaseEnum.WAITING_PLAYER_2_GUESS){
			return "WAITING_PLAYER_2_GUESS";
		} else if (gamePhase == GamePhaseEnum.WAITING_PLAYER_1_VALUE){
			return "WAITING_PLAYER_1_VALUE";
		} else if (gamePhase == GamePhaseEnum.WAITING_PLAYER_2_VALUE){
			return "WAITING_PLAYER_2_VALUE";
		} else if (gamePhase == GamePhaseEnum.WAITING_BOARD_REVEAL){
			return "WAITING_BOARD_REVEAL";
		} else if (gamePhase == GamePhaseEnum.FINISHED){
			return "FINISHED";
		} else {
			return "";
		}
	}

	function getGamePlayers(uint256 gameId) public view returns (address, address) {
		require(gameId < games.length, "Game does not exists");
		return (games[gameId].playerState1.playerAddress, games[gameId].playerState2.playerAddress);
	}

	function getCurrentGuess(uint256 gameId) public view returns (uint16, uint16) {
		require(gameId < games.length, "Game does not exists");
		return (games[gameId].currentGuess.x, games[gameId].currentGuess.y);
	}

	function getBoardSize(uint256 gameId) public view returns (uint16) {
		require(gameId < games.length, "Game does not exists");
		return games[gameId].boardSize;
	}

	/**
	 * Returns the number of the player in the game
	 * @param gameId The id of the game
	 * @param player The address of the player
	 * @return 0 if the player is not in the game, 1 if it is player 1, 2 if it is player 2
	 */
	function getPlayerGameNumber(uint256 gameId, address player) public view returns (uint16) {
		require(gameId < games.length, "Game does not exists");
		if (player == games[gameId].playerState1.playerAddress) {
			return 1;
		} else if (player == games[gameId].playerState2.playerAddress) {
			return 2;
		} else {
			return 0;
		}
	}
}
