# Whalewhale

This is the system as it stands once the stack is on main, and the reasoning that produced it.

The prod team attaches two harness models, Z.ai GLM and Minimax M3, and deploys the forward pass to Cloudflare. Those models are the agents' language models. They are not the software. The software is an energy-based model or a JEPA. A request at runtime is the current state plus a gesture. The forward pass returns the next state. The host presents that state and reads the result back. No application code runs on that path.

## What I was trying to build

Create Suite, this repository, is a swarm that still makes software. Agents, git-backed tasks, mailboxes, and a desktop that deploys as an app. Whalewhale keeps the aim of that swarm, which is a suite you can hand to agents, and leaves the practice of writing the suite. The agents fit a network until the network is the suite.

An interface arrives in one of three shapes. It can be code. It can be a picture of how the thing looks and how a gesture moves. It can be a written description. In ordinary software, types, tests, and a proof are how you say what the program must do. Here that same material is the behavior the network must exhibit. The spec is not a prompt that gets turned into a repository. It is the contract a candidate next state has to pass.

I kept the first slice small on purpose. A window sits on a 2×2 grid: northwest, northeast, southwest, southeast. A cardinal drag may stay on the current cell, or step to the neighbor when that step stays on the grid. That is small enough to score completely, and large enough that a hand-written answer table is an obvious cheat. Twenty-four candidate landings are legal. Forty are not. Every later piece had to agree with that split, or it was not the same behavior.

The stubs came first, and they were supposed to be temporary. `energy(state, gesture, candidate)` and `predict(state, gesture)` returned an allowed cell so the eval had the shape of a forward pass before any weights existed. The contract was the product. The weights came after the contract could already say yes or no.

## Why the model on the request path is an energy model or a JEPA

A legal step has to be something a network can score or predict, not something a handler can implement.

An energy model scores a candidate next state. A legal step is a low-energy candidate the contract accepts. Training pushes legal next cells below illegal ones. On the window drag, an untrained seed accepted 6 of 16 chosen cells. After 16 Adam steps the learned weights accepted 16 of 16, and on every drag the legal cells sat below the illegal ones, with a minimum gap of 1.073.

A JEPA predicts the next state's representation from the current state and the gesture, and a head decodes that prediction into a state. The same contract accepts or rejects the decode. Before training, the same initialization accepted 5 of 16 drags. After training, 16 of 16 decoded next states were accepted, and 8 of those actually changed cell. The labels came from the accept rule. The answer table is not inside the model.

I trained both because the product deals in both classes. Either one can sit in the hole. Neither one is an upstream repository we found and wrapped. DeepSeek Harness, herdr, qwenGPU, Ink, EAT, Dragology, and the PULSE paper are the machinery around the hole. None of them is an energy model or a JEPA. That constraint is ours.

Z.ai GLM and Minimax M3 sit on the other side of that line. They are the language models the harness agents call when a person has to read a spec, argue about a stall, or drive a fine-tune. They do not answer the user's gesture. If a gesture is answered by GLM or Minimax, the suite has collapsed back into an agent that writes software, which is the thing we left. Prod attaches those two models to the harness. The suite weights stay what they are.

qwenGPU stays upstream for the same kind of reason. The repository compiles a GPU into Qwen. The useful idea is the split, not the machine. The host presents state and reads the next state. The forward pass does the work. We did not compile a GPU into the window-drag weights.

## The loop

A spec arrives as Ink, as a picture or a drag, or as prose.

It is read as one contract: the states the suite may occupy, and the transitions a gesture may take. Dragology is the shape for a picture or a drag. Ink is the typed hole for code. Prose is supposed to land on that same contract. I did not build the prose lift. A handwritten parser of one paragraph would have been a fake agent. The lift is a harness agent reading language, and that agent needs GLM or Minimax attached. Until prod does that, prose is the open seam.

The hole is an energy model or a JEPA. The contract stays the official score. Agents may change weights and the training setup. They may not replace the hole with a handler, generated application code, or a compiled stand-in.

DeepSeek Harness runs the agents that hold the spec fixed and execute the eval. herdr keeps their sessions after the client leaves. When the score stalls, an EAT supervisor reads the transcript, names why, and emits the next team. The artifact of that iteration is updated weights, not a new team config sitting next to the old weights.

Training updates the weights. PULSESync ships only the BF16 values that change, stored as values so the served copy reconstructs bit-identical to the trainer's compute view. About 99% of a typical Adam step disappears in the BF16 cast the next forward pass actually uses. Sending the surviving values is the sync. A full-weight copy would have been a file transfer with the paper's name on it.

Serving is that forward pass. Prod puts it on Cloudflare. The host presents state and reads the next state. A user gesture is answered by the suite weights alone.

## What each piece is doing in this repo

The code lives under `whalewhale/`. Create Suite's agents, desktop, and task machinery were left alone. Each piece was composed from upstream and not vendored, except the small plugin, models, and sync we had to write because the hole was ours.

**The fixture.** `behavior.txt` is one paragraph. `reachable.js` is the same allowance as a set of next cells. `window-drag.ink` is the same allowance as one Ink function, `drag`, with one `learn settle` hole. `eval.js` accepts a candidate only when it is in the set. The Ink source stays source. Upstream Ink can lower a finite function to a circuit and then freeze the hole into ordinary code for native, JavaScript, Wasm, or GPU. That freeze path is the old practice, and it stays unused. The hole is the seat of the network.

**DeepSeek Harness.** `whalewhale/plugin` is a Cordis plugin on profile `window-drag`. Upstream `dsh` 0.2.1-rc.5 loaded it with no extra dependency. Boot prints the same 24 and 40 split as the fixture, then the base profile stays up. The harness is where spec intake, the eval, and the handoff to training mount. The plugin we landed mounts the eval. It does not yet call GLM or Minimax. That attachment is prod's.

**herdr.** `whalewhale/herdr/window-drag.layout.json` is a layout whose pane runs `dsh --profile window-drag`. Herdr 0.9.5 is installed from upstream, not copied into the repo. The interesting check was detach. After the client left, the herdr server and its child `dsh` kept running. Reattach showed the same pane and the same process, still holding the line from boot. A long eval or a training watch needs a session that survives the person closing the laptop. That is herdr's job. The harness is the agent. herdr is the process it runs in.

**Dragology.** `whalewhale/drag` turns the window drag into a picture-shaped spec. Dragology 0.1.7 is a dependency. An author names the future states a drag may reach. The library's reading of that spec matches the fixture: 24 accepted, 40 rejected. The SVG library stays upstream. What we own is the claim that a picture and a paragraph are the same contract.

**The energy model.** `whalewhale/energy` is a small parameterized network. `energy(state, gesture, candidate)` is a function of learned weights, trained by gradient updates so legal next cells get lower energy than illegal ones. The eval imports the fixture's accept rule. It does not keep a second copy of the answer table. The finite-difference check matched the backward pass before I was willing to trust the training run. The command is `node whalewhale/energy/train.js`. The saved weights are checked with `node whalewhale/energy/eval.js`.

**The JEPA.** `whalewhale/jepa` is the other legal occupant of the hole. `predict(state, gesture)` encodes the cell, predicts the next representation from the gesture, and a linear head decodes it. Same accept rule, same discipline about not hiding the answer in a switch. `node whalewhale/jepa/train.js` trains it. `node whalewhale/jepa/eval.js` checks the saved weights.

**PULSESync.** `whalewhale/sync` casts the trained energy weights to BF16 and sends only the values that change. The served bytes match the trainer's BF16 bytes: 450 bytes, sha256 `41df5f3a18353e3353f32f9706fff0a11ff8b87f386ccc29141800cdad6c15c4`. A one-value change sends 1 of 225 values. Across the 16 saved Adam steps, 17 unchanged BF16 values are omitted. `node whalewhale/sync/run.js` is the check. PULSELoCo, the trainer-to-trainer half of the paper, waits until more than one trainer exists. We have one trainer.

**EAT.** `whalewhale/eat` is the stall. The first team owns the weight update and is forbidden to write parameters. The gradient is real (norm about 0.09) and is never applied. Zero of 225 parameters change. The accept score stays at 6 of 16. The supervisor reads that transcript and says so: the owner cannot write. The next team is a weight trainer. Forty-two SGD steps later, all 225 parameters have changed and the accept score is 16 of 16. The new weights also differ from the already-trained energy checkpoint in all 225 parameters, so this is not a copy of the successful run pasted in as the "after" state. `node whalewhale/eat/run.js` is the run. Evolving Agent Teams, in the paper, never has the supervisor write the solution. The supervisor names why the score stalled and emits the next team. That is what this run does. The name EAT does not mean an energy-based trainer. The energy model is the artifact. EAT is the policy that changes the team when the artifact stops moving.

**The shade.** `whalewhale/shade` is the second behavior, which is the point where a single drag becomes a suite. A shade is up or down. A tap proposes the other position. The spec lists the legal next positions. There is a paragraph, a reachable set, an Ink hole, and an eval that accepts a candidate only when it is in the set. An energy model trains on that contract. Untrained seed-1 weights accept 1 of 2 taps. After 14 Adam steps the saved weights accept 2 of 2, with a minimum gap of 1.113. The window-drag evals on the same branch still pass. The shade did not borrow the window's answer. It went through the same loop.

## How the pull requests were stacked

The fixture landed first, because everything else agrees with it. The harness plugin sits on the fixture, because the plugin runs that eval. herdr, Dragology, the JEPA, and the energy model sit on the plugin, in separate directories, because they do not need each other's files. PULSESync, the stall supervisor, and the shade sit on the energy model, because they import those weights or that training shape.

They were merged with merge commits, not squashes. A squash would have thrown away the parent commits the children were cut from, and the next pull request would have tried to replay work already on main. The directories are disjoint on purpose, so the parallel branches could land one after another once their parent was on main.

## What I left for prod, and what I left undone

Prod attaches Z.ai GLM and Minimax M3 as the language models inside the harness, and serves the forward pass on Cloudflare. The thing to serve is the learned forward pass: state and gesture in, next state out. The thing not to serve is a JavaScript handler that already knows the legal cell. The host's job is to present state and read the next state. PULSESync is how a trainer keeps that served BF16 copy bit-identical without shipping every byte of every step.

I did not call either provider, and I did not create a Cloudflare resource. Both of those were named as prod's work once the stack was on main.

I did not lift a prose spec. The contract for prose is the same reachable-state set Ink and Dragology already name. Doing that lift honestly means a harness agent reads the paragraph and emits the contract, scored by exact agreement with the fixture. That agent is GLM or Minimax. A local function that pattern-matches the window-drag paragraph would have passed a test and taught us nothing.

I did not freeze the Ink hole back into ordinary code. I did not put a second trainer on PULSELoCo. I did not compile a machine into the weights. I did not let the window-drag plugin, the energy model, and the shade share a hidden answer table.

## How to read a change from here

A change belongs in this system if it keeps the contract as the score and the weights as the implementation. A change leaves the system if it adds a handler on the request path, generates an app, or answers a gesture with GLM or Minimax.

The official score for the window is still the fixture accept rule: 24 in-set candidates, 40 others. The official score for the shade is its own accept rule: 2 in-set, 2 rejected. A new behavior should arrive as a paragraph, a picture, or, once the models are attached, prose, and it should become one contract with a hole. The hole should be trained until that contract passes on learned weights. If the run stalls, the supervisor should change the team and the next artifact should be new weights. The served copy should match the trainer's BF16 view. The person using the suite should be able to close the client and come back to a session that is still there.

That is the whole machine.
