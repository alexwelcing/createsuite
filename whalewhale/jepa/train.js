"use strict";

const { CELLS, GESTURES } = require("../reachable");
const { accept } = require("../eval");
const { run } = require("./eval");
const {
  WEIGHTS_PATH,
  createWeights,
  lossAndGrad,
  clipGrads,
  adam,
  cloneMoments,
  cloneWeights,
  checkGradients,
  saveWeights,
} = require("./model");

// Training labels are states the fixture accept rule allows for that drag.
// When the contract allows a move, that cell is the target. Otherwise the
// target is the accepted current cell. The table of answers is not copied.

const CONFIG = {
  dim: 8,
  hidden: 32,
  seed: 8,
  epochs: 4000,
  margin: 1,
  patience: 30,
  gradClip: 5,
  lambdaMse: 1,
  lambdaCe: 1,
  lambdaInv: 1,
  lambdaVar: 0.05,
  gamma: 1,
  learningRate: {
    stateEmbed: 0.03,
    gestureEmbed: 0.03,
    W1: 0.03,
    b1: 0.03,
    W2: 0.03,
    b2: 0.03,
    Wd: 0.03,
    bd: 0.03,
  },
};

function examplesFromContract(weights) {
  const cellIndex = new Map(weights.cells.map((cell, index) => [cell, index]));
  const gestureIndex = new Map(
    weights.gestures.map((gesture, index) => [gesture, index])
  );
  const examples = [];
  for (const state of CELLS) {
    for (const gesture of GESTURES) {
      const accepted = CELLS.filter((cell) => accept(state, gesture, cell));
      if (accepted.length === 0) {
        throw new Error("contract accepted no cell for " + state + " " + gesture);
      }
      const moved = accepted.filter((cell) => cell !== state);
      if (moved.length > 1) {
        throw new Error(
          "contract accepted multiple moves for " + state + " " + gesture
        );
      }
      const target = moved.length === 1 ? moved[0] : accepted[0];
      const stateId = cellIndex.get(state);
      const gestureId = gestureIndex.get(gesture);
      const targetId = cellIndex.get(target);
      if (stateId === undefined || gestureId === undefined || targetId === undefined) {
        throw new Error("drag is outside the checkpoint vocabulary");
      }
      examples.push({
        state,
        gesture,
        target,
        stateIndex: stateId,
        gestureIndex: gestureId,
        targetIndex: targetId,
      });
    }
  }
  return examples;
}

function main() {
  const weights = createWeights({
    dim: CONFIG.dim,
    hidden: CONFIG.hidden,
    seed: CONFIG.seed,
    cells: CELLS,
    gestures: GESTURES,
  });
  const examples = examplesFromContract(weights);
  const smooth = Object.assign({}, CONFIG, { lambdaVar: 0 });
  const spread = Object.assign({}, CONFIG, {
    lambdaMse: 0,
    lambdaCe: 0,
    lambdaInv: 0,
    lambdaVar: 1,
    gamma: 100,
  });
  const smoothError = checkGradients(weights, examples, smooth);
  const spreadError = checkGradients(weights, examples, spread);
  console.log(
    "gradient check ok: max abs error " +
      Math.max(smoothError, spreadError).toExponential(2)
  );

  const moments = cloneMoments(weights);
  let kept = null;
  let keptLoss = Infinity;
  let keptCorrect = -1;
  let stable = 0;
  let step = 0;

  for (let epoch = 1; epoch <= CONFIG.epochs; epoch++) {
    const stats = lossAndGrad(weights, examples, CONFIG);
    if (!Number.isFinite(stats.loss)) {
      throw new Error("non-finite loss at epoch " + epoch);
    }
    const better =
      stats.correct > keptCorrect ||
      (stats.correct === keptCorrect && stats.loss < keptLoss);
    if (better) {
      kept = cloneWeights(weights);
      kept.steps = epoch - 1;
      kept.loss = stats.loss;
      keptCorrect = stats.correct;
      keptLoss = stats.loss;
    }
    const perfect = stats.correct === examples.length && stats.minMargin >= CONFIG.margin;
    if (perfect) stable += 1;
    else stable = 0;
    if (epoch === 1 || epoch % 200 === 0 || (perfect && stable === 1)) {
      console.log(
        "epoch " +
          (epoch - 1) +
          " loss " +
          stats.loss.toFixed(4) +
          " decoded " +
          stats.correct +
          "/" +
          examples.length +
          " margin " +
          (Number.isFinite(stats.minMargin) ? stats.minMargin.toFixed(3) : "na")
      );
    }
    if (stable >= CONFIG.patience) {
      kept = cloneWeights(weights);
      kept.steps = epoch - 1;
      kept.loss = stats.loss;
      step = epoch - 1;
      break;
    }
    clipGrads(stats.grads, CONFIG.gradClip);
    step = epoch;
    adam(weights, stats.grads, moments, step, CONFIG.learningRate);
  }

  if (!kept) throw new Error("training produced no checkpoint");
  saveWeights(kept);
  console.log(
    "saved " + WEIGHTS_PATH + " steps " + kept.steps + " loss " + kept.loss
  );
  const ok = run();
  process.exit(ok ? 0 : 1);
}

main();
