// Reads the Godot 4 PCK embedded in Melvor2.exe from your own Steam install.
// Usage:
//   node tools/extract-pck.mjs list [filter]
//   node tools/extract-pck.mjs extract <outDir> [filter]
// The exe path can be overridden with MELVOR2_EXE.
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_EXE = 'C:/Program Files (x86)/Steam/steamapps/common/Melvor Idle 2 Demo/Melvor2.exe';
const PACK_DIR_ENCRYPTED = 1;
const PACK_REL_FILEBASE = 2;
const FILE_ENCRYPTED = 1;

function readAt(fd, pos, len) {
  const buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, pos);
  return buf;
}

// Embedded packs end with [u64 pckSize]["GDPC"], possibly followed by an Authenticode certificate.
function findPackStart(fd, size) {
  const tailLen = Math.min(size, 1 << 20);
  const tail = readAt(fd, size - tailLen, tailLen);
  for (let i = tail.lastIndexOf('GDPC'); i >= 8; i = tail.lastIndexOf('GDPC', i - 1)) {
    const pckSize = Number(tail.readBigUInt64LE(i - 8));
    const start = size - tailLen + i - 8 - pckSize;
    if (start >= 0 && readAt(fd, start, 4).toString() === 'GDPC') return start;
  }
  if (readAt(fd, 0, 4).toString() === 'GDPC') return 0; // standalone .pck
  throw new Error('No embedded GDPC pack found');
}

export function openPack(exePath = process.env.MELVOR2_EXE || DEFAULT_EXE) {
  const fd = fs.openSync(exePath, 'r');
  const size = fs.fstatSync(fd).size;
  const start = findPackStart(fd, size);
  const hdr = readAt(fd, start, 40);
  const format = hdr.readUInt32LE(4);
  const godot = [hdr.readUInt32LE(8), hdr.readUInt32LE(12), hdr.readUInt32LE(16)].join('.');
  const flags = hdr.readUInt32LE(20);
  let fileBase = Number(hdr.readBigUInt64LE(24));
  if (format < 3) throw new Error(`Unsupported pack format ${format}`);
  if (flags & PACK_DIR_ENCRYPTED) throw new Error('Pack directory is encrypted; not supported');
  if (flags & PACK_REL_FILEBASE) fileBase += start;
  const dirOffset = start + Number(hdr.readBigUInt64LE(32));

  const count = readAt(fd, dirOffset, 4).readUInt32LE(0);
  const entries = [];
  let pos = dirOffset + 4;
  for (let i = 0; i < count; i++) {
    const pathLen = readAt(fd, pos, 4).readUInt32LE(0);
    pos += 4;
    const name = readAt(fd, pos, pathLen).toString('utf8').replace(/\0+$/, '');
    pos += pathLen;
    const meta = readAt(fd, pos, 36);
    pos += 36;
    entries.push({
      path: name,
      offset: fileBase + Number(meta.readBigUInt64LE(0)),
      size: Number(meta.readBigUInt64LE(8)),
      flags: meta.readUInt32LE(32),
    });
  }
  return {
    format, godot, flags, entries,
    read(entry) {
      if (entry.flags & FILE_ENCRYPTED) throw new Error(`${entry.path} is encrypted; not supported`);
      return readAt(fd, entry.offset, entry.size);
    },
    close() { fs.closeSync(fd); },
  };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const [cmd = 'list', a, b] = process.argv.slice(2);
  const pack = openPack();
  const filter = cmd === 'extract' ? b : a;
  const match = (p) => !filter || p.includes(filter);
  if (cmd === 'list') {
    console.log(`pack v${pack.format}, Godot ${pack.godot}, ${pack.entries.length} files`);
    for (const e of pack.entries.filter((e) => match(e.path))) {
      console.log(`${String(e.size).padStart(10)}  ${e.flags & FILE_ENCRYPTED ? 'E' : ' '} ${e.path}`);
    }
  } else if (cmd === 'extract') {
    if (!a) throw new Error('extract needs an output directory');
    let n = 0;
    for (const e of pack.entries.filter((e) => match(e.path))) {
      const out = path.join(a, e.path.replace(/^res:\/\//, ''));
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, pack.read(e));
      n++;
    }
    console.log(`extracted ${n} files to ${a}`);
  }
  pack.close();
}
