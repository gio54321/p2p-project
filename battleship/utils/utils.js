async function createGame(battleship, account) {
    const gameTx = await battleship.createGame({'from': account});
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


exports.createGame = createGame;
exports.generateCommitment = generateCommitment;
exports.generateBoardValue = generateBoardValue;
exports.computeMerkleRoot = computeMerkleRoot;
exports.computeMerkleProof = computeMerkleProof;