"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { POSITIONS, GESTURES, reachable } = require("./reachable");

// Double for the energy seam: an allowed position, the candidate when it is one.
function energy(state, gesture, candidate) {
  const allowed = reachable(state, gesture);
  if (allowed.includes(candidate)) return candidate;
  return allowed[0];
}

// Double for the predict seam: one allowed next position for this tap.
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

// A tap proposes the other position.
function allowanceFromRule(state, gesture) {
  if (gesture !== "Tap") throw new Error("unknown gesture " + gesture);
  const others = POSITIONS.filter((position) => position !== state);
  if (others.length !== 1) throw new Error("unknown position " + state);
  return others;
}

function allowanceFromInk(source) {
  const pattern =
    /here == Position\.(\w+) && tap == Gesture\.(\w+) && \(result == Position\.(\w+)(?: \|\| result == Position\.(\w+))?\)/g;
  const found = {};
  let match = pattern.exec(source);
  while (match) {
    const positions = match[4] ? [match[3], match[4]] : [match[3]];
    found[match[1] + " " + match[2]] = positions;
    match = pattern.exec(source);
  }
  return found;
}

function run() {
  const behavior = fs
    .readFileSync(path.join(__dirname, "behavior.txt"), "utf8")
    .trim();
  assert.equal(behavior.split(/\n\s*\n/).length, 1, "behavior is one paragraph");
  assert.match(behavior, /two positions, Up and Down/);
  assert.match(behavior, /tap proposes the other position/);
  assert.match(behavior, /From Up the reachable next position is Down/);
  assert.match(behavior, /from Down the reachable next position is Up/);

  const ink = fs.readFileSync(path.join(__dirname, "shade.ink"), "utf8");
  const fromInk = allowanceFromInk(ink);
  assert.equal((ink.match(/\bfn\b/g) || []).length, 1, "one Ink function");
  assert.equal(
    (ink.match(/learn settle\(here, tap\): choice<Position>/g) || []).length,
    1,
    "one transition hole"
  );
  assert.match(accept.toString(), /energy\(state, gesture, candidate\)/);
  assert.match(accept.toString(), /predict\(state, gesture\)/);

  let accepted = 0;
  let rejected = 0;
  for (const state of POSITIONS) {
    for (const gesture of GESTURES) {
      const allowed = reachable(state, gesture);
      assert.deepStrictEqual(allowed, allowanceFromRule(state, gesture));
      assert.deepStrictEqual(fromInk[state + " " + gesture], allowed);

      const predicted = predict(state, gesture);
      assert.ok(allowed.includes(predicted), "predict returns an allowed position");
      for (const candidate of POSITIONS) {
        const scored = energy(state, gesture, candidate);
        assert.ok(allowed.includes(scored), "energy returns an allowed position");
        const ok = accept(state, gesture, candidate);
        assert.equal(ok, allowed.includes(candidate));
        if (ok) accepted += 1;
        else rejected += 1;
      }
    }
  }

  assert.equal(Object.keys(fromInk).length, POSITIONS.length * GESTURES.length);
  assert.ok(accepted > 0 && rejected > 0);
  console.log(
    "shade eval ok: " +
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
