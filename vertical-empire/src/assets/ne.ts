/**
 * Reads the resource table out of a 16-bit Windows "New Executable".
 *
 * SimTower is a Windows 3.1 program, so every bitmap, palette and sound it
 * owns is a resource inside SIMTOWER.EXE rather than a file on disk. Nothing
 * here is SimTower-specific: it is the NE container format, which is public
 * and documented. What the resources *mean* lives in `slice.ts`.
 *
 * Deliberately dependency-free and DOM-free so the same code runs in the
 * extractor CLI under Node and in the browser on a file the player picked.
 */

/** Resource type and resource ID, exactly as stored — high bit and all. */
export type ResourceTable = Map<number, Map<number, Uint8Array>>;

export class NotAnExecutableError extends Error {}

const MZ_MAGIC = 0x5a4d; // 'MZ', little-endian
const NE_MAGIC = 0x454e; // 'NE', little-endian
/** Offset of the resource table pointer within the NE header. */
const NE_RESOURCE_TABLE = 0x24;
/** Bytes per NAMEINFO entry: offset, length, flags, id, handle, usage. */
const NAMEINFO_SIZE = 12;

/**
 * Parses `bytes` as an NE executable and returns every resource it holds,
 * keyed by raw type ID then raw resource ID.
 *
 * Integer types and IDs have their high bit set (so RT_BITMAP arrives as
 * 0x8002, not 2). The raw value is kept because SimTower's own resource IDs
 * are documented that way, and because named — rather than numbered — types
 * would otherwise collide with them.
 */
export function readResources(bytes: Uint8Array): ResourceTable {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (bytes.byteLength < 0x40 || view.getUint16(0, true) !== MZ_MAGIC) {
    throw new NotAnExecutableError('Not a DOS/Windows executable (no MZ header).');
  }

  // The DOS stub is a real, if useless, program; the Windows half starts
  // wherever e_lfanew points.
  const neOffset = view.getUint32(0x3c, true);
  if (neOffset + NE_RESOURCE_TABLE + 2 > bytes.byteLength) {
    throw new NotAnExecutableError('Truncated: the NE header lies past the end of the file.');
  }
  if (view.getUint16(neOffset, true) !== NE_MAGIC) {
    throw new NotAnExecutableError(
      'Not a 16-bit Windows executable. A compressed SIMTOWER.EX_ has to be expanded first.',
    );
  }

  // Relative to the NE header, not the file.
  const tableOffset = neOffset + view.getUint16(neOffset + NE_RESOURCE_TABLE, true);
  const resources: ResourceTable = new Map();

  // Every offset and length in the table is in units of 1<<alignShift, which
  // is how a 16-bit field addresses a file larger than 64 KB.
  const alignShift = view.getUint16(tableOffset, true);
  let cursor = tableOffset + 2;

  // A zero type ID ends the table; the resource name strings follow it.
  for (;;) {
    if (cursor + 8 > bytes.byteLength) {
      throw new NotAnExecutableError('Truncated: the resource table runs off the end of the file.');
    }
    const typeId = view.getUint16(cursor, true);
    if (typeId === 0) break;

    const count = view.getUint16(cursor + 2, true);
    cursor += 8; // typeId, count, and four reserved bytes

    const byId = resources.get(typeId) ?? new Map<number, Uint8Array>();
    resources.set(typeId, byId);

    for (let i = 0; i < count; i += 1) {
      if (cursor + NAMEINFO_SIZE > bytes.byteLength) {
        throw new NotAnExecutableError('Truncated: a resource entry runs off the end of the file.');
      }
      const start = view.getUint16(cursor, true) << alignShift;
      const length = view.getUint16(cursor + 2, true) << alignShift;
      const id = view.getUint16(cursor + 6, true);
      cursor += NAMEINFO_SIZE;

      // A resource pointing outside the file means we have misread the table.
      // Better to say so than to hand back a slice of nothing.
      if (start + length > bytes.byteLength) {
        throw new NotAnExecutableError(
          `Resource ${hex(typeId)}/${hex(id)} claims bytes ${start}..${start + length}, past the end of the file.`,
        );
      }
      byId.set(id, bytes.subarray(start, start + length));
    }
  }

  return resources;
}

/** `0x8002`-style formatting, for error messages and the inventory dump. */
export function hex(value: number): string {
  return `0x${value.toString(16).padStart(4, '0')}`;
}
