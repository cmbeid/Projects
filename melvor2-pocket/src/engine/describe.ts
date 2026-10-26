// Bonus descriptions in the game's own words: the data ships a template for every bonus ("{Value:+0.##%;-#.##%} flat
// chance to catch a Fish in {LocalContext.Component.Entity.DisplayName}"), picked by stat and by which local context
// fields are set. This fills them in with a small subset of the SmartFormat syntax the game uses.
import { NS, contentData } from './content';

export interface DescribableBonus {
  Stat: { StatsType: string; Name: string };
  Value: number;
  LocalContext?: Record<string, unknown> | null;
  FromContext?: Record<string, unknown> | null;
}

interface ComponentDescription { Key: { Stat: { StatsType: string; Name: string }; LocalContextObjectCombination: string[] }; TemplateString: string }
interface GlobalDescription { StatGroup: string; TemplateString: string }

let byId: Map<string, Record<string, unknown>> | null = null;
function lookup(id: string): Record<string, unknown> | undefined {
  if (!byId) {
    byId = new Map();
    for (const list of Object.values(contentData().Objects) as unknown as Record<string, unknown>[][]) {
      for (const o of list) if (typeof o.Id === 'string' && !byId.has(NS + o.Id)) byId.set(NS + o.Id, o);
    }
  }
  return byId.get(id);
}

const words = (id: string) => id.replace(/^[A-Za-z]+:/, '').replace(/([a-z])([A-Z])/g, '$1 $2');

/** Display name for an object id (entities fall back to their spaced-out id, e.g. "Woodcutting"). */
function nameOf(id: unknown, plural = false): string {
  if (typeof id !== 'string') return '';
  const o = lookup(id);
  const dn = o?.DisplayName as string | { Singular: string; Plural: string } | undefined;
  if (typeof dn === 'string') return dn;
  if (dn) return plural ? dn.Plural : dn.Singular;
  return words(id);
}

/** "+0.##%;-#.##%" style number formats: sign sections, percent, and how many decimals to show. */
function number(v: number, spec: string): string {
  const [pos, neg] = spec.split(';');
  const section = v < 0 && neg ? neg : pos;
  const pct = section.includes('%');
  const x = Math.abs(pct ? v * 100 : v);
  const decimals = (section.split('.')[1] ?? '').replace(/[^#0]/g, '').length;
  const fixed = Number(x.toFixed(decimals)).toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: (section.split('.')[1] ?? '').replace(/[^0]/g, '').length });
  const sign = v < 0 ? '-' : section.startsWith('+') ? '+' : '';
  return `${sign}${fixed}${pct ? '%' : ''}`;
}

function formatValue(v: number, format: string): string {
  if (format.startsWith('cond:')) {
    // cond:<0?Decreased|>=0?Increased
    const [lt, ge] = format.slice(5).split('|').map((p) => p.replace(/^[<>=0-9]+\?/, ''));
    return v < 0 ? lt : ge;
  }
  if (format.startsWith('intervaltime') || format.startsWith('numbertime')) {
    const s = Math.abs(v) / 1000;
    return `${v < 0 ? '-' : '+'}${Number(s.toFixed(2))}s`;
  }
  if (!format) return String(v);
  return number(v, format);
}

function fill(template: string, b: DescribableBonus): string {
  return template.replace(/\{([^{}]+)\}/g, (_m, expr: string) => {
    if (expr.startsWith('Value')) return formatValue(b.Value, expr.slice(6));
    const [root, field, ...rest] = expr.split('.');
    const ctx = (root === 'FromContext' ? b.FromContext : b.LocalContext) ?? {};
    let v = (ctx as Record<string, unknown>)[field];
    // Component is { Entity, Component }: "Component.Entity.DisplayName" names the skill.
    if (field === 'Component' && v && typeof v === 'object') v = (v as { Entity?: string }).Entity;
    const tail = rest.filter((r) => r !== 'Entity');
    if (tail[0] === 'DisplayName') return nameOf(v, tail[1] === 'Plural');
    if (tail[0] === 'ResistanceName') return String(lookup(String(v))?.ResistanceName ?? nameOf(v));
    if (tail[0] === 'AppliesToCategory') return nameOf(lookup(String(v))?.AppliesToCategory);
    return nameOf(v);
  });
}

/** One bonus as the game would phrase it, or a plain fallback when there's no template. */
export function describeBonus(b: DescribableBonus): string {
  const data = contentData();
  const set = Object.entries(b.LocalContext ?? {})
    .filter(([, v]) => v != null && v !== 'Placeholder:Placeholder')
    .map(([k]) => k)
    .sort()
    .join(',');
  const candidates = ((data.ComponentModifierDescriptions ?? []) as ComponentDescription[]).filter(
    (d) => d.Key.Stat.Name === b.Stat.Name && d.Key.Stat.StatsType === b.Stat.StatsType,
  );
  const exact = candidates.find((d) => [...d.Key.LocalContextObjectCombination].sort().join(',') === set) ?? candidates[0];
  if (exact) return fill(exact.TemplateString, b);
  const global = ((data.GlobalModifierDescriptions ?? []) as GlobalDescription[]).find((d) => d.StatGroup === b.Stat.Name);
  if (global) return fill(global.TemplateString, b);
  return `${formatValue(b.Value, '+0.##;-#.##')} ${words(b.Stat.Name)}`;
}

/** Every bonus in a { Global, Component } block, described. */
export function describeBlock(block: { Global?: DescribableBonus[]; Component?: DescribableBonus[] } | null | undefined): string[] {
  return [...(block?.Global ?? []), ...(block?.Component ?? [])].map(describeBonus);
}
