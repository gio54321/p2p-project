async function createGame(battleship, account) {
    const gameTx = await battleship.createGame(4, {'from': account});
    let events = await battleship.getPastEvents('GameCreated', {
        fromBlock:gameTx.receipt.blockNumber,
    });
    for (let e of events) {
        if (e.returnValues.owner == account) {
            return events[0].returnValues.id;
        }
    }
    return undefined;
}

async function setupTestGame(battleship, account1, account2, values1, values2) {
    const commitment1 = values1.map(generateCommitment);
    const commitment2 = values2.map(generateCommitment);
    const root1 = computeMerkleRoot(commitment1);
    const root2 = computeMerkleRoot(commitment2);

    const gameId = await createGame(battleship, account1);
    const joinTx = await battleship.joinGameById(gameId, {'from':account2});

    const commit1Tx = await battleship.commitBoard(gameId, root1, {'from':account1, value:web3.utils.toWei("42", 'lovelace')});
    const commit2Tx = await battleship.commitBoard(gameId, root2, {'from':account2, value:web3.utils.toWei("42", 'lovelace')});
    return gameId;
}

/**
 * 
 * @param {number} value 
 * @returns a 32-bytes hex string, the first 31 bytes are a cryptographically random hex string (nonce)
 *      and the last byte is the value
 */
function generateBoardValue(value) {
    if (value != 0 && value != 1) {
        throw new Error('You can generate commitments only for 0 and 1 values');
    }

    let input = web3.utils.hexToBytes(web3.utils.randomHex(32));
    input[31] = value
    return web3.utils.bytesToHex(input);
}

function generateCommitment(value) {
    return web3.utils.soliditySha3(value);
}

function computeMerkleRootRecursive(commitments, start, stop) {
    if (stop - start == 2) {
        const left = commitments[start];
        const right = commitments[start+1];
        const hashInput = web3.utils.bytesToHex(web3.utils.hexToBytes(left).concat(web3.utils.hexToBytes(right)));
        const result = web3.utils.soliditySha3(hashInput);
        return result;
    }

    const mid = (start+stop)/2;
    const leftRoot = computeMerkleRootRecursive(commitments, start, mid);
    const rightRoot = computeMerkleRootRecursive(commitments, mid, stop)
    const hashInput = web3.utils.bytesToHex(web3.utils.hexToBytes(leftRoot).concat(web3.utils.hexToBytes(rightRoot)));
    const result = web3.utils.soliditySha3(hashInput);
    return result;
}

function computeMerkleRoot(commitments) {
    return computeMerkleRootRecursive(commitments, 0, commitments.length);
}


function computeMerkleProofRecursive(commitments, position, start, stop) {
    if (stop - start == 2) {
        const left = commitments[start];
        const right = commitments[start+1];
        const hashInput = web3.utils.bytesToHex(web3.utils.hexToBytes(left).concat(web3.utils.hexToBytes(right)));
        const result = web3.utils.soliditySha3(hashInput);


        let proof = [];
        if (start == position) {
            proof = [right];
        } else if (start + 1 == position) {
            proof = [left];
        }
        return [result, proof];
    }

    const mid = (start+stop)/2;
    const [leftRoot, leftProof] = computeMerkleProofRecursive(commitments, position, start, mid);
    const [rightRoot, rightProof] = computeMerkleProofRecursive(commitments, position, mid, stop);
    const hashInput = web3.utils.bytesToHex(web3.utils.hexToBytes(leftRoot).concat(web3.utils.hexToBytes(rightRoot)));
    const result = web3.utils.soliditySha3(hashInput);

    let proof = [];
    if (rightProof.length != 0) {
        rightProof.push(leftRoot);
        proof = rightProof;
    } else if (leftProof.length != 0) {
        leftProof.push(rightRoot);
        proof = leftProof;
    }

    return [result, proof];
}

function computeMerkleProof(commitments, position) {
    return computeMerkleProofRecursive(commitments, position, 0, commitments.length)[1];
}

function computeMerkleProofFromValues(boardValues, position) {
    const commitments = boardValues.map(generateCommitment);
    return computeMerkleProof(commitments, position);
}


exports.createGame = createGame;
exports.setupTestGame = setupTestGame;
exports.generateCommitment = generateCommitment;
exports.generateBoardValue = generateBoardValue;
exports.computeMerkleRoot = computeMerkleRoot;
exports.computeMerkleProof = computeMerkleProof;
exports.computeMerkleProofFromValues = computeMerkleProofFromValues;