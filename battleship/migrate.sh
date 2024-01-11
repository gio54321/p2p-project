#!/bin/bash
mkdir -p ../frontend/src/lib/contracts &&\
    truffle migrate &&\
    cp build/contracts/Battleship.json ../frontend/src/lib/contracts/Battleship.json
