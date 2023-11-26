// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;


enum GamePhaseEnum {
	CREATED,
	WAITING_COMMITMENT,
	WAITING_PLAYER_1_GUESS,
	WAITING_PLAYER_2_VALUE,
	WAITING_PLAYER_2_GUESS,
	WAITING_PLAYER_1_VALUE,
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
}

struct GameStateStruct {
	uint16 board_size;
	GamePhaseEnum gamePhase;
	PlayerStateStruct playerState1;
	PlayerStateStruct playerState2;
	CellGuessStruct currentGuess;

	int256 prevCreated;
	int256 nextCreated;
}

contract Battleship {
	event GameCreated(address owner, uint256 id);
	event GameReady(address player2, uint256 id);

	// Array of all the games
	GameStateStruct[] games;

	// Indexes of the head and tail of the currently created games, used for O(1)
	// search of a random game
	int256 createdGamesHead = -1;
	int256 createdGamesTail = -1;

	// utils LUT for computing log2 of a power of 2
	mapping(uint16 => uint16) log2LUT;

	constructor() {
		createdGamesHead = -1;
		createdGamesTail = -1;

		log2LUT[4] = 2;
		log2LUT[16] = 4;
		log2LUT[64] = 6;
		log2LUT[256] = 8;
	}

	function insertIntoCreatedGames(uint256 id) private {
		// insert the game games[id] at the end of the linked list
		// of created games

		if (createdGamesHead < 0 && createdGamesTail < 0) {
			// the linked list is currently empty, insert only this id
			createdGamesHead = int256(id);
			createdGamesTail = int256(id);
			games[id].nextCreated = -1;
			games[id].prevCreated = -1;
		} else {
			// insert at the end of the list
			games[uint256(createdGamesTail)].nextCreated = int256(id);      
			games[id].prevCreated = createdGamesTail;
			createdGamesTail = int256(id);
		}
	}

	function popFromCreatedGames() private returns (int256) {
		// remove a node from the head of the created games list, if it is empty return -1
		// else return the id of the removed node
		
		if (createdGamesHead < 0 && createdGamesTail < 0) {
			return -1;
		}

		uint256 toRemoveId = uint256(createdGamesHead);
		createdGamesHead = games[toRemoveId].nextCreated;

		// clean up all fields in the removed node
		games[toRemoveId].nextCreated = -1;
		games[toRemoveId].prevCreated = -1;

		// check if the list is empty, if it is clean also the tail pointer
		if (createdGamesHead < 0) {
			createdGamesHead = -1;
			createdGamesTail = -1;
		}

		return int256(toRemoveId);
	}

	function removeFromCreatedGames(uint256 gameId) private {
		// remove the game corresponding to gameId from the created games linked list
		// ASSUMES: that the node is in the linked list

		if (createdGamesHead == int256(gameId) && createdGamesTail == int256(gameId)) {
			// the node is the only one in the list
			createdGamesHead = -1;
			createdGamesTail = -1;
		} else {
			// the node is in some position inside the list
			if(games[gameId].nextCreated == -1) {
				createdGamesTail = games[gameId].prevCreated;
			} else {
				games[uint256(games[gameId].nextCreated)].prevCreated = games[gameId].prevCreated;
			}

			if(games[gameId].prevCreated == -1) {
				createdGamesHead = games[gameId].nextCreated;
			} else {
				games[uint256(games[gameId].prevCreated)].nextCreated = games[gameId].nextCreated;
			}
		}

		// clean up all fields in the removed node
		games[gameId].nextCreated = -1;
		games[gameId].prevCreated = -1;

		// check if the list is empty, if it is clean also the tail pointer
		if (createdGamesHead < 0) {
			createdGamesHead = -1;
			createdGamesTail = -1;
		}
	}

	function createGame() public {
		// cacluate the game's id
		uint256 id = games.length;

		// create the game struct
		games.push(GameStateStruct(
			8, // TODO make this parametric?
			GamePhaseEnum.CREATED,
			PlayerStateStruct(msg.sender, "", 0),
			PlayerStateStruct(address(0), "", 0),
			CellGuessStruct(0, 0),
			-1,
			-1
		));

		// insert this game in the created games linked list
		insertIntoCreatedGames(id);

		// emit the GameCreated event with the newly created game's id
		emit GameCreated(msg.sender, id);
	}

	function joinRandomGame() public {
		int256 removedGameIndex = popFromCreatedGames();
		require(removedGameIndex >= 0, "No games available to join");

		// join the game by that id
		joinGamePlayer2ById(uint256(removedGameIndex), msg.sender);
	}

	function getCreatedGamesIds() public view returns (uint256[] memory) {

		// first calculate the length of the linked list
		int256 cur = createdGamesHead;
		uint256 createdGamesLen = 0;
		while(cur >= 0) {
			createdGamesLen += 1;
			cur = games[uint256(cur)].nextCreated;
		}
		
		// store the 
		uint256[] memory result = new uint256[](createdGamesLen);
		uint256 i = 0;
		cur = createdGamesHead;
		while(cur >= 0) {
			result[i] = uint256(cur);
			i += 1;
			cur = games[uint256(cur)].nextCreated;
		}
		return result;
	}

	function joinGameById(uint256 gameId) public {
		require(gameId < games.length, "Game with that id does not exists");

		// TODO if a game is deleted??!? I don't care ftm
		require(games[gameId].gamePhase == GamePhaseEnum.CREATED, "Game already started");
		removeFromCreatedGames(gameId);
		joinGamePlayer2ById(gameId, msg.sender);
	}

	function joinGamePlayer2ById(uint256 gameId, address player2) private {
		// make a player join a game
		// it is assumed that the game has been already removed from the created games linked list

		require(gameId < games.length, "Game with that id does not exists");
		require(games[gameId].gamePhase == GamePhaseEnum.CREATED, "Game already started");

		games[gameId].gamePhase = GamePhaseEnum.WAITING_COMMITMENT;
		games[gameId].playerState2 = PlayerStateStruct(player2, "", 0);

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
		require(x < game.board_size, "x must be in the board's bounds");
		require(y < game.board_size, "y must be in the board's bounds");

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
	}

	function computeMerkleRootFromProof(uint256 boardSize, uint16 position, bytes32 inputData, bytes32[] calldata merkleProof)
			public view returns (bytes32) {
		uint16 boardSizeLog = log2LUT[uint16(boardSize)];
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

	function revealValue(uint256 gameId, uint16 x, uint16 y, bytes32[] calldata merkleProof) public {
		// check gameId
		// check sender is consistent with phase
		// check coordinate bounds 
		// check provided coordinates are the ones requested
		// check merkle proof
		// check winning condition -> finished and pay amounts
		// check legal board state (?) probably not
		// check (?)
		// go to WAITING_PLAYER_2_GUESS
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
		} else {
			return "TODO"; //TODO
		}
	}

	function getGamePlayers(uint256 gameId) public view returns (address, address) {
		require(gameId < games.length, "Game does not exists");
		return (games[gameId].playerState1.playerAddress, games[gameId].playerState2.playerAddress);
	}
}
