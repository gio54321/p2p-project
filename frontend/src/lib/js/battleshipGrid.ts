import { derived, writable } from 'svelte/store';
import { allowedShips, boardSize } from './battleship';

export type BoardValues = number[];
  
export type Ship = {
    pos: number,
    isHorizontal: number,
};

function createShips() {
    let initialShips = Array(allowedShips.length).fill(null);
	const { subscribe, update } = writable<(Ship | null)[]>(initialShips);

	return {
		subscribe,
        setShip: (id: number, pos: number, isHorizontal: number) => {
            if (id < 0 || id >= allowedShips.length) {
                return;
            }
            
            update((arr) => {
                arr[id] = {'pos': pos, 'isHorizontal':isHorizontal};
                return arr;
            });
        },
        removeShip: (id: number) => {
            if (id < 0 || id >= allowedShips.length) {
                return;
            }
            
            update((arr) => {
                arr[id] = null;
                return arr;
            });
        }
	};
}

export const boardShips = createShips();

export const boardValues = derived(boardShips, (ships) =>{
    let board = [];
    for (let i = 0; i < boardSize * boardSize; i++) {
        board.push(0);
    }

    for (let i in ships) {
        let ship = ships[i];
        if (ship !== null) {
            for (let j = 0; j < allowedShips[i].length; j++) {
                board[ship.pos + j*(1 + ship.isHorizontal*7)] = 1;
            }
        }
    }
    return board;
});
