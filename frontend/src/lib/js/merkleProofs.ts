import { web3 } from 'svelte-web3'
import { get } from 'svelte/store'


// utility functions to concatenate two Uint8Arrays
function concatenateBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
    let result = new Uint8Array(a.length + b.length);
    result.set(a);
    result.set(b, a.length);
    return result;
}

// generate the board values, which are 32-bytes hex strings
// the first 31 bytes are a cryptographically random hex string (nonce)
// and the last byte is the provided value
export function generateBoardValue(value: 0 | 1) {
    if (value != 0 && value != 1) {
        throw new Error('You can generate commitments only for 0 and 1 values');
    }
    let utils = get(web3).utils;

    let input = utils.hexToBytes(utils.randomHex(32));
    input[31] = value;
    return utils.bytesToHex(input);
}

// generate the commitment for a given board value, by
// computing the sha3 hash of the value
export function generateCommitment(value: string): string {
    let utils = get(web3).utils;

    let result = utils.soliditySha3(value);

    if (result === undefined) {
        throw Error("Sha3 returned undefined")
    }
    return result;
}

function computeMerkleRootRecursive(commitments: string[], start: number, stop: number): string {
    let utils = get(web3).utils;
    if (stop - start == 2) {
        // base case, compute the hash of the concatenation of the two leaves
        const left = commitments[start];
        const right = commitments[start + 1];
        const hashInput = utils.bytesToHex(concatenateBytes(utils.hexToBytes(left), utils.hexToBytes(right)));
        const result = utils.soliditySha3(hashInput);
        if (result === undefined) {
            throw Error("Sha3 returned undefined")
        }
        return result;
    }

    // recursive case, recursively compute the hash of the concatenation of the two subtrees
    const mid = (start + stop) / 2;
    const leftRoot = computeMerkleRootRecursive(commitments, start, mid);
    const rightRoot = computeMerkleRootRecursive(commitments, mid, stop)
    const hashInput = utils.bytesToHex(concatenateBytes(utils.hexToBytes(leftRoot), utils.hexToBytes(rightRoot)));
    const result = utils.soliditySha3(hashInput);
    if (result === undefined) {
        throw Error("Sha3 returned undefined")
    }
    return result;
}

// compute the merkle root of a list of commitments
export function computeMerkleRoot(commitments: string[]) {
    return computeMerkleRootRecursive(commitments, 0, commitments.length);
}

// recursive function to compute the merkle proof of a commitment
// given the list of commitments and the position of the commitment
// returns the merkle root and the proof for that subtree
function computeMerkleProofRecursive(commitments: string[], position: number, start: number, stop: number): [string, string[]] {
    let utils = get(web3).utils;
    if (stop - start == 2) {
        // base case
        const left = commitments[start];
        const right = commitments[start + 1];
        const hashInput = utils.bytesToHex(concatenateBytes(utils.hexToBytes(left), utils.hexToBytes(right)));
        const result = utils.soliditySha3(hashInput);
        if (result === undefined) {
            throw Error("Sha3 returned undefined")
        }

        // if the position is the left leaf, return the right leaf as proof
        // or if the position is the right leaf, return the left leaf as proof
        let proof: string[] = [];
        if (start == position) {
            proof = [right];
        } else if (start + 1 == position) {
            proof = [left];
        }
        return [result, proof];
    }

    // recursive case
    const mid = (start + stop) / 2;
    const [leftRoot, leftProof] = computeMerkleProofRecursive(commitments, position, start, mid);
    const [rightRoot, rightProof] = computeMerkleProofRecursive(commitments, position, mid, stop);
    const hashInput = utils.bytesToHex(concatenateBytes(utils.hexToBytes(leftRoot), utils.hexToBytes(rightRoot)));
    const result = utils.soliditySha3(hashInput);
    if (result === undefined) {
        throw Error("Sha3 returned undefined")
    }

    // if the position we are computing the Merkle proof is in the right subtree,
    // append the left subtree root to the current proof, or viceversa
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

// compute the merkle proof for a position in a list of commitments
export function computeMerkleProof(commitments: string[], position: number) {
    return computeMerkleProofRecursive(commitments, position, 0, commitments.length)[1];
}
