import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const fixtureDir = fileURLToPath(new URL("..", import.meta.url));
const { energy, predict, accept } = require(path.join(fixtureDir, "eval.js"));
const { CELLS, GESTURES } = require(path.join(fixtureDir, "reachable.js"));

export const name = "window-drag";

export function apply() {
  let accepted = 0;
  let rejected = 0;
  for (const state of CELLS) {
    for (const gesture of GESTURES) {
      for (const candidate of CELLS) {
        energy(state, gesture, candidate);
        predict(state, gesture);
        if (accept(state, gesture, candidate)) accepted += 1;
        else rejected += 1;
      }
    }
  }
  console.log(
    "[window-drag] " +
      accepted +
      " in-set candidates accepted, " +
      rejected +
      " others rejected"
  );
}
