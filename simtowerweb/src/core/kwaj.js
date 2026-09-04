// KWAJ (Microsoft COMPRESS.EXE) decompressor for SIMTOWER.EX_.
//
// The original disk media uses method 3 (Jeff Johnson LZ+Huffman). This is a
// small, dependency-free implementation based on the public KWAJ format. It
// returns the decompressed executable in memory; callers never write it to
// disk.

class BitReader {
  constructor(bytes, offset) {
    this.bytes = bytes;
    this.offset = offset;
    this.bit = 0;
  }

  readBit() {
    if (this.offset >= this.bytes.length) return null;
    const value = (this.bytes[this.offset] >> (7 - this.bit)) & 1;
    this.bit += 1;
    if (this.bit === 8) {
      this.bit = 0;
      this.offset += 1;
    }
    return value;
  }

  readBits(count) {
    let value = 0;
    for (let i = 0; i < count; i++) {
      const bit = this.readBit();
      if (bit === null) return null;
      value = (value << 1) | bit;
    }
    return value;
  }
}

function readU16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function readLengths(reader, encoding, count) {
  if (encoding === 0) {
    const length = Math.round(Math.log2(count));
    return Array(count).fill(length);
  }

  const lengths = [];
  for (let i = 0; i < count; i++) {
    let value;
    if (i === 0 || encoding === 3) {
      value = reader.readBits(4);
    } else if (encoding === 1) {
      if (reader.readBit() === 0) value = lengths[i - 1];
      else if (reader.readBit() === 0) value = lengths[i - 1] + 1;
      else value = reader.readBits(4);
    } else if (encoding === 2) {
      const selector = reader.readBits(2);
      value = selector === 3 ? reader.readBits(4) : lengths[i - 1] + selector - 1;
    } else {
      throw new Error("Unsupported KWAJ Huffman-length encoding");
    }
    if (value === null || value < 0 || value > 16) throw new Error("Invalid KWAJ Huffman length");
    lengths.push(value);
  }
  return lengths;
}

function makeHuffman(lengths) {
  const maxLength = Math.max(...lengths);
  const byCode = new Map();
  let code = 0;
  for (let length = 1; length <= maxLength; length++) {
    for (let symbol = 0; symbol < lengths.length; symbol++) {
      if (lengths[symbol] === length) {
        byCode.set(`${length}:${code}`, symbol);
        code += 1;
      }
    }
    code <<= 1;
  }
  return {
    read(reader) {
      let codeValue = 0;
      for (let length = 1; length <= maxLength; length++) {
        const bit = reader.readBit();
        if (bit === null) return null;
        codeValue = (codeValue << 1) | bit;
        const symbol = byCode.get(`${length}:${codeValue}`);
        if (symbol !== undefined) return symbol;
      }
      throw new Error("Invalid KWAJ Huffman code");
    },
  };
}

function parseHeader(bytes) {
  if (bytes.length < 14 || String.fromCharCode(...bytes.subarray(0, 4)) !== "KWAJ") {
    throw new Error("Not a KWAJ compressed file");
  }
  const method = readU16(bytes, 8);
  const dataOffset = readU16(bytes, 10);
  const flags = readU16(bytes, 12);
  if (dataOffset < 14 || dataOffset > bytes.length) throw new Error("Invalid KWAJ data offset");
  let cursor = 14;
  let length = null;
  if (flags & 0x01) {
    length = readU32(bytes, cursor);
    cursor += 4;
  }
  if (flags & 0x02) cursor += 2;
  if (flags & 0x04) cursor += 2 + readU16(bytes, cursor);
  for (const [flag, maxLength] of [[0x08, 9], [0x10, 4]]) {
    if (flags & flag) {
      let consumed = 0;
      while (cursor + consumed < bytes.length && consumed < maxLength && bytes[cursor + consumed] !== 0) consumed += 1;
      cursor += Math.min(consumed + 1, maxLength);
    }
  }
  if (flags & 0x20) cursor += 2 + readU16(bytes, cursor);
  if (cursor > dataOffset) throw new Error("Invalid KWAJ header extensions");
  return { method, dataOffset, length };
}

function decompressLzh(bytes, dataOffset, expectedLength) {
  const reader = new BitReader(bytes, dataOffset);
  const encodings = Array.from({ length: 6 }, () => reader.readBits(4));
  if (encodings.some((value) => value === null || value > 3)) throw new Error("Invalid KWAJ Huffman table header");
  const trees = [16, 16, 32, 64, 256].map((count, index) => (
    makeHuffman(readLengths(reader, encodings[index], count))
  ));
  const [matchLength, matchLength2, literalLength, matchOffset, literal] = trees;
  const out = [];
  const window = new Uint8Array(4096).fill(0x20);
  let position = 4096 - 17;
  let selected = matchLength;

  const put = (value) => {
    const byte = value & 0xff;
    out.push(byte);
    window[position] = byte;
    position = (position + 1) & 4095;
  };

  while (expectedLength === null || out.length < expectedLength) {
    const code = selected.read(reader);
    if (code === null) break;
    if (code > 0) {
      const high = matchOffset.read(reader);
      const low = reader.readBits(6);
      if (high === null || low === null) throw new Error("Truncated KWAJ match");
      let source = (position - ((high << 6) | low)) & 4095;
      for (let count = code + 2; count > 0 && (expectedLength === null || out.length < expectedLength); count--) {
        put(window[source]);
        source = (source + 1) & 4095;
      }
      selected = matchLength;
    } else {
      const run = literalLength.read(reader);
      if (run === null) throw new Error("Truncated KWAJ literal run");
      if (run !== 31) selected = matchLength2;
      for (let count = run + 1; count > 0 && (expectedLength === null || out.length < expectedLength); count--) {
        const value = literal.read(reader);
        if (value === null) throw new Error("Truncated KWAJ literal");
        put(value);
      }
    }
  }
  if (expectedLength !== null && out.length !== expectedLength) {
    throw new Error("KWAJ output length did not match its header");
  }
  return Uint8Array.from(out);
}

export function decompressKwaj(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const { method, dataOffset, length } = parseHeader(bytes);
  if (method === 0) return bytes.slice(dataOffset);
  if (method === 1) return Uint8Array.from(bytes.subarray(dataOffset), (byte) => byte ^ 0xff);
  if (method === 3) return decompressLzh(bytes, dataOffset, length);
  throw new Error(`Unsupported KWAJ compression method ${method}`);
}
