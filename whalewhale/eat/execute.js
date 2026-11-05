"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { initWeights, lossAndGrad } = require("../energy/train");
const { evaluate } = require("../energy/eval");
const { INPUT, HIDDEN, loadWeights, saveWeights } = require("../energy/model");

const PHASES = ["init", "update-weights", "official-eval"];

function parametersOf(weights) {
  return {
    W1: weights.W1.map((row) => row.slice()),
    b1: weights.b1.slice(),
    w2: weights.w2.slice(),
    b2: weights.b2,
  };
}

function parameterDelta(left, right) {
  let changed = 0;
  let total = 0;
  let l1 = 0;
  let max = 0;
  function walk(a, b) {
    if (typeof a === "number") {
      total += 1;
      const gap = Math.abs(a - b);
      l1 += gap;
      if (gap > max) max = gap;
      if (gap !== 0) changed += 1;
      return;
    }
    if (a.length !== b.length) throw new Error("parameter shapes differ");
    for (let i = 0; i < a.length; i++) walk(a[i], b[i]);
  }
  walk(left.W1, right.W1);
  walk(left.b1, right.b1);
  walk(left.w2, right.w2);
  walk([left.b2], [right.b2]);
  return { changed, total, l1, max };
}

function parameterHash(weights) {
  const body = JSON.stringify({
    W1: weights.W1,
    b1: weights.b1,
    w2: weights.w2,
    b2: weights.b2,
  });
  return crypto.createHash("sha256").update(body).digest("hex");
}

function gradientL2(grads) {
  let sum = grads.b2 * grads.b2;
  for (let i = 0; i < grads.b1.length; i++) {
    sum += grads.b1[i] * grads.b1[i];
    sum += grads.w2[i] * grads.w2[i];
    for (let j = 0; j < grads.W1[i].length; j++) {
      sum += grads.W1[i][j] * grads.W1[i][j];
    }
  }
  return Math.sqrt(sum);
}

function sgd(weights, grads, learningRate) {
  weights.b2 -= learningRate * grads.b2;
  for (let i = 0; i < weights.b1.length; i++) {
    weights.b1[i] -= learningRate * grads.b1[i];
    weights.w2[i] -= learningRate * grads.w2[i];
    const row = weights.W1[i];
    const gradRow = grads.W1[i];
    for (let j = 0; j < row.length; j++) row[j] -= learningRate * gradRow[j];
  }
}

function resolveInside(root, rel) {
  if (typeof rel !== "string" || rel.length === 0) {
    throw new Error("expected a relative path");
  }
  const parts = rel.split(/[\\/]/);
  if (path.isAbsolute(rel) || parts.includes("..") || parts[0] === "") {
    throw new Error("path must stay under the eat directory: " + rel);
  }
  const abs = path.resolve(root, rel);
  const rootAbs = path.resolve(root);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) {
    throw new Error("path escapes the eat directory: " + rel);
  }
  return abs;
}

function roleByName(config, name) {
  const role = config.roles.find((item) => item.name === name);
  if (!role) throw new Error("missing role " + name);
  return role;
}

function assertRole(role) {
  if (typeof role.prompt !== "string" || role.prompt.trim().length === 0) {
    throw new Error("role " + role.name + " needs a prompt");
  }
  if (typeof role.updatesWeights !== "boolean") {
    throw new Error("role " + role.name + " needs updatesWeights");
  }
  if (typeof role.learningRate !== "number" || !Number.isFinite(role.learningRate)) {
    throw new Error("role " + role.name + " needs a finite learningRate");
  }
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function tracePoint(step, result) {
  return {
    step,
    accepted: result.accepted,
    separated: result.separated,
    failureCount: result.failures.length,
    minGap: finiteNumber(result.minGap),
  };
}

function assertFiniteParameters(weights) {
  function walk(value, label) {
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("non-finite parameter " + label);
      return;
    }
    for (let i = 0; i < value.length; i++) walk(value[i], label + "[" + i + "]");
  }
  walk(weights.W1, "W1");
  walk(weights.b1, "b1");
  walk(weights.w2, "w2");
  walk([weights.b2], "b2");
}

function validate(config) {
  if (config.version !== 1) throw new Error("unsupported team config");
  if (!Number.isInteger(config.iteration) || config.iteration < 0) {
    throw new Error("iteration must be a non-negative integer");
  }
  const names = config.phases.map((phase) => phase.name);
  if (names.join(",") !== PHASES.join(",")) {
    throw new Error("phases must be init, update-weights, official-eval");
  }
  for (const phase of config.phases) roleByName(config, phase.role);
  for (const role of config.roles) assertRole(role);
  const owner = roleByName(config, config.ownership.weightUpdate);
  const evaluator = roleByName(config, config.ownership.officialEval);
  if (config.phases[1].role !== owner.name) {
    throw new Error("update-weights phase is not the weight owner");
  }
  if (config.phases[2].role !== evaluator.name) {
    throw new Error("official-eval phase is not the eval owner");
  }
  if (evaluator.updatesWeights) {
    throw new Error("official eval owner must not write weights");
  }
  const training = config.training;
  if (training.method !== "sgd") throw new Error("unsupported training method " + training.method);
  if (training.stop !== "eval-pass") throw new Error("unsupported stop " + training.stop);
  if (!Number.isInteger(training.maxEpochs) || training.maxEpochs < 0) {
    throw new Error("maxEpochs must be a non-negative integer");
  }
  if (training.startFrom !== null && typeof training.startFrom !== "string") {
    throw new Error("startFrom must be a relative path or null");
  }
  if (training.startFrom === null && !Number.isInteger(training.seed)) {
    throw new Error("seed must be an integer when startFrom is null");
  }
  if (training.startFrom !== null && !config.knowledge.read.includes(training.startFrom)) {
    throw new Error("startFrom is not listed in knowledge.read");
  }
  return { owner, evaluator };
}

function startingParameters(config, root) {
  if (config.training.startFrom === null) {
    return {
      parameters: parametersOf(initWeights(config.training.seed)),
      source: "seed",
    };
  }
  const loaded = loadWeights(resolveInside(root, config.training.startFrom));
  return {
    parameters: parametersOf(loaded),
    source: "artifact",
  };
}

function canStep(role) {
  return role.updatesWeights === true && role.learningRate > 0;
}

function skipReason(role) {
  if (role.updatesWeights !== true) return "mandate";
  if (!(role.learningRate > 0)) return "learning-rate";
  return null;
}

// One team iteration. The official score is energy/eval.js. A parameter
// step runs only when the role that owns the weight update is mandated to
// write, using the pairwise loss from energy/train.js.
function execute(config, rootDir) {
  const root = path.resolve(rootDir);
  const { owner } = validate(config);
  const started = startingParameters(config, root);
  const parameters = started.parameters;
  const before = parametersOf(parameters);
  const hashBefore = parameterHash(before);

  let stats = lossAndGrad(parameters);
  const lossBefore = stats.loss;
  let lastEval = evaluate(parameters);
  const acceptedBefore = lastEval.accepted;
  const gradL2 = gradientL2(stats.grads);
  const trace = [tracePoint(0, lastEval)];
  let steps = 0;
  const skip = canStep(owner) ? null : skipReason(owner);

  if (skip === null) {
    while (steps < config.training.maxEpochs) {
      if (config.training.stop === "eval-pass" && lastEval.failures.length === 0) break;
      sgd(parameters, stats.grads, owner.learningRate);
      steps += 1;
      stats = lossAndGrad(parameters);
      if (!Number.isFinite(stats.loss)) throw new Error("energy loss became non-finite");
      lastEval = evaluate(parameters);
      const point = tracePoint(steps, lastEval);
      const prev = trace[trace.length - 1];
      if (point.accepted !== prev.accepted || point.failureCount !== prev.failureCount) {
        trace.push(point);
      }
      if (config.training.stop === "eval-pass" && lastEval.failures.length === 0) break;
    }
  }
  if (trace[trace.length - 1].step !== steps) trace.push(tracePoint(steps, lastEval));
  assertFiniteParameters(parameters);

  const delta = parameterDelta(before, parameters);
  const artifact = config.knowledge.writeWeights;
  const artifactPath = resolveInside(root, artifact);
  const saved = {
    version: 1,
    input: INPUT,
    hidden: HIDDEN,
    parent: config.training.startFrom,
    iteration: config.iteration,
    owner: owner.name,
    method: steps > 0 ? config.training.method : "held",
    seed: config.training.seed,
    learningRate: steps > 0 ? owner.learningRate : 0,
    epochs: steps,
    loss: stats.loss,
    accepted: lastEval.accepted,
    W1: parameters.W1,
    b1: parameters.b1,
    w2: parameters.w2,
    b2: parameters.b2,
  };
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  saveWeights(artifactPath, saved);
  const roundTrip = loadWeights(artifactPath);
  if (parameterHash(roundTrip) !== parameterHash(parameters)) {
    throw new Error("saved weights do not round-trip");
  }

  const official = evaluate(parameters);
  return {
    iteration: config.iteration,
    artifact,
    team: config,
    phases: [
      {
        name: "init",
        role: config.phases[0].role,
        source: started.source,
        seed: config.training.seed,
        startFrom: config.training.startFrom,
        accepted: acceptedBefore,
        separated: trace[0].separated,
        drags: lastEval.drags,
        minGap: trace[0].minGap,
        failureCount: trace[0].failureCount,
      },
      {
        name: "update-weights",
        role: owner.name,
        updatesWeights: owner.updatesWeights,
        learningRate: owner.learningRate,
        method: config.training.method,
        maxEpochs: config.training.maxEpochs,
        objective: "energy-pairwise-softplus",
        skip,
        stepsApplied: steps,
        gradL2,
        lossBefore,
        lossAfter: stats.loss,
        acceptedBefore,
        acceptedAfter: official.accepted,
        changedParameters: delta.changed,
        parameterCount: delta.total,
        parameterL1: delta.l1,
        parameterMaxAbs: delta.max,
        parameterHashBefore: hashBefore,
        parameterHashAfter: parameterHash(parameters),
        probeBefore: { "W1[0][0]": before.W1[0][0], b2: before.b2 },
        probeAfter: { "W1[0][0]": parameters.W1[0][0], b2: parameters.b2 },
        scoreTrace: trace,
      },
      {
        name: "official-eval",
        role: config.ownership.officialEval,
        accepted: official.accepted,
        separated: official.separated,
        drags: official.drags,
        minGap: finiteNumber(official.minGap),
        failures: official.failures.slice(),
      },
    ],
  };
}

module.exports = {
  execute,
  parametersOf,
  parameterDelta,
  parameterHash,
};
