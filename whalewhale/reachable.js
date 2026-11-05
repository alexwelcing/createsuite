"use strict";

// The allowance for one drag: reachable next cells from each cell and step.
const CELLS = ["Nw", "Ne", "Sw", "Se"];
const GESTURES = ["East", "West", "North", "South"];

const NEXT = {
  Nw: {
    East: ["Nw", "Ne"],
    West: ["Nw"],
    North: ["Nw"],
    South: ["Nw", "Sw"],
  },
  Ne: {
    East: ["Ne"],
    West: ["Ne", "Nw"],
    North: ["Ne"],
    South: ["Ne", "Se"],
  },
  Sw: {
    East: ["Sw", "Se"],
    West: ["Sw"],
    North: ["Sw", "Nw"],
    South: ["Sw"],
  },
  Se: {
    East: ["Se"],
    West: ["Se", "Sw"],
    North: ["Se", "Ne"],
    South: ["Se"],
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

module.exports = { CELLS, GESTURES, NEXT, reachable };
