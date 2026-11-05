"use strict";

// The allowance for one tap: the other shade position.
const POSITIONS = ["Up", "Down"];
const GESTURES = ["Tap"];

const NEXT = {
  Up: {
    Tap: ["Down"],
  },
  Down: {
    Tap: ["Up"],
  },
};

function reachable(state, gesture) {
  const row = NEXT[state];
  const allowed = row && row[gesture];
  if (!allowed) {
    throw new Error("no allowance for " + state + " " + gesture);
  }
  return allowed.slice();
}

module.exports = { POSITIONS, GESTURES, NEXT, reachable };
