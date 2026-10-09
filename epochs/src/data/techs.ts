import { TECH_SCALE, TECH_SPREAD } from './progression';
import type { Effect, TechDef } from './types';

/**
 * The research tree: ten techs an era. Within an era a tech only ever needs
 * techs of the same era, so each era's tree draws on its own. The price
 * climbs with the tech's place in its era's list.
 */

type Spec = readonly [id: string, name: string, requires: readonly string[], effects: readonly Effect[], blurb: string];

const ERAS: readonly (readonly Spec[])[] = [
  [
    ['toolmaking', 'Toolmaking', [], [{ k: 'job', job: 'woodcutter', x: 0.25 }, { k: 'job', job: 'quarrier', x: 0.25 }], 'A flake of flint, a haft of ash, a thong of gut.'],
    ['agriculture', 'Agriculture', [], [{ k: 'job', job: 'farmer', x: 0.3 }], 'Keep the biggest seeds, and plant them.'],
    ['storytelling', 'Storytelling', [], [{ k: 'feature', f: 'chronicle' }, { k: 'job', job: 'artist', x: 0.25 }], 'The city begins to remember itself. Events now come to you for a decision.'],
    ['pottery', 'Pottery', ['agriculture'], [{ k: 'cap', x: 0.25 }], 'Fired clay keeps grain dry and mice out.'],
    ['shelter', 'Shelter', ['toolmaking'], [{ k: 'housing', x: 0.25 }], 'Posts sunk in the ground, and a roof that does not leak.'],
    ['clearing', 'Land Clearing', ['toolmaking'], [{ k: 'plots', n: 3 }], 'Fire and axe push the forest back.'],
    ['counting', 'Tally Sticks', ['storytelling'], [{ k: 'job', job: 'scholar', x: 0.3 }], 'Notches in a bone: the first ledger.'],
    ['rituals', 'Rituals', ['storytelling'], [{ k: 'stability', n: 5 }, { k: 'feature', f: 'festival' }], 'Dance at midsummer. Unlocks festivals, paid for in culture.'],
    ['megaliths', 'Megaliths', ['counting', 'clearing'], [{ k: 'feature', f: 'wonders' }], 'Rollers, ramps and a hundred backs. Unlocks wonders.'],
    ['herding', 'Herding', ['pottery'], [{ k: 'job', job: 'farmer', x: 0.2 }, { k: 'eat', x: 0.1 }], 'Goats on the hill, milk in the pot.'],
  ],
  [
    ['bronze-casting', 'Bronze Casting', [], [{ k: 'job', job: 'miner', x: 0.3 }], 'Nine parts copper, one part tin, and a very hot fire.'],
    ['barter', 'Barter', [], [{ k: 'job', job: 'merchant', x: 0.2 }], 'Lets you build market stalls. Merchants turn the city’s surplus into gold.'],
    ['writing', 'Writing', [], [{ k: 'job', job: 'scholar', x: 0.4 }], 'Wedges in wet clay, and nothing need be forgotten again.'],
    ['irrigation', 'Irrigation', [], [{ k: 'job', job: 'farmer', x: 0.4 }], 'A ditch, a dyke and a shaduf.'],
    ['wheel', 'The Wheel', ['bronze-casting'], [{ k: 'all', x: 0.1 }], 'First for pots, then for carts.'],
    ['census', 'Census', ['writing'], [{ k: 'feature', f: 'autoAssign' }], 'Count everyone. Lets idle citizens find work on their own.'],
    ['masonry', 'Masonry', ['wheel'], [{ k: 'job', job: 'quarrier', x: 0.4 }, { k: 'plots', n: 3 }], 'Dressed stone, and walls that stand.'],
    ['calendar', 'Calendar', ['writing', 'irrigation'], [{ k: 'growth', x: 0.25 }, { k: 'stability', n: 5 }], 'Know when the flood will come.'],
    ['law-code', 'Law Code', ['census'], [{ k: 'stability', n: 8 }], 'An eye for an eye, carved on a pillar for everyone to read.'],
    ['sailing', 'Sailing', ['barter', 'wheel'], [{ k: 'job', job: 'merchant', x: 0.4 }, { k: 'plots', n: 2 }], 'A reed boat with a square sail, and a quay to tie it to.'],
  ],
  [
    ['philosophy', 'Philosophy', [], [{ k: 'job', job: 'scholar', x: 0.4 }], 'Ask why, then ask why again.'],
    ['currency', 'Currency', [], [{ k: 'job', job: 'merchant', x: 0.5 }], 'Stamped silver, worth the same on both sides of the sea.'],
    ['iron-working', 'Iron Working', [], [{ k: 'job', job: 'miner', x: 0.4 }], 'Bloomeries and the smith’s hammer.'],
    ['aqueducts', 'Aqueducts', ['currency'], [{ k: 'housing', x: 0.2 }, { k: 'growth', x: 0.25 }], 'Fresh water from the hills, on arches.'],
    ['drama', 'Drama', ['philosophy'], [{ k: 'job', job: 'artist', x: 0.5 }, { k: 'stability', n: 5 }], 'Masks, a chorus and a catharsis.'],
    ['mathematics', 'Mathematics', ['philosophy'], [{ k: 'research', x: 0.1 }], 'Proofs, and the end of arguing about them.'],
    ['engineering', 'Engineering', ['iron-working', 'mathematics'], [{ k: 'plots', n: 4 }, { k: 'wonderSpeed', x: 0.25 }], 'Cranes, arches and concrete.'],
    ['roads', 'Roads', ['engineering'], [{ k: 'all', x: 0.1 }], 'Straight, paved and drained.'],
    ['republic', 'Republic', ['drama', 'currency'], [{ k: 'stability', n: 8 }, { k: 'feature', f: 'queue' }], 'Elected magistrates. Lets you queue research.'],
    ['medicine', 'Medicine', ['philosophy', 'aqueducts'], [{ k: 'eat', x: 0.1 }, { k: 'growth', x: 0.25 }], 'Four humours and a lot of willow bark.'],
  ],
  [
    ['feudalism', 'Feudalism', [], [{ k: 'job', job: 'farmer', x: 0.4 }], 'Land for service, service for protection.'],
    ['monasticism', 'Monasticism', [], [{ k: 'job', job: 'scholar', x: 0.5 }], 'Prayer, work and a library.'],
    ['windmills', 'Windmills', [], [{ k: 'job', job: 'woodcutter', x: 0.4 }, { k: 'job', job: 'quarrier', x: 0.4 }], 'Sails on the ridge, grinding and sawing.'],
    ['heavy-plough', 'Heavy Plough', ['feudalism'], [{ k: 'job', job: 'farmer', x: 0.4 }], 'Eight oxen and a mouldboard for the clay.'],
    ['castles', 'Castles', ['windmills'], [{ k: 'stability', n: 8 }, { k: 'plots', n: 4 }], 'Walls on the hill, and a town inside them.'],
    ['guilds', 'Guilds', ['feudalism'], [{ k: 'all', x: 0.1 }], 'Masters, journeymen, apprentices and standards.'],
    ['banking', 'Banking', ['guilds'], [{ k: 'job', job: 'merchant', x: 0.6 }], 'A bench in the square, and bills of exchange.'],
    ['paper', 'Paper', ['monasticism'], [{ k: 'research', x: 0.1 }], 'Cheaper than vellum, by a long way.'],
    ['cathedrals', 'Gothic Vaulting', ['castles', 'monasticism'], [{ k: 'job', job: 'artist', x: 0.5 }, { k: 'wonderSpeed', x: 0.2 }], 'Pointed arches, flying buttresses and glass.'],
    ['chivalry', 'Chivalry', ['castles', 'guilds'], [{ k: 'stability', n: 6 }, { k: 'festival', x: 0.25 }], 'Tournaments, ballads and good manners, mostly.'],
  ],
  [
    ['printing-press', 'Printing Press', [], [{ k: 'job', job: 'scholar', x: 0.6 }, { k: 'research', x: 0.1 }], 'Movable type, and books for everyone.'],
    ['navigation', 'Navigation', [], [{ k: 'job', job: 'merchant', x: 0.6 }, { k: 'plots', n: 4 }], 'Astrolabe, compass and a new coast on the map.'],
    ['perspective', 'Perspective', [], [{ k: 'job', job: 'artist', x: 0.6 }], 'A vanishing point, and paintings you could walk into.'],
    ['astronomy', 'Astronomy', ['printing-press'], [{ k: 'job', job: 'scholar', x: 0.4 }], 'The earth goes round the sun. Say it quietly.'],
    ['double-entry', 'Double Entry', ['navigation'], [{ k: 'cap', x: 0.5 }], 'Every debit has a credit.'],
    ['gunpowder', 'Gunpowder', ['navigation'], [{ k: 'job', job: 'quarrier', x: 0.4 }, { k: 'job', job: 'miner', x: 0.4 }], 'Blasting, mostly, in this city.'],
    ['humanism', 'Humanism', ['perspective', 'printing-press'], [{ k: 'stability', n: 10 }], 'People are the measure of all things.'],
    ['architecture', 'Architecture', ['perspective'], [{ k: 'housing', x: 0.2 }, { k: 'plots', n: 3 }], 'Domes, orders and proportion.'],
    ['patronage', 'Patronage', ['humanism'], [{ k: 'festival', x: 0.5 }], 'A banker pays for the frescoes, and his name goes on the chapel.'],
    ['scientific-method', 'Scientific Method', ['astronomy', 'double-entry'], [{ k: 'all', x: 0.1 }, { k: 'feature', f: 'modernizeAll' }], 'Test it. Then modernize a whole line at once.'],
  ],
  [
    ['steam-power', 'Steam Power', [], [{ k: 'all', x: 0.05 }], 'A boiler and a piston. Lets you build steelworks and power stations; steelworkers need power.'],
    ['coal-gas', 'Coal Gas', [], [{ k: 'job', job: 'miner', x: 0.5 }], 'Gas lamps down the shafts, and in the streets.'],
    ['sanitation', 'Sanitation', [], [{ k: 'growth', x: 0.5 }, { k: 'housing', x: 0.15 }], 'Sewers, and the end of cholera.'],
    ['railways', 'Railways', ['steam-power'], [{ k: 'all', x: 0.15 }, { k: 'plots', n: 5 }], 'The city reaches the next valley in an hour.'],
    ['factory-system', 'Factory System', ['steam-power'], [{ k: 'job', job: 'smith', x: 0.5 }, { k: 'slots', x: 0.2 }], 'Shifts, a whistle and a line.'],
    ['telegraph', 'Telegraph', ['coal-gas'], [{ k: 'research', x: 0.1 }, { k: 'job', job: 'scholar', x: 0.4 }], 'Dots, dashes and news before breakfast.'],
    ['mass-press', 'Mass Press', ['telegraph'], [{ k: 'job', job: 'artist', x: 0.5 }], 'A penny paper, and serials by the chapter.'],
    ['corporations', 'Corporations', ['railways'], [{ k: 'job', job: 'merchant', x: 0.6 }], 'Limited liability, unlimited ambition.'],
    ['urban-planning', 'Urban Planning', ['sanitation', 'railways'], [{ k: 'plots', n: 6 }], 'Boulevards through the slums.'],
    ['electricity', 'Electricity', ['factory-system', 'telegraph'], [{ k: 'all', x: 0.1 }], 'Dynamos, and a light that does not flicker.'],
  ],
  [
    ['electronics', 'Electronics', [], [{ k: 'job', job: 'scholar', x: 0.5 }], 'Valves, then transistors.'],
    ['combustion', 'Combustion Engine', [], [{ k: 'all', x: 0.05 }], 'Lets you drill for oil; oil stations run on it.'],
    ['green-revolution', 'Green Revolution', [], [{ k: 'job', job: 'farmer', x: 0.6 }, { k: 'eat', x: 0.1 }], 'Dwarf wheat and fertiliser.'],
    ['computing', 'Computing', ['electronics'], [{ k: 'research', x: 0.05 }], 'Lets you build data centres, where coders make data.'],
    ['mass-production', 'Mass Production', ['combustion'], [{ k: 'all', x: 0.15 }], 'Any colour, so long as it is black.'],
    ['skyscrapers', 'Skyscrapers', ['mass-production'], [{ k: 'housing', x: 0.25 }, { k: 'plots', n: 6 }], 'Steel frames and elevators.'],
    ['broadcasting', 'Broadcasting', ['electronics'], [{ k: 'job', job: 'artist', x: 0.6 }, { k: 'stability', n: 8 }], 'The whole city hears the same song at once.'],
    ['plastics', 'Plastics', ['combustion'], [{ k: 'cap', x: 0.5 }], 'Cheap, light, and forever.'],
    ['internet', 'Internet', ['computing', 'broadcasting'], [{ k: 'job', job: 'coder', x: 0.5 }, { k: 'research', x: 0.1 }], 'Everything connected to everything.'],
    ['automation', 'Automation', ['computing', 'mass-production'], [{ k: 'slots', x: 0.2 }], 'Robot arms on the line.'],
  ],
  [
    ['vertical-farms', 'Vertical Farms', [], [{ k: 'job', job: 'farmer', x: 0.6 }], 'A field stood on its end.'],
    ['space-mining', 'Space Mining', [], [{ k: 'job', job: 'miner', x: 0.6 }], 'An asteroid is a mine with no overburden.'],
    ['nanotech', 'Nanotechnology', [], [{ k: 'job', job: 'fabricator', x: 0.5 }, { k: 'job', job: 'smith', x: 0.5 }], 'Machines the size of molecules.'],
    ['quantum-computing', 'Quantum Computing', ['nanotech'], [{ k: 'job', job: 'coder', x: 0.6 }], 'Qubits, cold and many.'],
    ['ai', 'Artificial Minds', ['quantum-computing'], [{ k: 'all', x: 0.2 }], 'Something new in the city, and it is helping.'],
    ['orbital-habitats', 'Orbital Habitats', ['space-mining'], [{ k: 'housing', x: 0.3 }, { k: 'plots', n: 8 }], 'Spinning rings, and room for everyone.'],
    ['terraforming', 'Terraforming Theory', ['vertical-farms', 'ai'], [{ k: 'heritageGain', x: 0.25 }], 'How to make a world into a home. Launches earn more Heritage.'],
    ['cryo-sleep', 'Cryo-Sleep', ['vertical-farms'], [{ k: 'growth', x: 0.25 }], 'A long journey, dreamlessly.'],
    ['ion-drive', 'Ion Drive', ['nanotech', 'orbital-habitats'], [{ k: 'wonderSpeed', x: 0.3 }], 'A gentle push that never stops. Lets you build the colony ship.'],
    ['star-charts', 'Star Charts', ['cryo-sleep', 'quantum-computing'], [{ k: 'research', x: 0.1 }], 'Somewhere out there is a world that will have us.'],
  ],
];

export const TECHS: readonly TechDef[] = ERAS.flatMap((specs, era) =>
  specs.map(([id, name, requires, effects, blurb], i): TechDef => {
    const knowledge = Math.round(TECH_SCALE[era]! * (1 + TECH_SPREAD * i));
    // Data costs only start once Computing can have made some.
    const needsData = era === 7 || (era === 6 && i >= 4);
    const cost: TechDef['cost'] = needsData ? { knowledge, data: Math.round(knowledge * 0.02) } : { knowledge };
    return { id, name, era, cost, requires, effects, blurb };
  }),
);

export const TECH = new Map<string, TechDef>(TECHS.map((t) => [t.id, t]));
