import Web3 from 'web3';

import { web3 } from 'svelte-web3'
import { get } from 'svelte/store'


/**
 * 
 * @param {number} value (0 or 1)
 * @returns a 32-bytes hex string, the first 31 bytes are a cryptographically random hex string (nonce)
 *      and the last byte is the value
 */
export function generateBoardValue(value: 0 | 1) {
    if (value != 0 && value != 1) {
        throw new Error('You can generate commitments only for 0 and 1 values');
    }
    let utils = get(web3).utils;

    let input = utils.hexToBytes(utils.randomHex(32));
    input[31] = value;
    return utils.bytesToHex(input);
}

export function generateCommitment(value: 0 | 1): string {
    let result = get(web3).utils.soliditySha3(value);

    if (result === undefined) {
        throw Error("Sha3 returned undefined")
    }
    return result;
}

function computeMerkleRootRecursive(commitments: string[], start: number, stop: number): string {
    let utils = get(web3).utils;
    if (stop - start == 2) {
        const left = commitments[start];
        const right = commitments[start + 1];
        const hashInput = utils.bytesToHex(left.concat(right));
        const result = utils.soliditySha3(hashInput);
        if (result === undefined) {
            throw Error("Sha3 returned undefined")
        }
        return result;
    }

    const mid = (start + stop) / 2;
    const leftRoot = computeMerkleRootRecursive(commitments, start, mid);
    const rightRoot = computeMerkleRootRecursive(commitments, mid, stop)
    // TODO test if this is actually correct
    const hashInput = utils.bytesToHex(leftRoot.concat(rightRoot));
    const result = utils.soliditySha3(hashInput);
    if (result === undefined) {
        throw Error("Sha3 returned undefined")
    }
    return result;
}

export function computeMerkleRoot(commitments: string[]) {
    return computeMerkleRootRecursive(commitments, 0, commitments.length);
}

function computeMerkleProofRecursive(commitments: string[], position: number, start: number, stop: number): [string, string[]] {
    let utils = get(web3).utils;
    if (stop - start == 2) {
        const left = commitments[start];
        const right = commitments[start + 1];
        const hashInput = utils.bytesToHex(left.concat(right));
        const result = utils.soliditySha3(hashInput);
        if (result === undefined) {
            throw Error("Sha3 returned undefined")
        }

        let proof: string[] = [];
        if (start == position) {
            proof = [right];
        } else if (start + 1 == position) {
            proof = [left];
        }
        return [result, proof];
    }

    const mid = (start + stop) / 2;
    const [leftRoot, leftProof] = computeMerkleProofRecursive(commitments, position, start, mid);
    const [rightRoot, rightProof] = computeMerkleProofRecursive(commitments, position, mid, stop);
    const hashInput = utils.bytesToHex(leftRoot.concat(rightRoot));
    const result = utils.soliditySha3(hashInput);
    if (result === undefined) {
        throw Error("Sha3 returned undefined")
    }

    let proof: string[] = [];
    if (rightProof.length != 0) {
        rightProof.push(leftRoot);
        proof = rightProof;
    } else if (leftProof.length != 0) {
        leftProof.push(rightRoot);
        proof = leftProof;
    }

    return [result, proof];
}

export function computeMerkleProof(commitments: string[], position: number) {
    return computeMerkleProofRecursive(commitments, position, 0, commitments.length)[1];
}

export function computeMerkleProofFromValues(boardValues: (0 | 1)[], position: number) {
    const commitments = boardValues.map(generateCommitment);
    return computeMerkleProof(commitments, position);
}

