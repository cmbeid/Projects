#!/usr/bin/env bash
# Vendors the community art pack into public/assets/opensky/.
#
# Upstream is Skyscraper Rising (https://github.com/tonytins/skyscraperrising),
# a GPL-3.0 SimTower-like in Godot whose sprites are credited to binarybird.
# This project uses a subset of them so the "OpenSkyScraper" edition renders
# without a copy of SIMTOWER.EXE. See public/assets/opensky/README.md.
#
# The files are re-fetched rather than kept in sync automatically: this runs by
# hand when the required set in src/render/opensky-media.js changes.
#
# Upstream file names are inconsistently cased and some contain spaces
# ("OT stairs 2 v2.png"), so every basename is sanitized to lower-case with
# spaces turned into hyphens. OPENSKY_SOURCES is written against the sanitized names,
# which is what makes the lookup case-stable across filesystems: Windows and
# macOS would resolve "MM_GrandLobby-1star.png" through a request for the
# lower-case name, and Linux — including the Pages runner — would 404.
set -euo pipefail

REPO="tonytins/skyscraperrising"
REF="main"
SRC_PREFIX="project/assets"
DEST="public/assets/opensky"

command -v gh >/dev/null || { echo "gh CLI is required" >&2; exit 1; }
command -v node >/dev/null || { echo "node is required" >&2; exit 1; }

# The list of required files is derived from the code rather than duplicated
# here, so a new entry in OPENSKY_SOURCES cannot silently go un-vendored.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# pathToFileURL rather than a bare path: under Git Bash on Windows the shell's
# /c/... form is not something node can resolve, so let node build the URL from
# its own cwd instead of interpolating a shell path into the import specifier.
mapfile -t NEEDED < <(
  node -e "
    const url = require('node:url'), path = require('node:path');
    import(url.pathToFileURL(path.resolve('src/render/opensky-media.js')).href)
      .then((m) => Object.values(m.OPENSKY_SOURCES).forEach((v) => console.log(v)));
  " | sort -u
)
[ "${#NEEDED[@]}" -gt 0 ] || { echo "could not read OPENSKY_SOURCES" >&2; exit 1; }
echo "${#NEEDED[@]} files required by src/render/opensky-media.js"

# One tree listing, then an index of sanitized-name -> upstream-path so each
# lookup is a grep rather than a nested scan. Upstream paths are the authority
# for what to download; the sanitized name is what we write.
INDEX="$(mktemp)"
trap 'rm -f "$INDEX"' EXIT
gh api "repos/$REPO/git/trees/$REF?recursive=1" --jq '.tree[].path'   | grep "^$SRC_PREFIX/.*\.png$"   | while IFS= read -r p; do
      rel="${p#"$SRC_PREFIX"/}"
      # Only the basename is sanitized. The category directories are already
      # consistently capitalized upstream and OPENSKY_SOURCES keeps them that
      # way, so folding them too would put every lookup one case off.
      printf '%s/%s	%s
' "$(dirname "$rel")"         "$(basename "$rel" | tr '[:upper:] ' '[:lower:]-')" "$p"
    done > "$INDEX"

missing=0
for want in "${NEEDED[@]}"; do
  # -F and a trailing tab so "icon-hotel-single" cannot match
  # "icon-hotel-single-2"; cut -f2- keeps paths that contain no tab anyway.
  upstream="$(grep -F -m1 "$want$(printf '	')" "$INDEX" | cut -f2- || true)"
  if [ -z "$upstream" ]; then
    echo "  MISSING upstream: $want" >&2
    missing=$((missing + 1))
    continue
  fi
  out="$DEST/$want"
  mkdir -p "$(dirname "$out")"
  gh api "repos/$REPO/contents/$upstream?ref=$REF" --jq '.content' | base64 -d > "$out"
  printf '.'
done
echo

if [ "$missing" -gt 0 ]; then
  echo "$missing file(s) not found upstream — the art pack is incomplete." >&2
  exit 1
fi

echo "Vendored ${#NEEDED[@]} files into ${DEST#"$(pwd)/"}"
