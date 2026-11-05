import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { DraggableRenderer } from "dragology";
import { windowPicture } from "./picture.js";

const require = createRequire(import.meta.url);
const { CELLS, GESTURES, reachable } = require("../reachable.js");

// Dragology's renderer reads document and schedules frames. Keep the
// frames from firing so the process can exit once the spec is read.
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
});
const { window } = dom;
function installGlobal(name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  if (descriptor && !descriptor.writable && !descriptor.set) return;
  globalThis[name] = value;
}

installGlobal("window", window);
installGlobal("document", window.document);
installGlobal("HTMLElement", window.HTMLElement);
installGlobal("SVGElement", window.SVGElement);
installGlobal("Element", window.Element);
installGlobal("Node", window.Node);
installGlobal("DocumentFragment", window.DocumentFragment);
installGlobal("MutationObserver", window.MutationObserver);
installGlobal("getComputedStyle", window.getComputedStyle.bind(window));
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
window.requestAnimationFrame = globalThis.requestAnimationFrame;
window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Cells named by the drag spec Dragology built. Not a copy of the fixture.
function cellsInSpec(spec) {
  if (spec.type === "fixed") return [spec.state.cell];
  if (spec.type === "closest" || spec.type === "between") {
    return spec.specs.flatMap(cellsInSpec);
  }
  throw new Error("unreadable drag spec type " + spec.type);
}

function sameCells(actual, expected) {
  assert.deepStrictEqual([...actual].sort(), [...expected].sort());
}

function readDrag(cell, gesture) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  let status = null;
  act(() => {
    root.render(
      createElement(DraggableRenderer, {
        draggable: windowPicture(gesture),
        state: { cell },
        width: 240,
        height: 240,
        dragThreshold: 0,
        simulateDrag: { id: "window" },
        onDragStatus(next) {
          status = next;
        },
      }),
    );
  });
  act(() => {
    root.unmount();
  });
  host.remove();
  if (!status || status.type !== "dragging") {
    throw new Error(
      "dragology did not read a drag for " + cell + " " + gesture,
    );
  }
  return status;
}

// A candidate is accepted when the running drag drops on that cell
// with the pointer on the position the spec rendered for it.
function accepts(status) {
  const traced = status.result.tracedSpec;
  const named = traced.specs.map((spec) => {
    assert.equal(spec.type, "fixed");
    const position = spec.traceInfo && spec.traceInfo.position;
    if (!position) throw new Error("dragology rendered no position");
    return { cell: spec.state.cell, position };
  });
  const accepted = [];
  for (const candidate of CELLS) {
    const target = named.find((place) => place.cell === candidate);
    if (!target) continue;
    const result = status.behavior({ pointer: target.position });
    if (result.dropState.cell === candidate) accepted.push(candidate);
  }
  return accepted;
}

function main() {
  let accepted = 0;
  let rejected = 0;
  for (const cell of CELLS) {
    for (const gesture of GESTURES) {
      const status = readDrag(cell, gesture);
      const fromSpec = cellsInSpec(status.specForDropZoneVis);
      const fromBehavior = accepts(status);
      const allowed = reachable(cell, gesture);
      sameCells(fromSpec, allowed);
      sameCells(fromBehavior, allowed);
      for (const candidate of CELLS) {
        const ok = fromBehavior.includes(candidate);
        assert.equal(ok, allowed.includes(candidate));
        if (ok) accepted += 1;
        else rejected += 1;
      }
    }
  }
  assert.equal(accepted, 24);
  assert.equal(rejected, 40);
  console.log(
    "dragology reading agrees: " +
      accepted +
      " in-set candidates accepted, " +
      rejected +
      " others rejected",
  );
}

main();
