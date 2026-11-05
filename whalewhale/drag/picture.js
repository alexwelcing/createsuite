import { createElement } from "react";
import { translate } from "dragology";

// One cell of the pictured grid, in the same coordinates the fixture names.
const PITCH = 80;
const WINDOW = 36;

const PLACED = [
  { cell: "Nw", x: 0, y: 1 },
  { cell: "Ne", x: 1, y: 1 },
  { cell: "Sw", x: 0, y: 0 },
  { cell: "Se", x: 1, y: 0 },
];

const STEP = {
  East: [1, 0],
  West: [-1, 0],
  North: [0, 1],
  South: [0, -1],
};

function placedAt(x, y) {
  return PLACED.find((cell) => cell.x === x && cell.y === y);
}

// States this drag may reach: the cell the window is on, and the pictured
// cell one step along the gesture when that step stays on the grid.
function futures(cell, gesture) {
  const here = PLACED.find((place) => place.cell === cell);
  if (!here) throw new Error("picture has no cell " + cell);
  const step = STEP[gesture];
  if (!step) throw new Error("picture has no gesture " + gesture);
  const [dx, dy] = step;
  const neighbor = placedAt(here.x + dx, here.y + dy);
  const cells = neighbor ? [here.cell, neighbor.cell] : [here.cell];
  return cells.map((name) => ({ cell: name }));
}

// Picture of the window on the grid. The drag names its future states.
export function windowPicture(gesture) {
  return function picture({ state, d }) {
    const here = PLACED.find((place) => place.cell === state.cell);
    if (!here) throw new Error("picture has no cell " + state.cell);
    return createElement(
      "g",
      { id: "board" },
      PLACED.map((place) =>
        createElement("rect", {
          id: "cell-" + place.cell,
          transform: translate(place.x * PITCH, place.y * PITCH),
          width: PITCH,
          height: PITCH,
          fill: "#f7f4ee",
          stroke: "#c8c2b4",
        }),
      ),
      createElement(
        "g",
        {
          id: "window",
          transform: translate(here.x * PITCH, here.y * PITCH),
          dragologyOnDrag: () => d.closest(futures(state.cell, gesture)),
        },
        createElement("rect", {
          width: WINDOW,
          height: WINDOW,
          fill: "#fffdf8",
          stroke: "#1c1a17",
        }),
      ),
    );
  };
}
