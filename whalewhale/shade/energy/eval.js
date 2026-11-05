"use strict";

const path = require("path");

const { accept } = require("../eval");
const { POSITIONS, GESTURES } = require("../reachable");
const { energy, loadWeights } = require("./model");

const WEIGHTS_PATH = path.join(__dirname, "weights.json");

function fmt(value) {
  const text = value.toFixed(3);
  return value >= 0 ? "+" + text : text;
}

// Lowest energy is the next position. An exact tie keeps the earlier position.
function choose(state, gesture, weights) {
  const scores = {};
  let chosen = null;
  let lowest = Infinity;
  for (const candidate of POSITIONS) {
    const value = energy(state, gesture, candidate, weights);
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("non-finite energy for " + state + " " + gesture + " " + candidate);
    }
    scores[candidate] = value;
    if (value < lowest) {
      lowest = value;
      chosen = candidate;
    }
  }
  return { chosen, scores };
}

function evaluate(weights) {
  const rows = [];
  const failures = [];
  let accepted = 0;
  let separated = 0;
  let minGap = Infinity;

  for (const state of POSITIONS) {
    for (const gesture of GESTURES) {
      const decision = choose(state, gesture, weights);
      const ok = accept(state, gesture, decision.chosen);
      if (ok) accepted += 1;

      let worstLegal = -Infinity;
      let bestIllegal = Infinity;
      let legalCount = 0;
      let illegalCount = 0;
      for (const candidate of POSITIONS) {
        const value = decision.scores[candidate];
        if (accept(state, gesture, candidate)) {
          legalCount += 1;
          worstLegal = Math.max(worstLegal, value);
        } else {
          illegalCount += 1;
          bestIllegal = Math.min(bestIllegal, value);
        }
      }

      let gap = null;
      let ranked = false;
      if (legalCount > 0 && illegalCount > 0) {
        gap = bestIllegal - worstLegal;
        minGap = Math.min(minGap, gap);
        ranked = gap > 0;
        if (ranked) separated += 1;
      }

      const scoreText = POSITIONS.map(
        (candidate) => candidate + "=" + fmt(decision.scores[candidate])
      ).join(" ");
      const line =
        state +
        " " +
        gesture +
        " -> " +
        decision.chosen +
        " accept=" +
        ok +
        " legalBelow=" +
        ranked +
        " gap=" +
        (gap === null ? "none" : gap.toFixed(3)) +
        " " +
        scoreText;
      rows.push(line);

      if (!ok) {
        failures.push(state + " " + gesture + " chose " + decision.chosen + ", rejected by accept");
      } else if (legalCount === 0) {
        failures.push(state + " " + gesture + " has no candidate accept allows");
      } else if (illegalCount > 0 && !ranked) {
        failures.push(
          state + " " + gesture + " legal energies are not below illegal energies"
        );
      }
    }
  }

  return {
    rows,
    failures,
    accepted,
    separated,
    minGap,
    taps: POSITIONS.length * GESTURES.length,
  };
}

function scoreLine(result) {
  const status = result.failures.length === 0 ? "ok" : "failed";
  let line =
    "shade energy eval " +
    status +
    ": " +
    result.accepted +
    "/" +
    result.taps +
    " chosen next positions accepted, " +
    result.separated +
    "/" +
    result.taps +
    " taps with legal positions below illegal positions";
  if (Number.isFinite(result.minGap)) line += ", minGap " + result.minGap.toFixed(3);
  return line;
}

function report(result) {
  for (const row of result.rows) console.log(row);
  for (const failure of result.failures) console.log(failure);
  console.log(scoreLine(result));
  return result.failures.length === 0;
}

function run() {
  let weights;
  try {
    weights = loadWeights(WEIGHTS_PATH);
  } catch (error) {
    console.error(error.message);
    console.error("train with: node whalewhale/shade/energy/train.js");
    process.exitCode = 1;
    return null;
  }

  const result = evaluate(weights);
  if (!report(result)) process.exitCode = 1;
  return result;
}

module.exports = { evaluate, choose, report, scoreLine, run, WEIGHTS_PATH };

if (require.main === module) {
  run();
}
