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

  event GameCreated(bytes32 id);
  mapping (bytes32 => GameStateStruct) games;

  constructor() {
    counter = 0;
  }

  function createGame() public {
    bytes32 id = keccak256(bytes.concat(abi.encode(msg.sender), abi.encode(counter)));
    counter += 1;
    emit GameCreated(id);
  }
}
