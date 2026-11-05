"use strict";

const crypto = require("crypto");
const path = require("path");

const { bf16Bits, bf16Bytes } = require("./bf16");
const { syncView } = require("./pulse");
const { loadWeights } = require("../energy/model");
const { initWeights, lossAndGrad } = require("../energy/train");

// Adam moment settings from the energy trainer. They are not stored on the weights.
const BETA1 = 0.9;
const BETA2 = 0.999;
const ADAM_EPS = 1e-8;
const WEIGHTS_PATH = path.join(__dirname, "../energy/weights.json");

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function castWeights(weights) {
  const values = [];
  for (const row of weights.W1) {
    for (const value of row) values.push(value);
  }
  for (const value of weights.b1) values.push(value);
  for (const value of weights.w2) values.push(value);
  values.push(weights.b2);
  const bits = new Uint16Array(values.length);
  for (let i = 0; i < values.length; i++) bits[i] = bf16Bits(values[i]);
  return bits;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function hex(bits) {
  return (bits & 0xffff).toString(16).padStart(4, "0");
}

function patchError(previous, next, patch) {
  if (previous.length !== next.length) return "BF16 views have different lengths";
  if (patch.values.length !== patch.indices.length) return "patch values and indices differ";
  const seen = new Array(next.length).fill(false);
  for (let k = 0; k < patch.indices.length; k++) {
    const index = patch.indices[k];
    if (!Number.isInteger(index) || index < 0 || index >= next.length) {
      return "patch index out of range";
    }
    if (seen[index]) return "patch repeats index " + index;
    seen[index] = true;
    if ((previous[index] & 0xffff) === (next[index] & 0xffff)) {
      return "patch sends an unchanged BF16 value at " + index;
    }
    if ((patch.values[k] & 0xffff) !== (next[index] & 0xffff)) {
      return "patch stores a difference rather than the BF16 value at " + index;
    }
  }
  for (let i = 0; i < next.length; i++) {
    if ((previous[i] & 0xffff) !== (next[i] & 0xffff) && !seen[i]) {
      return "patch omits a changed BF16 value at " + i;
    }
  }
  return null;
}

function zeroLike(weights) {
  return {
    W1: weights.W1.map((row) => row.map(() => 0)),
    b1: weights.b1.map(() => 0),
    w2: weights.w2.map(() => 0),
    b2: 0,
  };
}

function decayGradients(weights, grads, weightDecay) {
  grads.b2 += weightDecay * weights.b2;
  for (let i = 0; i < weights.b1.length; i++) {
    grads.b1[i] += weightDecay * weights.b1[i];
    grads.w2[i] += weightDecay * weights.w2[i];
    const row = weights.W1[i];
    const gradRow = grads.W1[i];
    for (let j = 0; j < row.length; j++) gradRow[j] += weightDecay * row[j];
  }
}

// One Adam step, in the same order as whalewhale/energy/train.js.
function adamStep(weights, grads, moments, velocities, step, learningRate) {
  function update(value, grad, moment, velocity) {
    const nextMoment = BETA1 * moment + (1 - BETA1) * grad;
    const nextVelocity = BETA2 * velocity + (1 - BETA2) * grad * grad;
    const momentHat = nextMoment / (1 - Math.pow(BETA1, step));
    const velocityHat = nextVelocity / (1 - Math.pow(BETA2, step));
    const nextValue = value - (learningRate * momentHat) / (Math.sqrt(velocityHat) + ADAM_EPS);
    return { value: nextValue, moment: nextMoment, velocity: nextVelocity };
  }

  let updated = update(weights.b2, grads.b2, moments.b2, velocities.b2);
  weights.b2 = updated.value;
  moments.b2 = updated.moment;
  velocities.b2 = updated.velocity;

  for (let i = 0; i < weights.b1.length; i++) {
    updated = update(weights.b1[i], grads.b1[i], moments.b1[i], velocities.b1[i]);
    weights.b1[i] = updated.value;
    moments.b1[i] = updated.moment;
    velocities.b1[i] = updated.velocity;

    updated = update(weights.w2[i], grads.w2[i], moments.w2[i], velocities.w2[i]);
    weights.w2[i] = updated.value;
    moments.w2[i] = updated.moment;
    velocities.w2[i] = updated.velocity;

    for (let j = 0; j < weights.W1[i].length; j++) {
      updated = update(
        weights.W1[i][j],
        grads.W1[i][j],
        moments.W1[i][j],
        velocities.W1[i][j]
      );
      weights.W1[i][j] = updated.value;
      moments.W1[i][j] = updated.moment;
      velocities.W1[i][j] = updated.velocity;
    }
  }
}

function float32WithBits(bits) {
  const u32 = new Uint32Array(1);
  const f32 = new Float32Array(u32.buffer);
  u32[0] = bits >>> 0;
  return f32[0];
}

function checkCast() {
  if (bf16Bits(1) !== 0x3f80) return "BF16 cast of 1 is not 0x3f80";
  if (bf16Bits(-2) !== 0xc000) return "BF16 cast of -2 is not 0xc000";
  if (bf16Bits(0) !== 0x0000) return "BF16 cast of 0 is not 0x0000";
  // Exact halfway cases round to even: keep 0x3f80, carry 0x3f81.
  if (bf16Bits(float32WithBits(0x3f808000)) !== 0x3f80) return "BF16 tie did not stay even";
  if (bf16Bits(float32WithBits(0x3f818000)) !== 0x3f82) return "BF16 tie did not round to even";
  if (bf16Bits(float32WithBits(0x3f808001)) !== 0x3f81) return "BF16 value above a tie did not round up";
  return null;
}

function checkOneValue(trainedBits) {
  const next = new Uint16Array(trainedBits);
  next[0] = trainedBits[0] ^ 0x0001;
  const { patch, served } = syncView(trainedBits, next);
  const error = patchError(trainedBits, next, patch);
  if (error) return error;
  if (patch.indices.length !== 1 || patch.indices[0] !== 0) {
    return "one-value patch sent " + patch.indices.length + " values";
  }
  const difference = (next[0] - trainedBits[0]) & 0xffff;
  if ((patch.values[0] & 0xffff) === difference) {
    return "one-value patch stored the BF16 difference";
  }
  if (!bf16Bytes(served).equals(bf16Bytes(next))) {
    return "one-value patch did not reconstruct the BF16 bytes";
  }
  const same = syncView(trainedBits, trainedBits);
  if (same.patch.indices.length !== 0) return "unchanged BF16 view produced a patch";
  if (!bf16Bytes(same.served).equals(bf16Bytes(trainedBits))) {
    return "empty patch changed the served BF16 bytes";
  }
  console.log(
    "one-value patch sent " + patch.indices.length + "/" + trainedBits.length + " bf16 values"
  );
  return null;
}

function publish(previous, next, label) {
  const { patch, served } = syncView(previous, next);
  const error = patchError(previous, next, patch);
  if (error) return { error: label + ": " + error };
  if (!bf16Bytes(served).equals(bf16Bytes(next))) {
    return { error: label + ": served BF16 bytes differ from the trainer view" };
  }
  return { patch, served };
}

function reportBytes(servedBits, trainerBits) {
  const served = bf16Bytes(servedBits);
  const trainer = bf16Bytes(trainerBits);
  const servedHash = sha256(served);
  const trainerHash = sha256(trainer);
  if (served.length !== trainer.length || !served.equals(trainer)) {
    let index = -1;
    const limit = Math.min(servedBits.length, trainerBits.length);
    for (let i = 0; i < limit; i++) {
      if ((servedBits[i] & 0xffff) !== (trainerBits[i] & 0xffff)) {
        index = i;
        break;
      }
    }
    console.error("served bf16 sha256 " + servedHash);
    console.error("trainer bf16 sha256 " + trainerHash);
    console.error(
      "served bf16 bytes differ from trainer bf16 bytes at " +
        index +
        " served " +
        (index < 0 ? "none" : hex(servedBits[index])) +
        " trainer " +
        (index < 0 ? "none" : hex(trainerBits[index]))
    );
    process.exitCode = 1;
    return false;
  }
  console.log("bf16 bytes match " + served.length + " sha256 " + servedHash);
  return true;
}

function run() {
  const castError = checkCast();
  if (castError) {
    fail(castError);
    return;
  }

  let trained;
  try {
    trained = loadWeights(WEIGHTS_PATH);
  } catch (error) {
    fail(error.message);
    return;
  }
  if (!Number.isInteger(trained.seed)) {
    fail("trained weights have no integer seed");
    return;
  }
  if (!Number.isInteger(trained.epochs) || trained.epochs < 1) {
    fail("trained weights have no epoch count");
    return;
  }
  if (!Number.isFinite(trained.learningRate) || !Number.isFinite(trained.weightDecay)) {
    fail("trained weights have no learning rate or weight decay");
    return;
  }

  const trainerBits = castWeights(trained);
  const oneValueError = checkOneValue(trainerBits);
  if (oneValueError) {
    fail(oneValueError);
    return;
  }

  const weights = initWeights(trained.seed);
  const moments = zeroLike(weights);
  const velocities = zeroLike(weights);
  let served = castWeights(weights);
  let stats = lossAndGrad(weights);
  let omitted = 0;

  for (let epoch = 1; epoch <= trained.epochs; epoch++) {
    decayGradients(weights, stats.grads, trained.weightDecay);
    adamStep(weights, stats.grads, moments, velocities, epoch, trained.learningRate);
    const view = castWeights(weights);
    const published = publish(served, view, "epoch " + epoch);
    if (published.error) {
      fail(published.error);
      return;
    }
    omitted += served.length - published.patch.indices.length;
    console.log(
      "epoch " +
        epoch +
        " sent " +
        published.patch.indices.length +
        "/" +
        served.length +
        " bf16 values"
    );
    served = published.served;
    stats = lossAndGrad(weights);
    if (!Number.isFinite(stats.loss)) {
      fail("energy loss became non-finite");
      return;
    }
  }

  console.log("omitted " + omitted + " unchanged bf16 values");
  const matched = reportBytes(served, trainerBits);
  if (!matched) return;
  if (omitted === 0) {
    fail("every BF16 value was sent at every step; that is a full-weight copy");
  }
}

if (require.main === module) {
  run();
}

module.exports = { run, castWeights };
