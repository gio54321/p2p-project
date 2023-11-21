// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;


enum GamePhaseEnum {
  CREATED,
  WAITING_PLAYER_1_GUESS,
  WAITING_PLAYER_2_VALUE,
  WAITING_PLAYER_2_GUESS,
  WAITING_PLAYER_1_VALUE,
  FINISHED
}

struct PlayerStateStruct {
  address playerAddress;
  bytes32 committedBoardRoot;
}

struct GameStateStruct {
  GamePhaseEnum gamePhase;
  PlayerStateStruct playerState1;
  PlayerStateStruct playerState2;
}


contract Battleship {
  uint256 counter;

  event GameCreated(uint256 id);
  mapping (uint256 => GameStateStruct) games;

  constructor() {
    counter = 0;
  }

  function createGame() public {
    // cacluate the game's id
    uint256 id = counter;
    counter = counter + 1;

    // create the game struct
    games[id] = GameStateStruct(
      GamePhaseEnum.CREATED,
      PlayerStateStruct(msg.sender, ""),
      PlayerStateStruct(address(0), "")
    );

    // return the newly created game's id
    emit GameCreated(id);
  }

  function joinRandomGame() public {

  }

  function joinGameById(uint256 gameId) public {

  }

  function commitBoard(uint256 gameId, uint256 boardMerkleTreeRoot) public payable {
    // check gameId
    // store merkletreeroot
    // store amount paid
    // check if other player has paid 
    // if not, do nothing, else check if the amounts are the same
    // if not, repay the two players, else go to WAITING_PLAYER_1_GUESS
  }

  function guessCell(uint256 gameId, uint16 x, uint16 y) public {
    // check gameId
    // check sender is consistent with phase
    // check coordinate bounds 
    // check (?)
    // go to WAITING_PLAYER_2_VALUE
  }

  function revealValue(uint256 gameId, uint16 x, uint16 y, uint256[] calldata merkleProof) public {
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
}
