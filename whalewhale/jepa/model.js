"use strict";

const fs = require("fs");
const path = require("path");

// Learned settle(here, step) for the window-drag hole.
// encode(state) is a representation. The predictor maps that representation
// and the gesture onto the next state's representation. A linear head decodes
// the predicted representation to a cell. Inference reads these weights only.

const PARAMS = [
  "stateEmbed",
  "gestureEmbed",
  "W1",
  "b1",
  "W2",
  "b2",
  "Wd",
  "bd",
];

const WEIGHTS_PATH = path.join(__dirname, "weights.json");

let cachedWeights = null;

function zeros(n) {
  return new Array(n).fill(0);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rand) {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function row(table, index, width) {
  const start = index * width;
  return table.slice(start, start + width);
}

function createWeights(options) {
  const dim = options.dim;
  const hidden = options.hidden;
  const cells = options.cells.slice();
  const gestures = options.gestures.slice();
  const rand = mulberry32(options.seed);
  const nC = cells.length;
  const nG = gestures.length;
  const inDim = dim * 2;

  function fill(length, std) {
    const out = new Array(length);
    for (let i = 0; i < length; i++) out[i] = normal(rand) * std;
    return out;
  }

  return {
    arch: "jepa",
    dim,
    hidden,
    cells,
    gestures,
    seed: options.seed,
    stateEmbed: fill(nC * dim, 1),
    gestureEmbed: fill(nG * dim, 1),
    W1: fill(hidden * inDim, Math.sqrt(2 / (inDim + hidden))),
    b1: zeros(hidden),
    W2: fill(dim * hidden, 0.01),
    b2: zeros(dim),
    Wd: fill(nC * dim, Math.sqrt(2 / (dim + nC))),
    bd: zeros(nC),
  };
}

function forward(weights, stateIndex, gestureIndex) {
  const dim = weights.dim;
  const hidden = weights.hidden;
  const nC = weights.cells.length;
  const inDim = dim * 2;
  const e = row(weights.stateEmbed, stateIndex, dim);
  const g = row(weights.gestureEmbed, gestureIndex, dim);
  const x = e.concat(g);
  const h = new Array(hidden);
  for (let r = 0; r < hidden; r++) {
    let sum = weights.b1[r];
    const off = r * inDim;
    for (let c = 0; c < inDim; c++) sum += weights.W1[off + c] * x[c];
    h[r] = Math.tanh(sum);
  }
  const delta = new Array(dim);
  for (let d = 0; d < dim; d++) {
    let sum = weights.b2[d];
    const off = d * hidden;
    for (let r = 0; r < hidden; r++) sum += weights.W2[off + r] * h[r];
    delta[d] = sum;
  }
  const z = new Array(dim);
  for (let d = 0; d < dim; d++) z[d] = e[d] + delta[d];
  const logits = new Array(nC);
  for (let c = 0; c < nC; c++) {
    let sum = weights.bd[c];
    const off = c * dim;
    for (let d = 0; d < dim; d++) sum += weights.Wd[off + d] * z[d];
    logits[c] = sum;
  }
  let cellIndex = 0;
  for (let c = 1; c < nC; c++) {
    if (logits[c] > logits[cellIndex]) cellIndex = c;
  }
  return { stateIndex, gestureIndex, e, g, x, h, delta, z, logits, cellIndex };
}

function softmaxCrossEntropy(logits, targetIndex) {
  let maxLogit = logits[0];
  for (let i = 1; i < logits.length; i++) {
    if (logits[i] > maxLogit) maxLogit = logits[i];
  }
  const probs = new Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    probs[i] = Math.exp(logits[i] - maxLogit);
    sum += probs[i];
  }
  for (let i = 0; i < probs.length; i++) probs[i] /= sum;
  const dLogits = probs.slice();
  dLogits[targetIndex] -= 1;
  return { loss: -Math.log(probs[targetIndex]), dLogits };
}

function zeroGrads(weights) {
  const grads = {};
  for (const name of PARAMS) grads[name] = zeros(weights[name].length);
  return grads;
}

function accumulatePredictor(weights, cache, dZ, grads, scale) {
  const dim = weights.dim;
  const hidden = weights.hidden;
  const inDim = dim * 2;
  const dH = zeros(hidden);
  for (let d = 0; d < dim; d++) {
    grads.b2[d] += scale * dZ[d];
    const off = d * hidden;
    for (let r = 0; r < hidden; r++) {
      grads.W2[off + r] += scale * dZ[d] * cache.h[r];
      dH[r] += dZ[d] * weights.W2[off + r];
    }
  }
  const dX = zeros(inDim);
  for (let r = 0; r < hidden; r++) {
    const dPre = dH[r] * (1 - cache.h[r] * cache.h[r]);
    grads.b1[r] += scale * dPre;
    const off = r * inDim;
    for (let c = 0; c < inDim; c++) {
      grads.W1[off + c] += scale * dPre * cache.x[c];
      dX[c] += dPre * weights.W1[off + c];
    }
  }
  const stateOff = cache.stateIndex * dim;
  const gestureOff = cache.gestureIndex * dim;
  for (let d = 0; d < dim; d++) {
    grads.stateEmbed[stateOff + d] += scale * (dX[d] + dZ[d]);
    grads.gestureEmbed[gestureOff + d] += scale * dX[dim + d];
  }
}

function logitsForCode(weights, code) {
  const dim = weights.dim;
  const nC = weights.cells.length;
  const logits = new Array(nC);
  for (let c = 0; c < nC; c++) {
    let sum = weights.bd[c];
    const off = c * dim;
    for (let d = 0; d < dim; d++) sum += weights.Wd[off + d] * code[d];
    logits[c] = sum;
  }
  return logits;
}

function lossAndGrad(weights, examples, config) {
  const dim = weights.dim;
  const nC = weights.cells.length;
  const grads = zeroGrads(weights);
  const n = examples.length;
  let loss = 0;
  let correct = 0;
  let minMargin = Infinity;
  const decoded = [];

  const codes = config.detachedCodes || weights.stateEmbed;
  for (const example of examples) {
    const cache = forward(weights, example.stateIndex, example.gestureIndex);
    const targetCode = row(codes, example.targetIndex, dim);
    const dZ = zeros(dim);
    let mse = 0;
    for (let d = 0; d < dim; d++) {
      const diff = cache.z[d] - targetCode[d];
      mse += diff * diff;
      dZ[d] += config.lambdaMse * (2 / dim) * diff;
    }
    mse /= dim;

    const ce = softmaxCrossEntropy(cache.logits, example.targetIndex);
    for (let c = 0; c < nC; c++) {
      grads.bd[c] += (config.lambdaCe / n) * ce.dLogits[c];
      const off = c * dim;
      for (let d = 0; d < dim; d++) {
        grads.Wd[off + d] += (config.lambdaCe / n) * ce.dLogits[c] * cache.z[d];
        dZ[d] += config.lambdaCe * ce.dLogits[c] * weights.Wd[off + d];
      }
    }
    accumulatePredictor(weights, cache, dZ, grads, 1 / n);
    loss += (config.lambdaMse * mse + config.lambdaCe * ce.loss) / n;

    let runnerUp = -Infinity;
    for (let c = 0; c < nC; c++) {
      if (c !== example.targetIndex && cache.logits[c] > runnerUp) {
        runnerUp = cache.logits[c];
      }
    }
    const margin = cache.logits[example.targetIndex] - runnerUp;
    if (margin < minMargin) minMargin = margin;
    if (cache.cellIndex === example.targetIndex) correct += 1;
    decoded.push(weights.cells[cache.cellIndex]);
  }

  let invert = 0;
  for (let j = 0; j < nC; j++) {
    const code = row(weights.stateEmbed, j, dim);
    const logits = logitsForCode(weights, code);
    const ce = softmaxCrossEntropy(logits, j);
    invert += ce.loss / nC;
    const scale = config.lambdaInv / nC;
    for (let c = 0; c < nC; c++) {
      grads.bd[c] += scale * ce.dLogits[c];
      const off = c * dim;
      for (let d = 0; d < dim; d++) {
        grads.Wd[off + d] += scale * ce.dLogits[c] * code[d];
        grads.stateEmbed[j * dim + d] += scale * ce.dLogits[c] * weights.Wd[off + d];
      }
    }
  }
  loss += config.lambdaInv * invert;

  let variance = 0;
  const varScale = config.lambdaVar / dim;
  for (let d = 0; d < dim; d++) {
    let mean = 0;
    for (let j = 0; j < nC; j++) mean += weights.stateEmbed[j * dim + d];
    mean /= nC;
    let centeredSq = 0;
    const centered = new Array(nC);
    for (let j = 0; j < nC; j++) {
      centered[j] = weights.stateEmbed[j * dim + d] - mean;
      centeredSq += centered[j] * centered[j];
    }
    const std = Math.sqrt(centeredSq / nC + 1e-8);
    const shortfall = config.gamma - std;
    if (shortfall > 0) {
      variance += shortfall / dim;
      for (let j = 0; j < nC; j++) {
        grads.stateEmbed[j * dim + d] += varScale * (-centered[j] / (nC * std));
      }
    }
  }
  loss += config.lambdaVar * variance;

  return { loss, grads, correct, minMargin, decoded, invert, variance };
}

function clipGrads(grads, maxNorm) {
  let sum = 0;
  for (const name of PARAMS) {
    for (const value of grads[name]) sum += value * value;
  }
  const norm = Math.sqrt(sum);
  if (norm > maxNorm) {
    const scale = maxNorm / norm;
    for (const name of PARAMS) {
      const grad = grads[name];
      for (let i = 0; i < grad.length; i++) grad[i] *= scale;
    }
  }
  return norm;
}

function adam(weights, grads, moments, step, learningRate) {
  const beta1 = 0.9;
  const beta2 = 0.999;
  const epsilon = 1e-8;
  const bias1 = 1 - Math.pow(beta1, step);
  const bias2 = 1 - Math.pow(beta2, step);
  for (const name of PARAMS) {
    const rate = learningRate[name];
    const value = weights[name];
    const grad = grads[name];
    const mean = moments.mean[name];
    const second = moments.second[name];
    for (let i = 0; i < value.length; i++) {
      mean[i] = beta1 * mean[i] + (1 - beta1) * grad[i];
      second[i] = beta2 * second[i] + (1 - beta2) * grad[i] * grad[i];
      const mHat = mean[i] / bias1;
      const vHat = second[i] / bias2;
      value[i] -= (rate * mHat) / (Math.sqrt(vHat) + epsilon);
    }
  }
}

function cloneMoments(weights) {
  const mean = {};
  const second = {};
  for (const name of PARAMS) {
    mean[name] = zeros(weights[name].length);
    second[name] = zeros(weights[name].length);
  }
  return { mean, second };
}

function cloneWeights(weights) {
  const copy = Object.assign({}, weights);
  for (const name of PARAMS) copy[name] = weights[name].slice();
  copy.cells = weights.cells.slice();
  copy.gestures = weights.gestures.slice();
  return copy;
}

function checkGradients(weights, examples, config) {
  // The JEPA target codes are stop-gradient, so the finite difference holds
  // them fixed while the perturbed forward still reads the live context.
  const detached = Object.assign({}, config, {
    detachedCodes: weights.stateEmbed.slice(),
  });
  const analytical = lossAndGrad(weights, examples, detached).grads;
  const epsilon = 1e-5;
  const probes = [
    ["stateEmbed", 0],
    ["stateEmbed", weights.dim + 1],
    ["gestureEmbed", 2],
    ["W1", 0],
    ["W1", weights.dim],
    ["b1", 1],
    ["W2", 3],
    ["b2", 0],
    ["Wd", 1],
    ["bd", weights.cells.length - 1],
  ];
  let maxAbs = 0;
  const failures = [];
  for (const [name, index] of probes) {
    const original = weights[name][index];
    weights[name][index] = original + epsilon;
    const up = lossAndGrad(weights, examples, detached).loss;
    weights[name][index] = original - epsilon;
    const down = lossAndGrad(weights, examples, detached).loss;
    weights[name][index] = original;
    const numerical = (up - down) / (2 * epsilon);
    const got = analytical[name][index];
    const abs = Math.abs(numerical - got);
    if (abs > maxAbs) maxAbs = abs;
    const denom = Math.max(1, Math.abs(numerical), Math.abs(got));
    if (abs / denom > 1e-4) {
      failures.push(
        name + "[" + index + "] analytical " + got + " numerical " + numerical
      );
    }
  }
  if (failures.length > 0) {
    throw new Error("gradient check failed:\n" + failures.join("\n"));
  }
  return maxAbs;
}

function saveWeights(weights, file) {
  const payload = {
    arch: weights.arch,
    dim: weights.dim,
    hidden: weights.hidden,
    cells: weights.cells,
    gestures: weights.gestures,
    seed: weights.seed,
    steps: weights.steps,
    loss: weights.loss,
  };
  for (const name of PARAMS) payload[name] = weights[name];
  fs.writeFileSync(file || WEIGHTS_PATH, JSON.stringify(payload) + "\n");
  cachedWeights = null;
}

function loadWeights(file) {
  if (!file && cachedWeights) return cachedWeights;
  const loaded = JSON.parse(fs.readFileSync(file || WEIGHTS_PATH, "utf8"));
  if (loaded.arch !== "jepa") throw new Error("weights are not a jepa checkpoint");
  if (!file) cachedWeights = loaded;
  return loaded;
}

function predictWith(weights, state, gesture) {
  const stateIndex = weights.cells.indexOf(state);
  const gestureIndex = weights.gestures.indexOf(gesture);
  if (stateIndex < 0 || gestureIndex < 0) {
    throw new Error("unknown drag " + state + " " + gesture);
  }
  const out = forward(weights, stateIndex, gestureIndex);
  return weights.cells[out.cellIndex];
}

function predict(state, gesture) {
  return predictWith(loadWeights(), state, gesture);
}

module.exports = {
  PARAMS,
  WEIGHTS_PATH,
  createWeights,
  forward,
  lossAndGrad,
  clipGrads,
  adam,
  cloneMoments,
  cloneWeights,
  checkGradients,
  saveWeights,
  loadWeights,
  predictWith,
  predict,
};
