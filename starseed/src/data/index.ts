import type { Content } from './types';
import { RESOURCES } from './packs/00-resources';
import { BUILDINGS } from './packs/01-buildings';
import { UPGRADES } from './packs/02-upgrades';
import { AUTOMATION } from './packs/03-automation';
import { MILESTONES } from './packs/04-milestones';
import { PERKS } from './packs/05-prestige';
import { DIRECTIVES } from './packs/06-directives';

export { BASE_TAP_YIELD, HEAT_EXPONENT, HEAT_THRESHOLD } from './packs/00-resources';
export {
  DIRECTIVE_SLOTS,
  RELAUNCH_MINIMUM,
  SCHEMATIC_DIVISOR,
  SCHEMATIC_EXPONENT,
} from './packs/05-prestige';

/** Every content table, frozen. Nothing mutates content at runtime. */
export const CONTENT: Content = Object.freeze({
  resources: RESOURCES,
  buildings: BUILDINGS,
  upgrades: UPGRADES,
  automation: AUTOMATION,
  milestones: MILESTONES,
  perks: PERKS,
  directives: DIRECTIVES,
});

export { RESOURCES, BUILDINGS, UPGRADES, AUTOMATION, MILESTONES, PERKS, DIRECTIVES };
