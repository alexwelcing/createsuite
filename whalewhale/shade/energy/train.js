"use strict";

const path = require("path");

const { accept } = require("../eval");
const {
  POSITIONS,
  GESTURES,
  INPUT,
  HIDDEN,
  features,
  forward,
  saveWeights,
} = require("./model");
const { run, evaluate, report } = require("./eval");

const SEED = 1;
const LEARNING_RATE = 0.05;
const WEIGHT_DECAY = 1e-4;
const MARGIN = 1;
const MAX_EPOCHS = 500;
const BETA1 = 0.9;
const BETA2 = 0.999;
const ADAM_EPS = 1e-8;
const WEIGHTS_PATH = path.join(__dirname, "weights.json");

function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function randn(random) {
  const u = Math.max(random(), 1e-12);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sigmoid(z) {
  if (z >= 0) {
    const neg = Math.exp(-z);
    return 1 / (1 + neg);
  }
  const pos = Math.exp(z);
  return pos / (1 + pos);
}

function softplus(z) {
  if (z > 20) return z;
  if (z < -20) return Math.exp(z);
  return Math.log1p(Math.exp(z));
}

function initWeights(seed) {
  const random = mulberry32(seed);
  const inScale = Math.sqrt(1 / INPUT);
  const outScale = Math.sqrt(1 / HIDDEN);
  return {
    W1: Array.from({ length: HIDDEN }, () =>
      Array.from({ length: INPUT }, () => randn(random) * inScale)
    ),
    b1: new Array(HIDDEN).fill(0),
    w2: Array.from({ length: HIDDEN }, () => randn(random) * outScale),
    b2: 0,
  };
}

function zeroLike(weights) {
  return {
    W1: weights.W1.map((row) => row.map(() => 0)),
    b1: weights.b1.map(() => 0),
    w2: weights.w2.map(() => 0),
    b2: 0,
  };
}

function cloneWeights(weights) {
  return {
    W1: weights.W1.map((row) => row.slice()),
    b1: weights.b1.slice(),
    w2: weights.w2.slice(),
    b2: weights.b2,
  };
}

// Pairwise softplus. accept(state, gesture, candidate) supplies the label:
// accepted candidates are trained to a lower energy than rejected ones.
function lossAndGrad(weights) {
  const grads = zeroLike(weights);
  let loss = 0;
  let pairs = 0;
  let separated = 0;
  let acceptedChoices = 0;
  let minGap = Infinity;

  for (const state of POSITIONS) {
    for (const gesture of GESTURES) {
      const scored = POSITIONS.map((candidate) => {
        const x = features(state, gesture, candidate);
        return {
          candidate,
          x,
          cache: forward(x, weights),
          legal: accept(state, gesture, candidate),
        };
      });

      let chosen = scored[0];
      let worstLegal = -Infinity;
      let bestIllegal = Infinity;
      let legalCount = 0;
      let illegalCount = 0;
      for (const sample of scored) {
        if (sample.cache.energy < chosen.cache.energy) chosen = sample;
        if (sample.legal) {
          legalCount += 1;
          worstLegal = Math.max(worstLegal, sample.cache.energy);
        } else {
          illegalCount += 1;
          bestIllegal = Math.min(bestIllegal, sample.cache.energy);
        }
      }
      if (accept(state, gesture, chosen.candidate)) acceptedChoices += 1;
      if (legalCount > 0 && illegalCount > 0) {
        const gap = bestIllegal - worstLegal;
        minGap = Math.min(minGap, gap);
        if (gap > 0) separated += 1;
      }

      const upstream = new Map();
      for (const sample of scored) upstream.set(sample, 0);
      for (const positive of scored) {
        if (!positive.legal) continue;
        for (const negative of scored) {
          if (negative.legal) continue;
          const margin = positive.cache.energy - negative.cache.energy + MARGIN;
          loss += softplus(margin);
          const gate = sigmoid(margin);
          upstream.set(positive, upstream.get(positive) + gate);
          upstream.set(negative, upstream.get(negative) - gate);
          pairs += 1;
        }
      }

      for (const sample of scored) {
        const upstreamEnergy = upstream.get(sample);
        const hidden = sample.cache.h;
        grads.b2 += upstreamEnergy;
        for (let i = 0; i < HIDDEN; i++) {
          grads.w2[i] += upstreamEnergy * hidden[i];
          const dz = upstreamEnergy * weights.w2[i] * (1 - hidden[i] * hidden[i]);
          grads.b1[i] += dz;
          const row = grads.W1[i];
          for (let j = 0; j < INPUT; j++) row[j] += dz * sample.x[j];
        }
      }
    }
  }

  if (pairs === 0) throw new Error("accept rule produced no legal/illegal pairs");
  loss /= pairs;
  const scale = 1 / pairs;
  grads.b2 *= scale;
  for (let i = 0; i < HIDDEN; i++) {
    grads.b1[i] *= scale;
    grads.w2[i] *= scale;
    for (let j = 0; j < INPUT; j++) grads.W1[i][j] *= scale;
  }

  return { loss, grads, separated, acceptedChoices, minGap, pairs };
}

function gradCheck(weights) {
  const analytic = lossAndGrad(weights).grads;
  const eps = 1e-5;
  function numericAt(mutate) {
    const plus = cloneWeights(weights);
    const minus = cloneWeights(weights);
    mutate(plus, eps);
    mutate(minus, -eps);
    return (lossAndGrad(plus).loss - lossAndGrad(minus).loss) / (2 * eps);
  }
  const probes = [
    ["W1[0][0]", analytic.W1[0][0], (w, d) => (w.W1[0][0] += d)],
    [
      "W1[last]",
      analytic.W1[HIDDEN - 1][INPUT - 1],
      (w, d) => (w.W1[HIDDEN - 1][INPUT - 1] += d),
    ],
    ["b1[1]", analytic.b1[1], (w, d) => (w.b1[1] += d)],
    ["w2[last]", analytic.w2[HIDDEN - 1], (w, d) => (w.w2[HIDDEN - 1] += d)],
    ["b2", analytic.b2, (w, d) => (w.b2 += d)],
  ];
  let worstAbsolute = 0;
  for (const [name, analyticValue, mutate] of probes) {
    const numeric = numericAt(mutate);
    const absolute = Math.abs(analyticValue - numeric);
    const scale = Math.max(Math.abs(analyticValue), Math.abs(numeric));
    const relative = scale === 0 ? 0 : absolute / scale;
    // A shared readout bias cancels in pairwise energy gaps, so its slope
    // is compared in absolute terms as well as relative ones.
    if (absolute > 1e-6 && relative > 1e-4) {
      throw new Error(
        "energy gradient check failed at " +
          name +
          " analytic " +
          analyticValue +
          " numeric " +
          numeric
      );
    }
    worstAbsolute = Math.max(worstAbsolute, absolute);
  }
  return worstAbsolute;
}

function applyDecay(weights, grads) {
  grads.b2 += WEIGHT_DECAY * weights.b2;
  for (let i = 0; i < HIDDEN; i++) {
    grads.b1[i] += WEIGHT_DECAY * weights.b1[i];
    grads.w2[i] += WEIGHT_DECAY * weights.w2[i];
    for (let j = 0; j < INPUT; j++) grads.W1[i][j] += WEIGHT_DECAY * weights.W1[i][j];
  }
}

function adamUpdate(value, grad, moment, velocity, step) {
  const nextMoment = BETA1 * moment + (1 - BETA1) * grad;
  const nextVelocity = BETA2 * velocity + (1 - BETA2) * grad * grad;
  const momentHat = nextMoment / (1 - Math.pow(BETA1, step));
  const velocityHat = nextVelocity / (1 - Math.pow(BETA2, step));
  const nextValue = value - (LEARNING_RATE * momentHat) / (Math.sqrt(velocityHat) + ADAM_EPS);
  return { value: nextValue, moment: nextMoment, velocity: nextVelocity };
}

function logStats(epoch, stats) {
  const taps = POSITIONS.length * GESTURES.length;
  console.log(
    "epoch " +
      epoch +
      " loss " +
      stats.loss.toFixed(4) +
      " separated " +
      stats.separated +
      "/" +
      taps +
      " accepted " +
      stats.acceptedChoices +
      "/" +
      taps +
      " minGap " +
      stats.minGap.toFixed(3)
  );
}

function converged(stats) {
  return stats.separated === POSITIONS.length * GESTURES.length && stats.minGap >= MARGIN;
}

function train() {
  const weights = initWeights(SEED);
  const gradError = gradCheck(weights);
  console.log("grad check ok: max absolute error " + gradError.toExponential(2));

  console.log("score before training");
  report(evaluate(weights));

  const moments = zeroLike(weights);
  const velocities = zeroLike(weights);
  let epoch = 0;
  let stats = lossAndGrad(weights);
  logStats(epoch, stats);

  while (epoch < MAX_EPOCHS && !converged(stats)) {
    epoch += 1;
    applyDecay(weights, stats.grads);
    const g = stats.grads;

    let updated = adamUpdate(weights.b2, g.b2, moments.b2, velocities.b2, epoch);
    weights.b2 = updated.value;
    moments.b2 = updated.moment;
    velocities.b2 = updated.velocity;

    for (let i = 0; i < HIDDEN; i++) {
      updated = adamUpdate(weights.b1[i], g.b1[i], moments.b1[i], velocities.b1[i], epoch);
      weights.b1[i] = updated.value;
      moments.b1[i] = updated.moment;
      velocities.b1[i] = updated.velocity;

      updated = adamUpdate(weights.w2[i], g.w2[i], moments.w2[i], velocities.w2[i], epoch);
      weights.w2[i] = updated.value;
      moments.w2[i] = updated.moment;
      velocities.w2[i] = updated.velocity;

      for (let j = 0; j < INPUT; j++) {
        updated = adamUpdate(
          weights.W1[i][j],
          g.W1[i][j],
          moments.W1[i][j],
          velocities.W1[i][j],
          epoch
        );
        weights.W1[i][j] = updated.value;
        moments.W1[i][j] = updated.moment;
        velocities.W1[i][j] = updated.velocity;
      }
    }

    stats = lossAndGrad(weights);
    if (!Number.isFinite(stats.loss)) throw new Error("energy loss became non-finite");
    if (epoch === 1 || epoch % 25 === 0 || converged(stats) || epoch === MAX_EPOCHS) {
      logStats(epoch, stats);
    }
  }

  const trained = {
    version: 1,
    method: "adam",
    seed: SEED,
    learningRate: LEARNING_RATE,
    weightDecay: WEIGHT_DECAY,
    margin: MARGIN,
    epochs: epoch,
    input: INPUT,
    hidden: HIDDEN,
    loss: stats.loss,
    minGap: stats.minGap,
    W1: weights.W1,
    b1: weights.b1,
    w2: weights.w2,
    b2: weights.b2,
  };
  saveWeights(WEIGHTS_PATH, trained);
  console.log("saved " + WEIGHTS_PATH);
  console.log("score after training");
  return run();
}

if (require.main === module) {
  train();
}

module.exports = { train, initWeights, lossAndGrad };
