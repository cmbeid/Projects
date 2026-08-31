// Headless content audit (Phase 3): every species reachable, every region
// reachable via its unlock gate, every upgrade purchasable, and no data
// table has duplicate ids or dangling references. Run with `npm run audit`.
import { FISH, fishForRegion } from '../src/data/fish.js';
import { REGIONS, orderedRegions } from '../src/data/regions.js';
import { GEAR, STATS } from '../src/data/upgrades.js';
import { CREW } from '../src/data/crew.js';
import { rollSpeciesForRegion } from '../src/systems/fishing.js';
import { mulberry32 } from '../src/core/rng.js';

let failures = 0;
function fail(msg) {
  failures++;
  console.error(`FAIL: ${msg}`);
}
function ok(msg) {
  console.log(`ok: ${msg}`);
}

// -- No duplicate ids --------------------------------------------------
const fishIds = new Set();
for (const f of FISH) {
  if (fishIds.has(f.id)) fail(`duplicate fish id: ${f.id}`);
  fishIds.add(f.id);
}
ok(`${FISH.length} fish ids, all unique`);

const crewIds = new Set();
for (const c of CREW) {
  if (crewIds.has(c.id)) fail(`duplicate crew id: ${c.id}`);
  crewIds.add(c.id);
}
ok(`${CREW.length} crew ids, all unique`);

// -- No dangling references ---------------------------------------------
for (const f of FISH) {
  if (f.region !== 'any' && !REGIONS[f.region]) fail(`fish ${f.id} references unknown region ${f.region}`);
}
for (const c of CREW) {
  if (!REGIONS[c.regionAffinity]) fail(`crew ${c.id} references unknown region ${c.regionAffinity}`);
}
ok('no dangling region references from fish/crew');

// -- Every region reachable via its unlock gate --------------------------
const maxBoatTier = GEAR.boat.length;
for (const region of orderedRegions()) {
  if (region.unlock.minBoat > maxBoatTier) {
    fail(`region ${region.id} requires boat tier ${region.unlock.minBoat}, but only ${maxBoatTier} exist`);
  } else {
    ok(`region ${region.id} reachable at boat tier ${region.unlock.minBoat}`);
  }
}

// -- Every species reachable: a large number of rolls at rarityBiasMult=1
// against each region should surface every species that belongs to it
// (a headless proxy for "every species obtainable").
const ROLLS_PER_REGION = 40_000;
for (const region of orderedRegions()) {
  const rng = mulberry32(1000 + region.order);
  const seen = new Set();
  for (let i = 0; i < ROLLS_PER_REGION; i++) {
    const fish = rollSpeciesForRegion(region.id, { rarityBiasMult: 1, timeOfDay: i % 2 === 0 ? 'day' : 'night', weatherId: ['clear', 'rain', 'storm'][i % 3] }, rng);
    seen.add(fish.id);
  }
  const regionSpecies = fishForRegion(region.id);
  const unseen = regionSpecies.filter((f) => !seen.has(f.id));
  if (unseen.length > 0) {
    fail(`region ${region.id}: ${unseen.length} species never rolled in ${ROLLS_PER_REGION} tries: ${unseen.map((f) => f.id).join(', ')}`);
  } else {
    ok(`region ${region.id}: all ${regionSpecies.length} species reachable`);
  }
}

// -- Every gear/stat upgrade purchasable (tier ladder has no gaps, every
// tier after the first has a positive cost) ------------------------------
for (const [category, tiers] of Object.entries(GEAR)) {
  for (let i = 0; i < tiers.length; i++) {
    if (tiers[i].tier !== i + 1) fail(`${category} gear tier list has a gap/out-of-order tier at index ${i}`);
    if (i > 0 && !(tiers[i].cost > 0)) fail(`${category} tier ${tiers[i].tier} has non-positive cost`);
  }
}
ok('gear tier ladders have no gaps and positive costs beyond tier 1');

for (const track of Object.values(STATS)) {
  for (let tier = 1; tier <= track.maxTier; tier++) {
    if (!(track.tierCost(tier) > 0)) fail(`stat ${track.id} tier ${tier} has non-positive cost`);
  }
}
ok('all stat tracks have positive costs at every tier');

if (failures > 0) {
  console.error(`\n${failures} audit failure(s).`);
  process.exit(1);
} else {
  console.log('\nAudit passed.');
}
