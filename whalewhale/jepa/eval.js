"use strict";

const { CELLS, GESTURES } = require("../reachable");
const { accept } = require("../eval");
const { predict, loadWeights } = require("./model");

// Scores learned predict(state, gesture) with the fixture accept rule.
// Coverage is the drags the fixture eval iterates. The answer table is not copied.

function run() {
  loadWeights();
  const lines = [];
  let accepted = 0;
  let changed = 0;
  for (const state of CELLS) {
    for (const gesture of GESTURES) {
      const next = predict(state, gesture);
      const ok = accept(state, gesture, next);
      if (ok) accepted += 1;
      if (next !== state) changed += 1;
      lines.push(
        state + " " + gesture + " -> " + next + (ok ? " accept" : " reject")
      );
    }
  }
  const total = CELLS.length * GESTURES.length;
  const ok = accepted === total;
  const summary = ok
    ? "window-drag jepa eval ok: " +
      accepted +
      "/" +
      total +
      " decoded next states accepted (" +
      changed +
      " change cell)"
    : "window-drag jepa eval failed: " +
      accepted +
      "/" +
      total +
      " decoded next states accepted";
  console.log(lines.join("\n"));
  console.log(summary);
  return ok;
}

module.exports = { run };

if (require.main === module) {
  let ok = false;
  try {
    ok = run();
  } catch (error) {
    console.error(error && error.message ? error.message : error);
  }
  process.exit(ok ? 0 : 1);
}
