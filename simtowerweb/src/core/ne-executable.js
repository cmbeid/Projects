// Minimal Win16 NE executable resource reader.
// SimTower stores its bitmaps, palettes and WAV files in this table. The
// parser is import-safe in Bun and works entirely on a caller-provided buffer.

function bytesForView(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new TypeError("Expected an ArrayBuffer or Uint8Array");
}

function inRange(bytes, offset, length = 1) {
  return Number.isSafeInteger(offset) && Number.isSafeInteger(length) &&
    offset >= 0 && length >= 0 && offset + length <= bytes.byteLength;
}

export class NEExecutable {
  constructor(input) {
    this.bytes = bytesForView(input);
    this.view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
    this.resources = new Map();
  }

  readU16(offset) {
    if (!inRange(this.bytes, offset, 2)) throw new Error("Unexpected end of NE executable");
    return this.view.getUint16(offset, true);
  }

  readU32(offset) {
    if (!inRange(this.bytes, offset, 4)) throw new Error("Unexpected end of NE executable");
    return this.view.getUint32(offset, true);
  }

  load() {
    if (!inRange(this.bytes, 0, 64) || this.bytes[0] !== 0x4d || this.bytes[1] !== 0x5a) {
      throw new Error("Not a DOS/NE executable");
    }
    const neOffset = this.readU32(0x3c);
    if (!inRange(this.bytes, neOffset, 0x34) || this.bytes[neOffset] !== 0x4e || this.bytes[neOffset + 1] !== 0x45) {
      throw new Error("Not a Win16 NE executable");
    }

    const resourceTableOffset = this.readU16(neOffset + 0x24);
    const tableStart = neOffset + resourceTableOffset;
    if (!inRange(this.bytes, tableStart, 2)) throw new Error("Missing NE resource table");
    const alignmentShift = this.readU16(tableStart);
    let cursor = tableStart + 2;
    this.resources.clear();

    while (true) {
      if (!inRange(this.bytes, cursor, 8)) throw new Error("Truncated NE resource table");
      const type = this.readU16(cursor);
      const count = this.readU16(cursor + 2);
      cursor += 8; // type, count, reserved DWORD
      if (type === 0) break;
      const group = new Map();
      for (let index = 0; index < count; index++) {
        if (!inRange(this.bytes, cursor, 12)) throw new Error("Truncated NE resource entry");
        const resourceOffset = this.readU16(cursor) << alignmentShift;
        const resourceLength = this.readU16(cursor + 2) << alignmentShift;
        const id = this.readU16(cursor + 6);
        cursor += 12;
        if (!inRange(this.bytes, resourceOffset, resourceLength)) {
          throw new Error(`NE resource 0x${id.toString(16)} lies outside the executable`);
        }
        group.set(id, this.bytes.subarray(resourceOffset, resourceOffset + resourceLength));
      }
      this.resources.set(type, group);
    }
    return this;
  }

  getResource(type, id) {
    return this.resources.get(type)?.get(id) || null;
  }

  getResources(type) {
    return this.resources.get(type) || new Map();
  }
}

export function parseNEExecutable(input) {
  return new NEExecutable(input).load();
}
