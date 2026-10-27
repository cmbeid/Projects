// The Bank, with the desktop's tools: your own tabs, filtering by the game's bank tags (Woodcutting, Combat, Shop...),
// search, the desktop's sort orders, and selecting several items to sell or move at once.
import { useState } from 'preact/hooks';
import { NS, all, item, itemName } from '../engine/content';
import type { Game } from '../engine/game';
import { Icon, fmt } from './common';
import { ItemSheet, itemOrder } from './App';

type Sort = 'default' | 'valueDesc' | 'valueAsc' | 'stackDesc' | 'stackAsc' | 'qtyDesc' | 'qtyAsc';
const SORTS: [Sort, string][] = [
  ['default', 'Default'],
  ['valueDesc', 'Item value ↓'],
  ['valueAsc', 'Item value ↑'],
  ['stackDesc', 'Stack value ↓'],
  ['stackAsc', 'Stack value ↑'],
  ['qtyDesc', 'Quantity ↓'],
  ['qtyAsc', 'Quantity ↑'],
];

const PREF = 'melvor2-pocket-bank';
function loadPrefs(): { sort: Sort; tag: string } {
  try {
    return { sort: 'default', tag: '', ...JSON.parse(localStorage.getItem(PREF) ?? '{}') };
  } catch {
    return { sort: 'default', tag: '' };
  }
}
function savePrefs(p: { sort: Sort; tag: string }): void {
  try {
    localStorage.setItem(PREF, JSON.stringify(p));
  } catch {
    // Private mode etc.: the view just won't be remembered.
  }
}

const price = (id: string) => item(id).SellsFor?.Quantity ?? 0;
const tagsOf = (id: string) => (item(id) as { BankTags?: { BankTag: string }[] }).BankTags ?? [];

export const bankTabs = (game: Game) => (game.state.bankTabs ??= []);
export function moveToTab(game: Game, items: string[], tab: number | null): void {
  for (const t of bankTabs(game)) t.items = t.items.filter((i) => !items.includes(i));
  if (tab != null && bankTabs(game)[tab]) bankTabs(game)[tab].items.push(...items);
  game.emit();
}

export function BankPage({ game }: { game: Game }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [prefs, setPrefs] = useState(loadPrefs());
  const [tab, setTab] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const update = (p: Partial<typeof prefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    savePrefs(next);
  };
  const tabs = bankTabs(game);
  const inTab = tab != null ? new Set(tabs[tab]?.items ?? []) : null;
  const q = search.trim().toLowerCase();
  let entries = Object.entries(game.state.bank)
    .filter(([id]) => !inTab || inTab.has(id))
    .filter(([id]) => !prefs.tag || tagsOf(id).some((t) => t.BankTag === prefs.tag))
    .filter(([id]) => !q || itemName(id).toLowerCase().includes(q));
  const order = itemOrder();
  const by: Record<Sort, (a: [string, number], b: [string, number]) => number> = {
    default: (a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0),
    valueDesc: (a, b) => price(b[0]) - price(a[0]),
    valueAsc: (a, b) => price(a[0]) - price(b[0]),
    stackDesc: (a, b) => price(b[0]) * b[1] - price(a[0]) * a[1],
    stackAsc: (a, b) => price(a[0]) * a[1] - price(b[0]) * b[1],
    qtyDesc: (a, b) => b[1] - a[1],
    qtyAsc: (a, b) => a[1] - b[1],
  };
  entries = entries.sort(by[prefs.sort] ?? by.default);
  const all_ = Object.entries(game.state.bank);
  const value = all_.reduce((s, [id, n]) => s + price(id) * n, 0);
  const pickedValue = picked.reduce((s, id) => s + price(id) * game.count(id), 0);
  const sel = selected && game.count(selected) ? selected : null;
  const tagCats = all<{ Id: string; DisplayName: string }>('BankTagCategory').filter((c) => all_.some(([id]) => tagsOf(id).some((t) => t.BankTag === NS + c.Id)));
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  return (
    <div class="page">
      <h2>Bank</h2>
      <p class="muted">
        {all_.length} / {game.bankSlots()} slots · worth {fmt(value)} gold
      </p>
      <div class="chips bank-tabs">
        <button class={tab == null ? 'on' : ''} onClick={() => setTab(null)}>
          All
        </button>
        {tabs.map((t, i) => (
          <button class={tab === i ? 'on' : ''} onClick={() => setTab(i)}>
            {t.name} <small>{t.items.filter((x) => game.count(x) > 0).length}</small>
          </button>
        ))}
        <button
          onClick={() => {
            const name = prompt('Name for the new tab?', `Tab ${tabs.length + 1}`);
            if (name) {
              tabs.push({ name: name.slice(0, 20), items: [] });
              game.emit();
              setTab(tabs.length - 1);
            }
          }}
        >
          + Tab
        </button>
      </div>
      <div class="bank-tools">
        <input class="text" type="search" placeholder="Search" value={search} onInput={(e) => setSearch((e.target as HTMLInputElement).value)} />
        <select value={prefs.sort} onChange={(e) => update({ sort: (e.target as HTMLSelectElement).value as Sort })}>
          {SORTS.map(([id, label]) => (
            <option value={id}>{label}</option>
          ))}
        </select>
        <select value={prefs.tag} onChange={(e) => update({ tag: (e.target as HTMLSelectElement).value })}>
          <option value="">All tags</option>
          {tagCats.map((c) => (
            <option value={NS + c.Id}>{c.DisplayName}</option>
          ))}
        </select>
        <button
          class={picking ? 'on' : ''}
          onClick={() => {
            setPicking(!picking);
            setPicked([]);
          }}
        >
          {picking ? 'Done' : 'Select'}
        </button>
      </div>
      {tab != null && tabs[tab] && (
        <div class="row small-buttons">
          <button
            onClick={() => {
              const name = prompt('Rename tab', tabs[tab].name);
              if (name) {
                tabs[tab].name = name.slice(0, 20);
                game.emit();
              }
            }}
          >
            Rename
          </button>
          <button
            class="danger"
            onClick={() => {
              tabs.splice(tab, 1);
              setTab(null);
              game.emit();
            }}
          >
            Delete tab
          </button>
        </div>
      )}
      {!all_.length && <p class="muted">Your bank is empty. Train a skill to gather items.</p>}
      {all_.length > 0 && !entries.length && <p class="muted">Nothing here{tab != null ? ' yet: open an item and move it to this tab' : ''}.</p>}
      <div class="bank-grid">
        {entries.map(([id, n]) => (
          <button class={`bank-slot ${sel === id || picked.includes(id) ? 'sel' : ''}`} onClick={() => (picking ? toggle(id) : setSelected(id))}>
            <Icon id={id} size={36} />
            <span class="qty">{n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.floor(n / 1e3)}K` : n}</span>
            {picked.includes(id) && <span class="pick">✓</span>}
          </button>
        ))}
      </div>
      {picking && picked.length > 0 && (
        <div class="bank-picked">
          <span class="grow small">
            {picked.length} selected · {fmt(pickedValue)} gold
          </span>
          <button
            class="danger"
            onClick={() => {
              if (!confirm(`Sell ${picked.length} item stacks for ${fmt(pickedValue)} gold?`)) return;
              for (const id of picked) game.sell(id, game.count(id));
              setPicked([]);
            }}
          >
            Sell all
          </button>
          {tabs.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                moveToTab(game, picked, v === 'none' ? null : Number(v));
                setPicked([]);
              }}
            >
              <option value="">Move to…</option>
              {tabs.map((t, i) => (
                <option value={String(i)}>{t.name}</option>
              ))}
              <option value="none">No tab</option>
            </select>
          )}
        </div>
      )}
      {sel && !picking && <ItemSheet game={game} id={sel} onClose={() => setSelected(null)} />}
    </div>
  );
}
