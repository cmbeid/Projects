/**
 * A page for listening to the game's sounds and writing down what they are.
 *
 * Fifty-eight resources cannot be identified by arithmetic. Eleven of them sit
 * on the 0x40 facility slots and name themselves that way; the other forty-seven
 * are in banks a thousand apart and could be anything. The only instrument for
 * those is an ear, and the difference between a good instrument and a bad one
 * here is entirely how much friction it puts between hearing a sound and having
 * written down what it was. Opening forty-seven files in turn is a bad
 * instrument. One page that plays them in order and holds the answers is a good
 * one.
 *
 * Deliberately not seeded with guesses. A row reading "probably a lift chime"
 * gets agreed with, and an anchored listener is a worse instrument than an
 * unanchored one — the same reason `--period` reports its measurement rather
 * than its conclusion.
 *
 * The page is written into `assets-private/`, which the repository ignores. It
 * references the player's own extracted audio and never leaves their machine.
 */

export interface SoundRow {
  id: number;
  /** Hex, as everything else in the extractor names resources. */
  label: string;
  file: string;
  bytes: number;
  seconds?: number;
  /** The 0x40 facility slot this sits on, when it sits on one. */
  slot?: string;
  /** Which thousand-apart bank it belongs to, as a hex base. */
  bank?: string;
}

function escape(text: string): string {
  return text.replace(/[&<>"]/g, (character) =>
    character === '&' ? '&amp;' : character === '<' ? '&lt;' : character === '>' ? '&gt;' : '&quot;',
  );
}

/**
 * Builds the whole page as one self-contained string.
 *
 * No build step, no dependencies, no network: it is opened off the filesystem
 * next to the `.wav` files it plays, so everything it needs is inline.
 */
export function soundsPage(rows: readonly SoundRow[]): string {
  const groups = new Map<string, SoundRow[]>();
  for (const row of rows) {
    const name = row.bank ? `Bank ${row.bank}` : 'Facility slots';
    const list = groups.get(name);
    if (list) list.push(row);
    else groups.set(name, [row]);
  }

  const sections = [...groups.entries()]
    .map(([name, list]) => {
      const cells = list
        .map(
          (row) => `
      <tr>
        <td class="id">${escape(row.label)}</td>
        <td class="what">${escape(row.slot ?? '')}</td>
        <td class="len">${row.seconds === undefined ? '' : `${row.seconds.toFixed(2)}s`}</td>
        <td><audio controls preload="none" src="${escape(row.file)}"></audio></td>
        <td><input type="text" data-id="${escape(row.label)}" placeholder="what is it?" autocomplete="off"></td>
      </tr>`,
        )
        .join('');
      return `
    <h2>${escape(name)} <span class="count">${list.length}</span></h2>
    <table>
      <thead>
        <tr><th>ID</th><th>Slot</th><th>Length</th><th>Play</th><th>What you hear</th></tr>
      </thead>
      <tbody>${cells}
      </tbody>
    </table>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SimTower sounds — ${rows.length} to label</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0 auto; padding: 1.5rem; max-width: 60rem;
    font: 15px/1.5 system-ui, sans-serif;
  }
  h1 { font-size: 1.3rem; margin-bottom: 0.25rem; }
  p.lede { margin-top: 0; opacity: 0.75; }
  h2 { font-size: 1rem; margin: 2rem 0 0.5rem; }
  .count { font-weight: normal; opacity: 0.5; }
  table { border-collapse: collapse; width: 100%; }
  th { text-align: left; font-size: 0.8rem; text-transform: uppercase; opacity: 0.55; }
  th, td { padding: 0.3rem 0.5rem 0.3rem 0; border-bottom: 1px solid rgba(128,128,128,0.25); }
  .id { font-family: ui-monospace, monospace; white-space: nowrap; }
  .what { font-size: 0.85rem; opacity: 0.7; white-space: nowrap; }
  .len { font-variant-numeric: tabular-nums; opacity: 0.7; white-space: nowrap; }
  audio { height: 2rem; width: 15rem; vertical-align: middle; }
  input { width: 100%; padding: 0.3rem; font: inherit; box-sizing: border-box; }
  .bar {
    position: sticky; bottom: 0; margin-top: 2rem; padding: 0.75rem 0;
    background: Canvas; border-top: 1px solid rgba(128,128,128,0.35);
    display: flex; gap: 0.75rem; align-items: center;
  }
  button { font: inherit; padding: 0.4rem 0.9rem; cursor: pointer; }
  #done { opacity: 0.7; font-variant-numeric: tabular-nums; }
  textarea { width: 100%; height: 9rem; font-family: ui-monospace, monospace; font-size: 0.8rem; }
</style>
</head>
<body>
<h1>SimTower sounds</h1>
<p class="lede">
  ${rows.length} resources, read out of your own copy. Play each one, type what you
  hear, then copy the CSV at the bottom. Nothing here leaves this machine — the
  folder is ignored by git.
</p>
${sections}

<div class="bar">
  <button id="copy" type="button">Copy as CSV</button>
  <span id="done">0 of ${rows.length} labelled</span>
</div>
<textarea id="out" readonly aria-label="CSV of what you have labelled"></textarea>

<script>
  var inputs = Array.prototype.slice.call(document.querySelectorAll('input[data-id]'));
  var out = document.getElementById('out');
  var done = document.getElementById('done');

  function refresh() {
    var lines = ['id,name'];
    var filled = 0;
    inputs.forEach(function (input) {
      var value = input.value.trim();
      if (!value) return;
      filled += 1;
      // Quote defensively: a description with a comma in it is likely.
      lines.push(input.dataset.id + ',"' + value.replace(/"/g, '""') + '"');
    });
    out.value = lines.join('\\n');
    done.textContent = filled + ' of ' + inputs.length + ' labelled';
    try { localStorage.setItem('simtower-sounds', out.value); } catch (error) { /* private mode */ }
  }

  // Typing into forty-seven boxes and losing them to a refresh would be
  // miserable, so what has been written is kept on this machine as it is typed.
  try {
    var saved = localStorage.getItem('simtower-sounds');
    if (saved) {
      saved.split('\\n').slice(1).forEach(function (line) {
        var at = line.indexOf(',');
        if (at < 0) return;
        var id = line.slice(0, at);
        var name = line.slice(at + 1).replace(/^"|"$/g, '').replace(/""/g, '"');
        var input = document.querySelector('input[data-id="' + id + '"]');
        if (input) input.value = name;
      });
    }
  } catch (error) { /* private mode */ }

  inputs.forEach(function (input) {
    input.addEventListener('input', refresh);
    // Enter moves to the next row, so a listening pass is one hand on the
    // keyboard rather than a click between every sound.
    input.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      var next = inputs[inputs.indexOf(input) + 1];
      if (next) next.focus();
    });
  });

  document.getElementById('copy').addEventListener('click', function () {
    refresh();
    out.select();
    if (navigator.clipboard) navigator.clipboard.writeText(out.value);
    else document.execCommand('copy');
  });

  // Only one sound at a time; otherwise clicking down the list stacks them.
  document.addEventListener('play', function (event) {
    document.querySelectorAll('audio').forEach(function (other) {
      if (other !== event.target) other.pause();
    });
  }, true);

  refresh();
</script>
</body>
</html>
`;
}
