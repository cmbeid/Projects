// Only Region 1 is populated for the Phase 0-2 vertical slice; Phase 3 adds
// the remaining 7 regions. UI and systems read this table generically, so
// adding a region later is a data edit, not new code.
export const REGIONS = {
  marrow_cove: {
    id: 'marrow_cove',
    name: 'Marrow Cove',
    order: 1,
    unlock: null, // starting region
    baseValue: 8,
    minBoat: 1,
  },
};

export const STARTING_REGION = 'marrow_cove';
