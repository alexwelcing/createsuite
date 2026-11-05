"use strict";

const fs = require("fs");
const path = require("path");

// A team that never writes parameters gets this SGD rate on the imported
// pairwise loss. The budget is wider than the stalled run; the executor
// stops early when the official eval passes.
const REPLACEMENT_LEARNING_RATE = 1;
const REPLACEMENT_MAX_EPOCHS = 200;

function relativeToEat(file) {
  const rel = path.relative(__dirname, path.resolve(file));
  const parts = rel.split(path.sep);
  if (rel === "" || path.isAbsolute(rel) || parts.includes("..")) {
    throw new Error("transcript must stay under the eat directory");
  }
  return parts.join("/");
}

function phase(transcript, name) {
  const found = transcript.phases.find((item) => item.name === name);
  if (!found) throw new Error("transcript has no " + name + " phase");
  return found;
}

function roleByName(team, name) {
  const role = team.roles.find((item) => item.name === name);
  if (!role) throw new Error("transcript team has no role " + name);
  return role;
}

function num(value) {
  return Number.isFinite(value) ? value.toFixed(4) : String(value);
}

function sentence(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function artifactPath(rel) {
  if (typeof rel !== "string" || rel.length === 0) {
    throw new Error("artifact path is missing");
  }
  const parts = rel.split(/[\\/]/);
  if (path.isAbsolute(rel) || parts.includes("..") || parts[0] === "") {
    throw new Error("artifact path must stay inside eat: " + rel);
  }
  return rel;
}

function explain(transcript, owner, update, official) {
  const parts = ["team " + transcript.iteration + " stalled"];
  if (update.changedParameters === 0) {
    parts.push(
      "weights did not move (" +
        update.changedParameters +
        " of " +
        update.parameterCount +
        " parameters changed, L1 " +
        num(update.parameterL1) +
        ")"
    );
  } else {
    parts.push(
      "weights moved (" +
        update.changedParameters +
        " of " +
        update.parameterCount +
        " parameters) but the official accept score did not"
    );
  }
  if (owner.updatesWeights !== true) {
    parts.push(owner.name + " owns the weight update and its mandate forbids parameter writes");
  } else if (!(owner.learningRate > 0)) {
    parts.push(owner.name + " owns the weight update but learningRate is " + owner.learningRate);
  }
  if (update.stepsApplied === 0) {
    parts.push(
      "the update phase applied 0 of " +
        update.maxEpochs +
        " " +
        update.method +
        " steps; the pairwise gradient norm was " +
        num(update.gradL2)
    );
  } else if (official.accepted <= update.acceptedBefore) {
    parts.push(
      owner.name +
        " applied " +
        update.stepsApplied +
        " steps at learningRate " +
        owner.learningRate +
        " and the accept score stayed " +
        official.accepted +
        "/" +
        official.drags
    );
  }
  parts.push(
    "the official eval stayed failed: accept " +
      official.accepted +
      "/" +
      official.drags +
      ", separated " +
      official.separated +
      "/" +
      official.drags +
      (official.failures.length > 0 ? ", first failure: " + official.failures[0] : "")
  );
  return parts.map(sentence).join(". ") + ".";
}

function buildTeam(options) {
  return {
    version: 1,
    iteration: options.iteration,
    roles: [
      {
        name: options.trainerName,
        prompt: options.trainerPrompt,
        updatesWeights: true,
        learningRate: options.learningRate,
      },
      {
        name: options.evalName,
        prompt: options.evalPrompt,
        updatesWeights: false,
        learningRate: 0,
      },
    ],
    phases: [
      { name: "init", role: options.trainerName },
      { name: "update-weights", role: options.trainerName },
      { name: "official-eval", role: options.evalName },
    ],
    ownership: {
      weightUpdate: options.trainerName,
      officialEval: options.evalName,
    },
    training: {
      seed: options.seed,
      startFrom: options.startFrom,
      method: "sgd",
      maxEpochs: options.maxEpochs,
      stop: "eval-pass",
    },
    knowledge: {
      read: options.read,
      writeWeights: options.writeWeights,
    },
  };
}

function nextTeam(transcript, transcriptRel, owner, update, official) {
  const immobile =
    update.changedParameters === 0 ||
    update.stepsApplied === 0 ||
    owner.updatesWeights !== true ||
    !(owner.learningRate > 0);
  const iteration = transcript.iteration + 1;
  const startFrom = artifactPath(transcript.artifact);
  const evalRole = roleByName(transcript.team, transcript.team.ownership.officialEval);
  const trainerName = immobile ? "weight_trainer" : owner.name;
  const learningRate = immobile
    ? REPLACEMENT_LEARNING_RATE
    : Math.max(REPLACEMENT_LEARNING_RATE, owner.learningRate * 2);
  const maxEpochs = immobile
    ? REPLACEMENT_MAX_EPOCHS
    : Math.max(REPLACEMENT_MAX_EPOCHS, transcript.team.training.maxEpochs);
  const trainerPrompt = immobile
    ? "You own the energy weight update. Load the stalled weights and apply SGD to the pairwise energy loss until the official window-drag eval passes. Write a new weight artifact. Do not change the accept rule."
    : "You own the energy weight update. The previous steps left the official accept score failed, so continue SGD from this weight artifact with a larger learning rate until the official window-drag eval passes. Do not change the accept rule.";
  if (official.failures.length === 0 && official.accepted === official.drags) {
    throw new Error("refusing to rewrite a team whose official eval passed");
  }
  return buildTeam({
    iteration,
    trainerName,
    trainerPrompt,
    learningRate,
    maxEpochs,
    evalName: evalRole.name,
    evalPrompt: evalRole.prompt,
    seed: transcript.team.training.seed,
    startFrom,
    read: [startFrom, artifactPath(transcriptRel)],
    writeWeights: "out/team-" + iteration + "/weights.json",
  });
}

function decide(transcript, transcriptRel) {
  const ownerName = transcript.team.ownership.weightUpdate;
  const owner = roleByName(transcript.team, ownerName);
  const update = phase(transcript, "update-weights");
  const official = phase(transcript, "official-eval");
  if (update.role !== owner.name) {
    throw new Error("transcript update role does not match ownership");
  }
  if (update.updatesWeights !== owner.updatesWeights || update.learningRate !== owner.learningRate) {
    throw new Error("transcript update mandate does not match the owning role");
  }
  artifactPath(transcript.artifact);
  const scoreFailed = official.failures.length > 0 || official.accepted < official.drags;
  if (!scoreFailed) {
    return {
      stalled: false,
      why:
        "Official eval passed with accept " + official.accepted + "/" + official.drags + ".",
      team: null,
    };
  }
  const team = nextTeam(transcript, transcriptRel, owner, update, official);
  if (team.ownership.weightUpdate === owner.name && owner.updatesWeights !== true) {
    throw new Error("next team still leaves the weight update with a role that cannot write");
  }
  const nextOwner = roleByName(team, team.ownership.weightUpdate);
  if (nextOwner.updatesWeights !== true || !(nextOwner.learningRate > 0)) {
    throw new Error("next weight owner must be mandated to step parameters");
  }
  return {
    stalled: true,
    why: explain(transcript, owner, update, official),
    team,
  };
}

function supervise(transcriptPath) {
  const transcript = JSON.parse(fs.readFileSync(transcriptPath, "utf8"));
  return decide(transcript, relativeToEat(transcriptPath));
}

function superviseTranscript(transcript, transcriptRel) {
  return decide(transcript, transcriptRel || "out/team-0/transcript.json");
}

module.exports = { supervise, superviseTranscript };
