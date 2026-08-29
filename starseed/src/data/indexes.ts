import type {
  Automation,
  Building,
  Content,
  Directive,
  Perk,
  ResourceId,
  Upgrade,
} from './types';

/**
 * Lookup tables built once at load. Every hot path — the rate pipeline, the
 * throttle step, the automators — reads through these rather than scanning the
 * content arrays.
 */
export interface ContentIndex {
  content: Content;
  buildingById: ReadonlyMap<string, Building>;
  upgradeById: ReadonlyMap<string, Upgrade>;
  automationById: ReadonlyMap<string, Automation>;
  perkById: ReadonlyMap<string, Perk>;
  directiveById: ReadonlyMap<string, Directive>;
  /** Directive ids grouped by family, which is what makes a loadout exclusive. */
  directivesByFamily: ReadonlyMap<string, readonly Directive[]>;
  /** Buildings that output a resource, in content order. */
  producersOf: ReadonlyMap<ResourceId, readonly Building[]>;
  /** Buildings that consume a resource. Drives starvation throttling. */
  consumersOf: ReadonlyMap<ResourceId, readonly Building[]>;
  /** Buildings that add storage for a resource. */
  depotsOf: ReadonlyMap<ResourceId, readonly Building[]>;
}

export function buildIndex(content: Content): ContentIndex {
  const buildingById = new Map(content.buildings.map((b) => [b.id, b]));
  const upgradeById = new Map(content.upgrades.map((u) => [u.id, u]));
  const automationById = new Map(content.automation.map((a) => [a.id, a]));
  const perkById = new Map(content.perks.map((p) => [p.id, p]));
  const directiveById = new Map(content.directives.map((d) => [d.id, d]));

  const directivesByFamily = new Map<string, Directive[]>();
  for (const directive of content.directives) push(directivesByFamily, directive.family, directive);

  const producersOf = new Map<ResourceId, Building[]>();
  const consumersOf = new Map<ResourceId, Building[]>();
  const depotsOf = new Map<ResourceId, Building[]>();

  for (const building of content.buildings) {
    if (building.output.rate > 0) push(producersOf, building.output.resource, building);
    for (const input of building.inputs) push(consumersOf, input.resource, building);
    if (building.capacity) push(depotsOf, building.capacity.resource, building);
  }

  return {
    content,
    buildingById,
    upgradeById,
    automationById,
    perkById,
    directiveById,
    directivesByFamily,
    producersOf,
    consumersOf,
    depotsOf,
  };
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing) existing.push(value);
  else map.set(key, [value]);
}
