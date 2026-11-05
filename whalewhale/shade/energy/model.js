"use strict";

const fs = require("fs");

const { POSITIONS, GESTURES } = require("../reachable");

// One-hot layout: [position | gesture | candidate].
const INPUT = POSITIONS.length + GESTURES.length + POSITIONS.length;
const HIDDEN = 8;

function indexOf(list, name, label) {
  const index = list.indexOf(name);
  if (index < 0) throw new Error("unknown " + label + ": " + name);
  return index;
}

function features(state, gesture, candidate) {
  const x = new Array(INPUT).fill(0);
  x[indexOf(POSITIONS, state, "position")] = 1;
  x[POSITIONS.length + indexOf(GESTURES, gesture, "gesture")] = 1;
  x[POSITIONS.length + GESTURES.length + indexOf(POSITIONS, candidate, "position")] = 1;
  return x;
}

// E(state, gesture, candidate) = b2 + w2 · tanh(W1 x + b1)
function forward(x, weights) {
  if (x.length !== INPUT) throw new Error("energy features must have length " + INPUT);
  const h = new Array(HIDDEN);
  for (let i = 0; i < HIDDEN; i++) {
    let sum = weights.b1[i];
    const row = weights.W1[i];
    for (let j = 0; j < INPUT; j++) sum += row[j] * x[j];
    h[i] = Math.tanh(sum);
  }
  let energy = weights.b2;
  for (let i = 0; i < HIDDEN; i++) energy += weights.w2[i] * h[i];
  return { h, energy };
}

function energy(state, gesture, candidate, weights) {
  return forward(features(state, gesture, candidate), weights).energy;
}

function loadWeights(file) {
  const weights = JSON.parse(fs.readFileSync(file, "utf8"));
  if (weights.version !== 1) throw new Error("unsupported energy weights in " + file);
  if (weights.input !== INPUT || weights.hidden !== HIDDEN) {
    throw new Error("energy weight shape does not match this model");
  }
  if (!Array.isArray(weights.W1) || weights.W1.length !== HIDDEN) {
    throw new Error("W1 rows do not match the hidden width");
  }
  for (const row of weights.W1) {
    if (!Array.isArray(row) || row.length !== INPUT) {
      throw new Error("W1 columns do not match the feature width");
    }
  }
  if (!Array.isArray(weights.b1) || weights.b1.length !== HIDDEN) {
    throw new Error("b1 does not match the hidden width");
  }
  if (!Array.isArray(weights.w2) || weights.w2.length !== HIDDEN) {
    throw new Error("w2 does not match the hidden width");
  }
  if (typeof weights.b2 !== "number" || !Number.isFinite(weights.b2)) {
    throw new Error("b2 must be a finite number");
  }
  return weights;
}

function saveWeights(file, weights) {
  fs.writeFileSync(file, JSON.stringify(weights, null, 2) + "\n");
}

module.exports = {
  POSITIONS,
  GESTURES,
  INPUT,
  HIDDEN,
  features,
  forward,
  energy,
  loadWeights,
  saveWeights,
};
