"use strict";

// A patch lists the positions whose BF16 codes differ and stores the new
// code at each one. Reconstruction overwrites those positions.
function encode(previous, next) {
  if (previous.length !== next.length) {
    throw new Error("BF16 views have different lengths");
  }
  const indices = [];
  const values = [];
  for (let i = 0; i < next.length; i++) {
    const before = previous[i] & 0xffff;
    const after = next[i] & 0xffff;
    if (before !== after) {
      indices.push(i);
      values.push(after);
    }
  }
  return { indices, values: Uint16Array.from(values) };
}

function apply(served, patch) {
  if (patch.values.length !== patch.indices.length) {
    throw new Error("patch values and indices have different lengths");
  }
  const next = new Uint16Array(served);
  for (let k = 0; k < patch.indices.length; k++) {
    const index = patch.indices[k];
    if (!Number.isInteger(index) || index < 0 || index >= next.length) {
      throw new Error("patch index out of range");
    }
    next[index] = patch.values[k];
  }
  return next;
}

function syncView(previous, next) {
  const patch = encode(previous, next);
  return { patch, served: apply(previous, patch) };
}

module.exports = { encode, apply, syncView };
