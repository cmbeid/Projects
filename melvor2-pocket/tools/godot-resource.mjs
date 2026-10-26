// Minimal reader for Godot 4 binary resources (RSRC), enough for the audio the demo ships:
// AudioStreamOggVorbis (with its OggPacketSequence) and AudioStreamWAV. Returns every internal resource's
// properties as plain JS values.
const V = {
  NIL: 1, BOOL: 2, INT: 3, FLOAT: 4, STRING: 5, VECTOR2: 10, RECT2: 11, VECTOR3: 12, COLOR: 20, OBJECT: 24,
  DICTIONARY: 26, ARRAY: 30, BYTES: 31, INT32S: 32, FLOAT32S: 33, STRINGS: 34, INT64: 40, DOUBLE: 41,
  STRING_NAME: 44, VECTOR2I: 45, INT64S: 48, FLOAT64S: 49,
};
const OBJECT_EMPTY = 0;
const OBJECT_EXTERNAL = 1;
const OBJECT_INTERNAL = 2;
const OBJECT_EXTERNAL_INDEX = 3;
const FLAG_UIDS = 2;
const FLAG_SCRIPT_CLASS = 4;
const RESERVED_FIELDS = 11;

export function readResource(buf) {
  let pos = 0;
  const u32 = () => { const v = buf.readUInt32LE(pos); pos += 4; return v; };
  const i32 = () => { const v = buf.readInt32LE(pos); pos += 4; return v; };
  const u64 = () => { const v = buf.readBigUInt64LE(pos); pos += 8; return v; };
  const i64 = () => { const v = buf.readBigInt64LE(pos); pos += 8; return v; };
  const f32 = () => { const v = buf.readFloatLE(pos); pos += 4; return v; };
  const f64 = () => { const v = buf.readDoubleLE(pos); pos += 8; return v; };
  const str = () => {
    const len = u32();
    const s = buf.toString('utf8', pos, pos + len).replace(/\0+$/, '');
    pos += len;
    return s;
  };
  const pad4 = (n) => { pos += (4 - (n % 4)) % 4; };

  if (buf.toString('latin1', 0, 4) !== 'RSRC') throw new Error('Not an uncompressed Godot binary resource');
  pos = 4;
  if (u32() !== 0) throw new Error('Big-endian resources are not supported');
  const real64 = u32() !== 0;
  u32(); u32(); // version major/minor
  const format = u32();
  const type = str();
  u64(); // import metadata offset
  const flags = u32();
  if (flags & FLAG_UIDS) u64(); else u64();
  if (flags & FLAG_SCRIPT_CLASS) str();
  for (let i = 0; i < RESERVED_FIELDS; i++) u32();
  const names = Array.from({ length: u32() }, str);
  const extCount = u32();
  for (let i = 0; i < extCount; i++) {
    str(); str();
    if (flags & FLAG_UIDS) u64();
  }
  const internal = Array.from({ length: u32() }, () => ({ path: str(), offset: Number(u64()) }));

  const variant = () => {
    const t = u32();
    switch (t) {
      case V.NIL: return null;
      case V.BOOL: return u32() !== 0;
      case V.INT: return i32();
      case V.INT64: return i64();
      case V.FLOAT: return f32();
      case V.DOUBLE: return f64();
      case V.STRING: case V.STRING_NAME: return str();
      case V.VECTOR2: case V.VECTOR2I: return real64 && t === V.VECTOR2 ? [f64(), f64()] : [f32(), f32()];
      case V.RECT2: return [f32(), f32(), f32(), f32()];
      case V.VECTOR3: return [f32(), f32(), f32()];
      case V.COLOR: return [f32(), f32(), f32(), f32()];
      case V.OBJECT: {
        const kind = u32();
        if (kind === OBJECT_EMPTY) return null;
        if (kind === OBJECT_INTERNAL) return { internal: u32() };
        if (kind === OBJECT_EXTERNAL) { str(); str(); return { external: true }; }
        if (kind === OBJECT_EXTERNAL_INDEX) return { external: u32() };
        throw new Error(`Unknown object kind ${kind}`);
      }
      case V.DICTIONARY: {
        const n = u32() & 0x7fffffff;
        const d = new Map();
        for (let i = 0; i < n; i++) d.set(variant(), variant());
        return d;
      }
      case V.ARRAY: {
        let n = u32();
        // Typed arrays (resource format 6) carry an element-type header before the items.
        if (n & 0x80000000) {
          n &= 0x7fffffff;
        }
        return Array.from({ length: n }, variant);
      }
      case V.BYTES: { const n = u32(); const b = buf.subarray(pos, pos + n); pos += n; pad4(n); return b; }
      case V.INT32S: return Array.from({ length: u32() }, i32);
      case V.FLOAT32S: return Array.from({ length: u32() }, f32);
      case V.INT64S: return Array.from({ length: u32() }, i64);
      case V.FLOAT64S: return Array.from({ length: u32() }, f64);
      case V.STRINGS: return Array.from({ length: u32() }, str);
      default: throw new Error(`Unsupported variant type ${t} at ${pos - 4}`);
    }
  };

  const resources = internal.map(({ offset }) => {
    pos = offset;
    const rtype = str();
    const props = {};
    const count = u32();
    for (let i = 0; i < count; i++) {
      const nameIdx = u32();
      props[names[nameIdx & 0x7fffffff]] = variant();
    }
    return { type: rtype, props };
  });
  return { type, format, resources };
}
