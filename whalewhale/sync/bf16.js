"use strict";

// Nearest-even BF16 cast of a trainer weight. The master value is narrowed
// through float32, then the low 16 bits round to even.
function bf16Bits(value) {
  if (!Number.isFinite(value)) {
    throw new Error("BF16 cast expects a finite weight");
  }
  const f32 = new Float32Array(1);
  const u32 = new Uint32Array(f32.buffer);
  f32[0] = value;
  const bits = u32[0];
  const lsb = (bits >>> 16) & 1;
  const rounded = (bits + 0x7fff + lsb) >>> 0;
  return rounded >>> 16;
}

// Little-endian bytes of BF16 codes. Two bytes per value.
function bf16Bytes(bits) {
  const bytes = Buffer.alloc(bits.length * 2);
  for (let i = 0; i < bits.length; i++) {
    bytes.writeUInt16LE(bits[i] & 0xffff, i * 2);
  }
  return bytes;
}

module.exports = { bf16Bits, bf16Bytes };
