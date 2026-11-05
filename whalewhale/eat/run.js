"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { execute, parametersOf, parameterDelta } = require("./execute");
const { supervise, superviseTranscript } = require("./supervisor");
const { initWeights } = require("../energy/train");
const { evaluate } = require("../energy/eval");
const { loadWeights } = require("../energy/model");

const ROOT = __dirname;
const OUT = path.join(ROOT, "runs");
const ENERGY_WEIGHTS = path.join(ROOT, "..", "energy", "weights.json");

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function official(transcript) {
  return transcript.phases.find((phase) => phase.name === "official-eval");
}

function updatePhase(transcript) {
  return transcript.phases.find((phase) => phase.name === "update-weights");
}

function initPhase(transcript) {
  return transcript.phases.find((phase) => phase.name === "init");
}

function repoPath(file) {
  return path.relative(path.join(ROOT, "..", ".."), file).split(path.sep).join("/");
}

function gapText(value) {
  return typeof value === "number" ? value.toFixed(3) : "none";
}

function reportTeam(transcript) {
  const score = official(transcript);
  const update = updatePhase(transcript);
  const failed = score.failures.length > 0 || score.accepted < score.drags;
  console.log(
    "team " +
      transcript.iteration +
      " owner=" +
      update.role +
      " steps=" +
      update.stepsApplied +
      "/" +
      update.maxEpochs +
      " changed=" +
      update.changedParameters +
      "/" +
      update.parameterCount +
      " accept=" +
      score.accepted +
      "/" +
      score.drags +
      " separated=" +
      score.separated +
      "/" +
      score.drags +
      " minGap=" +
      gapText(score.minGap) +
      " loss " +
      update.lossBefore.toFixed(4) +
      " -> " +
      update.lossAfter.toFixed(4) +
      (failed ? " failed" : " passed")
  );
}

function baseTranscript(patch) {
  const transcript = {
    iteration: 3,
    artifact: "runs/team-3/weights.json",
    team: {
      version: 1,
      iteration: 3,
      roles: [
        {
          name: "weight_trainer",
          prompt: "Step the pairwise energy loss.",
          updatesWeights: true,
          learningRate: 0.25,
        },
        {
          name: "eval_runner",
          prompt: "Run the official window-drag energy eval. Do not write parameters.",
          updatesWeights: false,
          learningRate: 0,
        },
      ],
      phases: [
        { name: "init", role: "weight_trainer" },
        { name: "update-weights", role: "weight_trainer" },
        { name: "official-eval", role: "eval_runner" },
      ],
      ownership: { weightUpdate: "weight_trainer", officialEval: "eval_runner" },
      training: {
        seed: 1,
        startFrom: "runs/team-2/weights.json",
        method: "sgd",
        maxEpochs: 10,
        stop: "eval-pass",
      },
      knowledge: {
        read: ["runs/team-2/weights.json"],
        writeWeights: "runs/team-3/weights.json",
      },
    },
    phases: [
      { name: "init", role: "weight_trainer", source: "artifact" },
      {
        name: "update-weights",
        role: "weight_trainer",
        updatesWeights: true,
        learningRate: 0.25,
        method: "sgd",
        maxEpochs: 10,
        stepsApplied: 10,
        gradL2: 0.05,
        acceptedBefore: 4,
        changedParameters: 20,
        parameterCount: 225,
        parameterL1: 1.5,
      },
      {
        name: "official-eval",
        role: "eval_runner",
        accepted: 4,
        separated: 2,
        drags: 16,
        minGap: -0.2,
        failures: ["Nw East chose Sw, rejected by accept"],
      },
    ],
  };
  return patch(transcript);
}

function checkSupervisorBranches() {
  const stalled = superviseTranscript(
    baseTranscript((transcript) => transcript),
    "runs/team-3/transcript.json"
  );
  assert.equal(stalled.stalled, true);
  assert.ok(stalled.why.includes("stayed 4/16"));
  assert.ok(!stalled.why.includes("did not move"));
  assert.equal(stalled.team.ownership.weightUpdate, "weight_trainer");
  const trainer = stalled.team.roles.find((role) => role.name === "weight_trainer");
  assert.equal(trainer.updatesWeights, true);
  assert.ok(trainer.learningRate > 0.25);
  assert.equal(stalled.team.training.startFrom, "runs/team-3/weights.json");

  const passing = superviseTranscript(
    baseTranscript((transcript) => {
      const update = transcript.phases[1];
      update.acceptedBefore = 16;
      update.changedParameters = 20;
      const score = transcript.phases[2];
      score.accepted = 16;
      score.separated = 16;
      score.failures = [];
      return transcript;
    }),
    "runs/team-3/transcript.json"
  );
  assert.equal(passing.stalled, false);
  assert.equal(passing.team, null);
}

function main() {
  checkSupervisorBranches();
  const energyBefore = fs.readFileSync(ENERGY_WEIGHTS);
  fs.rmSync(OUT, { recursive: true, force: true });

  const stallTeam = readJson(path.join(ROOT, "stall-team.json"));
  assert.ok(!stallTeam.roles.some((role) => role.name === "weight_trainer"));
  writeJson(path.join(OUT, "team-0", "config.json"), stallTeam);

  const stallTranscript = execute(stallTeam, ROOT);
  const stallTranscriptPath = path.join(OUT, "team-0", "transcript.json");
  writeJson(stallTranscriptPath, stallTranscript);

  const decision = supervise(stallTranscriptPath);
  assert.equal(decision.stalled, true);
  assert.equal(decision.team.ownership.weightUpdate, "weight_trainer");
  const emittedTrainer = decision.team.roles.find((role) => role.name === "weight_trainer");
  assert.equal(emittedTrainer.updatesWeights, true);
  assert.ok(emittedTrainer.learningRate > 0);
  assert.equal(decision.team.training.startFrom, stallTranscript.artifact);

  writeJson(path.join(OUT, "evolution.json"), {
    from: stallTranscript.iteration,
    to: decision.team.iteration,
    why: decision.why,
    weightUpdate: decision.team.ownership.weightUpdate,
    team: decision.team,
  });
  writeJson(path.join(OUT, "team-1", "config.json"), decision.team);

  const nextTranscript = execute(decision.team, ROOT);
  writeJson(path.join(OUT, "team-1", "transcript.json"), nextTranscript);

  const stallScore = official(stallTranscript);
  const nextScore = official(nextTranscript);
  const stallUpdate = updatePhase(stallTranscript);
  const nextUpdate = updatePhase(nextTranscript);
  const stallInit = initPhase(stallTranscript);
  const nextInit = initPhase(nextTranscript);

  assert.equal(stallUpdate.stepsApplied, 0);
  assert.equal(stallUpdate.changedParameters, 0);
  assert.equal(stallUpdate.parameterL1, 0);
  assert.equal(stallUpdate.parameterHashBefore, stallUpdate.parameterHashAfter);
  assert.ok(stallUpdate.gradL2 > 0);
  assert.equal(stallUpdate.skip, "mandate");
  assert.equal(stallInit.source, "seed");
  assert.ok(stallScore.failures.length > 0);
  assert.ok(stallScore.accepted < stallScore.drags);
  assert.ok(decision.why.includes("did not move"));
  assert.match(decision.why, /observer owns the weight update/i);
  assert.ok(decision.why.includes("forbids parameter writes"));
  assert.ok(decision.why.includes(stallScore.accepted + "/" + stallScore.drags));
  assert.ok(decision.why.includes(stallUpdate.gradL2.toFixed(4)));
  assert.ok(decision.why.includes("0 of " + stallUpdate.maxEpochs));
  assert.ok(decision.why.includes(stallScore.failures[0]));

  assert.equal(nextInit.source, "artifact");
  assert.equal(nextInit.accepted, stallScore.accepted);
  assert.ok(nextUpdate.stepsApplied > 0);
  assert.ok(nextUpdate.changedParameters > 0);
  assert.ok(nextUpdate.parameterL1 > 0);
  assert.notEqual(nextUpdate.parameterHashBefore, nextUpdate.parameterHashAfter);
  assert.ok(nextUpdate.scoreTrace.length > 2);
  assert.equal(nextUpdate.scoreTrace[0].accepted, stallScore.accepted);
  assert.equal(nextUpdate.scoreTrace[nextUpdate.scoreTrace.length - 1].step, nextUpdate.stepsApplied);
  assert.ok(nextUpdate.lossAfter < nextUpdate.lossBefore);
  assert.equal(nextScore.accepted, nextScore.drags);
  assert.equal(nextScore.separated, nextScore.drags);
  assert.equal(nextScore.failures.length, 0);
  assert.ok(nextScore.accepted > stallScore.accepted);

  const stallWeights = loadWeights(path.join(ROOT, stallTranscript.artifact));
  const nextWeights = loadWeights(path.join(ROOT, nextTranscript.artifact));
  const stallParameters = parametersOf(stallWeights);
  const nextParameters = parametersOf(nextWeights);
  assert.deepStrictEqual(stallParameters, initWeights(stallTeam.training.seed));
  const moved = parameterDelta(stallParameters, nextParameters);
  assert.ok(moved.changed > 0);
  assert.ok(moved.max > 0);
  const shipped = parameterDelta(nextParameters, parametersOf(loadWeights(ENERGY_WEIGHTS)));
  assert.ok(shipped.changed > 0);
  assert.equal(evaluate(stallWeights).accepted, stallScore.accepted);
  const rescored = evaluate(nextWeights);
  assert.equal(rescored.accepted, nextScore.accepted);
  assert.equal(rescored.failures.length, 0);
  assert.ok(energyBefore.equals(fs.readFileSync(ENERGY_WEIGHTS)));
  assert.notEqual(
    fs.readFileSync(path.join(ROOT, stallTranscript.artifact), "utf8"),
    fs.readFileSync(path.join(ROOT, nextTranscript.artifact), "utf8")
  );

  reportTeam(stallTranscript);
  console.log("supervisor: " + decision.why);
  reportTeam(nextTranscript);
  const acceptChanges = nextUpdate.scoreTrace.filter((point, index, trace) => {
    return (
      index === 0 ||
      index === trace.length - 1 ||
      point.accepted !== trace[index - 1].accepted
    );
  });
  console.log(
    "accept " +
      stallScore.accepted +
      "/" +
      stallScore.drags +
      " -> " +
      nextScore.accepted +
      "/" +
      nextScore.drags
  );
  console.log(
    "accept trace " +
      acceptChanges.map((point) => point.step + ":" + point.accepted).join(" ")
  );
  console.log(
    "weights changed " +
      moved.changed +
      "/" +
      moved.total +
      " parameters, L1 " +
      moved.l1.toFixed(4) +
      ", maxAbs " +
      moved.max.toFixed(4)
  );
  console.log(
    "W1[0][0] " + stallParameters.W1[0][0] + " -> " + nextParameters.W1[0][0]
  );
  console.log("b2 " + stallParameters.b2 + " -> " + nextParameters.b2);
  console.log("team 0 sha256 " + stallUpdate.parameterHashAfter);
  console.log("team 1 sha256 " + nextUpdate.parameterHashAfter);
  console.log(
    "differs from whalewhale/energy/weights.json in " +
      shipped.changed +
      "/" +
      shipped.total +
      " parameters"
  );
  console.log("wrote " + repoPath(path.join(ROOT, stallTranscript.artifact)));
  console.log("wrote " + repoPath(path.join(ROOT, nextTranscript.artifact)));
  console.log("eat stall rewrite ok");
}

main();
