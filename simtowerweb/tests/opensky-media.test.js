// Two things, both of which have gone wrong before:
//
//  1. The vendored art actually being on disk. The OpenSkyScraper edition
//     fetches these by name at runtime, and a missing file degrades silently
//     into a blank icon plus a 404 — invisible in dev, and only noticed in a
//     screenshot. Adding an entry to OPENSKY_SOURCES without re-running
//     scripts/sync-opensky-art.sh should fail the build instead.
//  2. This module staying import-safe without a DOM, which is what lets the
//     manifest be checked here at all.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { OPENSKY_ART_BASE, OPENSKY_SOURCES } from "../src/render/opensky-media.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ART_DIR = join(ROOT, "public", "assets", "opensky");

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

describe("vendored OpenSkyScraper art", () => {
  it("has every file OPENSKY_SOURCES names", () => {
    const missing = Object.entries(OPENSKY_SOURCES)
      .filter(([, file]) => !existsSync(join(ART_DIR, file)))
      .map(([key, file]) => `${key} -> ${file}`);
    expect(missing, "run npm run sync-art").toEqual([]);
  });

  it("vendors nothing the code does not ask for", () => {
    const wanted = new Set(Object.values(OPENSKY_SOURCES));
    const extra = walk(ART_DIR)
      .filter((p) => p.endsWith(".png"))
      .map((p) => p.slice(ART_DIR.length + 1).split("\\").join("/"))
      .filter((rel) => !wanted.has(rel));
    expect(extra).toEqual([]);
  });

  it("vendors real PNGs, not error pages", () => {
    for (const file of Object.values(OPENSKY_SOURCES)) {
      expect(statSync(join(ART_DIR, file)).size, file).toBeGreaterThan(64);
    }
  });

  // The sanitizer in scripts/sync-opensky-art.sh exists because upstream mixes
  // casing and uses spaces. Linux — including the Pages runner — is
  // case-sensitive, so a stray capital here is a 404 that Windows never shows.
  it("names files in the sanitized form the sync script writes", () => {
    for (const file of Object.values(OPENSKY_SOURCES)) {
      const base = file.slice(file.lastIndexOf("/") + 1);
      expect(base, file).toBe(base.toLowerCase());
      expect(base, file).not.toMatch(/ /);
    }
  });
});

describe("headless import safety", () => {
  it("resolves an art base without a document", () => {
    expect(typeof document).toBe("undefined");
    expect(OPENSKY_ART_BASE).toBe("assets/opensky");
  });

  // Nothing here may be origin-rooted: the site is served from a subdirectory
  // on GitHub Pages and an S3 prefix, so a leading "/" would escape both.
  it("keeps every source path relative", () => {
    for (const file of Object.values(OPENSKY_SOURCES)) {
      expect(file.startsWith("/"), file).toBe(false);
    }
  });
});
