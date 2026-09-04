// Storage & Save Game Management (Browser localStorage / IndexedDB & File I/O)

const SAVE_KEY_PREFIX = "opensky_save_slot_";
const AUTO_SAVE_KEY = "opensky_autosave";

export const Storage = {
  saveToSlot(game, slotId = "auto", storage = null) {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (!store) return false;
    try {
      const key = slotId === "auto" ? AUTO_SAVE_KEY : `${SAVE_KEY_PREFIX}${slotId}`;
      const xml = game.encodeXML();
      const meta = {
        date: new Date().toISOString(),
        towerRating: game.rating,
        population: game.population,
        funds: game.funds,
        day: game.time.day,
        quarter: game.time.quarter,
        year: game.time.year,
        hour: Math.floor(game.time.hour),
      };
      store.setItem(key, JSON.stringify({ meta, xml }));
      return true;
    } catch {
      return false;
    }
  },

  loadFromSlot(game, slotId = "auto", storage = null) {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (!store) return false;
    try {
      const key = slotId === "auto" ? AUTO_SAVE_KEY : `${SAVE_KEY_PREFIX}${slotId}`;
      const raw = store.getItem(key);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data && data.xml) {
        game.decodeXML(data.xml);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  hasAutosave(storage = null) {
    return this.getAutosaveMeta(storage) != null;
  },

  // Metadata for the autosave slot (or null when absent) — used by the main
  // menu "Resume" button to show what would be restored without decoding it.
  getAutosaveMeta(storage = null) {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (!store) return null;
    try {
      const raw = store.getItem(AUTO_SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && data.xml) return data.meta || {};
      return null;
    } catch {
      return null;
    }
  },

  clearAutosave(storage = null) {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (!store) return false;
    try {
      store.removeItem(AUTO_SAVE_KEY);
      return true;
    } catch {
      return false;
    }
  },

  listSlots(storage = null) {
    const store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (!store) return [];
    const slots = [];
    try {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k === AUTO_SAVE_KEY || (k && k.startsWith(SAVE_KEY_PREFIX))) {
          const raw = store.getItem(k);
          if (raw) {
            const data = JSON.parse(raw);
            slots.push({
              slotId: k === AUTO_SAVE_KEY ? "auto" : k.slice(SAVE_KEY_PREFIX.length),
              meta: data.meta || {},
            });
          }
        }
      }
    } catch {}
    return slots;
  },

  exportXMLBlob(game) {
    const xml = game.encodeXML();
    if (typeof Blob !== "undefined") {
      return new Blob([xml], { type: "application/xml" });
    }
    return xml;
  },
};
