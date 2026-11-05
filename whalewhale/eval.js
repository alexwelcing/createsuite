"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { CELLS, GESTURES, reachable } = require("./reachable");

const PLACE = {
  Nw: [0, 1],
  Ne: [1, 1],
  Sw: [0, 0],
  Se: [1, 0],
};

const DELTA = {
  East: [1, 0],
  West: [-1, 0],
  North: [0, 1],
  South: [0, -1],
};

// Double for the energy seam: an allowed state, the candidate when it is one.
function energy(state, gesture, candidate) {
  const allowed = reachable(state, gesture);
  if (allowed.includes(candidate)) return candidate;
  return allowed[0];
}

// Double for the predict seam: one allowed next state for this drag.
function predict(state, gesture) {
  const allowed = reachable(state, gesture);
  return allowed[allowed.length - 1];
}

function accept(state, gesture, candidate) {
  const scored = energy(state, gesture, candidate);
  const predicted = predict(state, gesture);
  const allowed = reachable(state, gesture);
  return (
    allowed.includes(candidate) &&
    allowed.includes(scored) &&
    allowed.includes(predicted)
  );
}

function allowanceFromRule(state, gesture) {
  const [x, y] = PLACE[state];
  const [dx, dy] = DELTA[gesture];
  const neighbor = CELLS.find((cell) => {
    const [cx, cy] = PLACE[cell];
    return cx === x + dx && cy === y + dy;
  });
  return neighbor ? [state, neighbor] : [state];
}

function allowanceFromInk(source) {
  const pattern =
    /here == Cell\.(\w+) && step == Step\.(\w+) && \(result == Cell\.(\w+)(?: \|\| result == Cell\.(\w+))?\)/g;
  const found = {};
  let match = pattern.exec(source);
  while (match) {
    const cells = match[4] ? [match[3], match[4]] : [match[3]];
    found[match[1] + " " + match[2]] = cells;
    match = pattern.exec(source);
  }
  return found;
}

function run() {
  const behavior = fs
    .readFileSync(path.join(__dirname, "behavior.txt"), "utf8")
    .trim();
  assert.equal(behavior.split(/\n\s*\n/).length, 1, "behavior is one paragraph");
  assert.match(behavior, /Nw at \(0, 1\)/);
  assert.match(behavior, /Ne at \(1, 1\)/);
  assert.match(behavior, /Sw at \(0, 0\)/);
  assert.match(behavior, /Se at \(1, 0\)/);
  assert.match(behavior, /East increasing x/);
  assert.match(behavior, /North increasing y/);

  const ink = fs.readFileSync(path.join(__dirname, "window-drag.ink"), "utf8");
  const fromInk = allowanceFromInk(ink);
  assert.equal((ink.match(/\bfn\b/g) || []).length, 1, "one Ink function");
  assert.equal(
    (ink.match(/learn settle\(here, step\): choice<Cell>/g) || []).length,
    1,
    "one transition hole"
  );
  assert.match(accept.toString(), /energy\(state, gesture, candidate\)/);
  assert.match(accept.toString(), /predict\(state, gesture\)/);

  let accepted = 0;
  let rejected = 0;
  for (const state of CELLS) {
    for (const gesture of GESTURES) {
      const allowed = reachable(state, gesture);
      assert.deepStrictEqual(allowed, allowanceFromRule(state, gesture));
      assert.deepStrictEqual(fromInk[state + " " + gesture], allowed);

      const predicted = predict(state, gesture);
      assert.ok(allowed.includes(predicted), "predict returns an allowed state");
      for (const candidate of CELLS) {
        const scored = energy(state, gesture, candidate);
        assert.ok(allowed.includes(scored), "energy returns an allowed state");
        const ok = accept(state, gesture, candidate);
        assert.equal(ok, allowed.includes(candidate));
        if (ok) accepted += 1;
        else rejected += 1;
      }
    }
  }

  assert.equal(Object.keys(fromInk).length, CELLS.length * GESTURES.length);
  assert.ok(accepted > 0 && rejected > 0);
  console.log(
    "window-drag eval ok: " +
      accepted +
      " in-set candidates accepted, " +
      rejected +
      " others rejected"
  );
}

module.exports = { energy, predict, accept };

if (require.main === module) {
  run();
}
