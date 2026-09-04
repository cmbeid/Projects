// BitmapRegistry + sound key map (RENDER agent).
//
// Declares the C++ BitmapManager / SoundManager resource keys ("simtower/...",
// "noroute.png"). The browser starts with no edition media at all; after the
// ownership gate verifies SIMTOWER.EXE/EX_, simtower-dumper.js registers the
// user-supplied resources into BitmapRegistry. No extracted game art is served
// from /assets.
//
// Pure data + a browser-only image loader. Importing this module in bun must
// not throw (feature-detected DOM access); getSize() returns null until images
// are loaded in a browser.
//
// ---------------------------------------------------------------------------
// BITMAP MANIFEST (every renderer key -> historical composed-sheet label)
// ---------------------------------------------------------------------------
// Direct sheet files (composed SimTowerLoader output):
//   simtower/office             -> office.png            simtower/condo            -> condo.png
//   simtower/single             -> single.png            simtower/double           -> double.png
//   simtower/suite              -> suite.png             simtower/fastfood         -> fastfood.png
//   simtower/restaurant         -> restaurant.png        simtower/partyhall        -> partyhall.png
//   simtower/shops              -> shops.png             simtower/floor            -> floor.png
//   simtower/stairs             -> stairs.png            simtower/escalator        -> escalator.png
//   simtower/housekeeping       -> housekeeping.png      simtower/people           -> people.png
//   simtower/sky                -> sky.png               simtower/speed            -> speed.png
//   simtower/security           -> security.png          simtower/medicalcenter    -> medicalcenter.png
//   simtower/recycling          -> recycling.png         simtower/noroute is keyed "noroute.png" (see below)
// Sub-folder sheets:
//   simtower/stairs/spiral_2|3  -> stairs/spiral_2.png|spiral_3.png
//   simtower/cinema/hall|screens-> cinema/hall.png|screens.png
//   simtower/lobby/normal|sky|high -> lobby/normal.png|sky.png|high.png
//   simtower/parking/space|ramp -> parking/space.png|ramp.png
//   simtower/metro/station|tracks -> metro/station.png|tracks.png
//   simtower/elevator/narrow|wide|standard|service|express|digits|people
//                               -> elevator/<same>.png
//   simtower/construction/grid|solid|worker -> construction/<same>.png
//   simtower/fire/large|small|chopper|destroyed -> fire/<same>.png
//   simtower/alerts/fire|terrorist|chopper|vip|treasure|starup -> alerts/<same>.png
//   simtower/deco/cloud/0..3    -> deco/cloud/0.png..3.png
//   simtower/deco/crane|fireladder|skyline|entrances|santa -> deco/<same>.png
//   simtower/ui/toolbox/tools|items|speed -> ui/toolbox/<same>.png
//   simtower/ui/time/bg|rating  -> ui/time/<same>.png
//   simtower/ui/map/sky|ground|buttons|overlays -> ui/map/<same>.png
//   simtower/ui/menubg          -> ui/menubg.png
//   noroute.png                 -> noroute.png            (C++ data/bitmaps/ loose file key)
//   splashscreen                -> ../splashscreen.png    (data root key, main-menu bg)
// AnimPeple occupant sheets — NO equivalent files exist in bitmaps.hidden/
// (the EXE resources 0x85E8-0x85EE were never composed). All map to
// people.png as the closest fallback (item.js then draws 16x24 walk frames
// from the generic sheet; its width-1024 checkerboard fallback check stays
// unused because people.png is 96px wide):
//   simtower/animpeple/office|condo|construction|hotel|restaurant|event|housekeeper -> people.png
//
// ---------------------------------------------------------------------------
// SOUND MANIFEST (key -> historical WAV label), mirroring
// SimTowerLoader::loadSounds() namedSounds[] exactly:
//   simtower/construction/normal|flexible|impossible
//   simtower/bulldozer, simtower/cash, simtower/cock, simtower/bells,
//   simtower/birds/morning|evening|day, simtower/rain, simtower/thunder,
//   simtower/crickets, simtower/wind, simtower/santa, simtower/applause,
//   simtower/rating/increased|tower, simtower/doorbell, simtower/hover,
//   simtower/toilet, simtower/office, simtower/restaurant, simtower/metro,
//   simtower/partyhall, simtower/fastfood/0|1|2,
//   simtower/cinema/movie0..movie14, simtower/car/arriving|departing,
//   simtower/elevator/arriving|departing, simtower/splashscreen
// ---------------------------------------------------------------------------

// key -> former composed-sheet name. This remains a concise manifest of the
// renderer's required resources; the browser never turns it into a served URL.
export const BITMAP_FILES = {
  // loose composed sheets
  "simtower/office": "office.png",
  "simtower/condo": "condo.png",
  "simtower/single": "single.png",
  "simtower/double": "double.png",
  "simtower/suite": "suite.png",
  "simtower/fastfood": "fastfood.png",
  "simtower/restaurant": "restaurant.png",
  "simtower/partyhall": "partyhall.png",
  "simtower/shops": "shops.png",
  "simtower/floor": "floor.png",
  "simtower/stairs": "stairs.png",
  "simtower/escalator": "escalator.png",
  "simtower/housekeeping": "housekeeping.png",
  "simtower/people": "people.png",
  "simtower/sky": "sky.png",
  "simtower/speed": "speed.png",
  "simtower/security": "security.png",
  "simtower/medicalcenter": "medicalcenter.png",
  "simtower/recycling": "recycling.png",
  // stairs variants (custom 0xFF02 resources)
  "simtower/stairs/spiral_2": "stairs/spiral_2.png",
  "simtower/stairs/spiral_3": "stairs/spiral_3.png",
  // cinema
  "simtower/cinema/hall": "cinema/hall.png",
  "simtower/cinema/screens": "cinema/screens.png",
  // lobby
  "simtower/lobby/normal": "lobby/normal.png",
  "simtower/lobby/sky": "lobby/sky.png",
  "simtower/lobby/high": "lobby/high.png",
  "simtower/lobby/fountain": "lobby/fountain.png",
  // parking
  "simtower/parking/space": "parking/space.png",
  "simtower/parking/ramp": "parking/ramp.png",
  // metro
  "simtower/metro/station": "metro/station.png",
  "simtower/metro/tracks": "metro/tracks.png",
  // elevators (shafts, cars, digits, queue crowd)
  "simtower/elevator/narrow": "elevator/narrow.png",
  "simtower/elevator/wide": "elevator/wide.png",
  "simtower/elevator/standard": "elevator/standard.png",
  "simtower/elevator/service": "elevator/service.png",
  "simtower/elevator/express": "elevator/express.png",
  "simtower/elevator/digits": "elevator/digits.png",
  "simtower/elevator/people": "elevator/people.png",
  // construction animation
  "simtower/construction/grid": "construction/grid.png",
  "simtower/construction/solid": "construction/solid.png",
  "simtower/construction/worker": "construction/worker.png",
  // event system art (fire / bomb alerts)
  "simtower/fire/large": "fire/large.png",
  "simtower/fire/small": "fire/small.png",
  "simtower/fire/chopper": "fire/chopper.png",
  "simtower/fire/destroyed": "fire/destroyed.png",
  "simtower/alerts/fire": "alerts/fire.png",
  "simtower/alerts/terrorist": "alerts/terrorist.png",
  "simtower/alerts/chopper": "alerts/chopper.png",
  "simtower/alerts/vip": "alerts/vip.png",
  "simtower/alerts/treasure": "alerts/treasure.png",
  "simtower/alerts/starup": "alerts/starup.png",
  // cathedral
  "simtower/cathedral/main": "partyhall.png",
  // decorations / sky
  "simtower/deco/cloud/0": "deco/cloud/0.png",
  "simtower/deco/cloud/1": "deco/cloud/1.png",
  "simtower/deco/cloud/2": "deco/cloud/2.png",
  "simtower/deco/cloud/3": "deco/cloud/3.png",
  "simtower/deco/crane": "deco/crane.png",
  "simtower/deco/fireladder": "deco/fireladder.png",
  "simtower/deco/skyline": "deco/skyline.png",
  "simtower/deco/entrances": "deco/entrances.png",
  "simtower/deco/santa": "deco/santa.png",
  // animpeple occupant animation sheets
  "simtower/animpeple/office": "animpeple/office.png",
  "simtower/animpeple/condo": "animpeple/condo.png",
  "simtower/animpeple/construction": "animpeple/construction.png",
  "simtower/animpeple/hotel": "animpeple/hotel.png",
  "simtower/animpeple/restaurant": "animpeple/restaurant.png",
  "simtower/animpeple/event": "animpeple/event.png",
  "simtower/animpeple/housekeeper": "animpeple/housekeeper.png",
  "simtower/animpeple/guard": "animpeple/guard.png",
  // yoot_condo plugin art (C++: BitmapManager::loadFromPlugin("Condo.t2p",
  // 1000/1100)): empty = OpenTower folder sheet (640x72, 15 frames of 128x24);
  // resident = 41-frame strip of 16x24 extracted from the PE RT_BITMAP 1100.
  "simtower/yootcondo/empty": "yootcondo/empty.png",
  "simtower/yootcondo/resident": "yootcondo/resident.png",
  // ui sheets (toolbox icons, time header, minimap)
  "simtower/ui/toolbox/tools": "ui/toolbox/tools.png",
  "simtower/ui/toolbox/items": "ui/toolbox/items.png",
  "simtower/ui/toolbox/speed": "ui/toolbox/speed.png",
  "simtower/ui/time/bg": "ui/time/bg.png",
  "simtower/ui/time/rating": "ui/time/rating.png",
  "simtower/ui/map/sky": "ui/map/sky.png",
  "simtower/ui/map/ground": "ui/map/ground.png",
  "simtower/ui/map/buttons": "ui/map/buttons.png",
  "simtower/ui/map/overlays": "ui/map/overlays.png",
  "simtower/ui/menubg": "ui/menubg.png",
  // data-root loose files
  "noroute.png": "noroute.png",
};

// key -> original resource name, used as a required-key manifest only.
export const SOUND_FILES = {
  "simtower/construction/normal": "construction/normal.wav",
  "simtower/construction/flexible": "construction/flexible.wav",
  "simtower/construction/impossible": "construction/impossible.wav",
  "simtower/bulldozer": "bulldozer.wav",
  "simtower/restaurant": "restaurant.wav",
  "simtower/office": "office.wav",
  "simtower/metro": "metro.wav",
  "simtower/partyhall": "partyhall.wav",
  "simtower/fastfood/0": "fastfood/0.wav",
  "simtower/fastfood/1": "fastfood/1.wav",
  "simtower/fastfood/2": "fastfood/2.wav",
  "simtower/car/departing": "car/departing.wav",
  "simtower/car/arriving": "car/arriving.wav",
  "simtower/doorbell": "doorbell.wav",
  "simtower/hover": "hover.wav",
  "simtower/toilet": "toilet.wav",
  "simtower/birds/morning": "birds/morning.wav",
  "simtower/birds/evening": "birds/evening.wav",
  "simtower/birds/day": "birds/day.wav",
  "simtower/cock": "cock.wav",
  "simtower/rain": "rain.wav",
  "simtower/bells": "bells.wav",
  "simtower/thunder": "thunder.wav",
  "simtower/crickets": "crickets.wav",
  "simtower/wind": "wind.wav",
  "simtower/rating/increased": "rating/increased.wav",
  "simtower/rating/tower": "rating/tower.wav",
  "simtower/applause": "applause.wav",
  "simtower/santa": "santa.wav",
  "simtower/cash": "cash.wav",
  "simtower/splashscreen": "splashscreen.wav",
  "simtower/elevator/arriving": "elevator/arriving.wav",
  "simtower/elevator/departing": "elevator/departing.wav",
};
for (let i = 0; i <= 14; i++) {
  SOUND_FILES["simtower/cinema/movie" + i] = "cinema/movie" + i + ".wav";
}

export const BITMAP_KEYS = Object.freeze(Object.keys(BITMAP_FILES));
export const SOUND_KEYS = Object.freeze(Object.keys(SOUND_FILES));

// Kept as empty compatibility exports for code that imports the old names.
// User-supplied media is registered per session, not put in a global URL map.
export const BITMAP_URLS = Object.freeze({});
export const SOUND_URLS = Object.freeze({});
export const SPLASHSCREEN_URL = null;

const hasDOM = typeof document !== "undefined" && typeof document.createElement === "function";

export class BitmapRegistry {
  // urls: key -> URL map (optional for app-created/OpenSky assets). SimTower
  // uses `register()` with decoded in-memory Canvas/Image sources instead.
  constructor(urls = {}) {
    this.urls = { ...urls };
    this.images = new Map(); // key -> HTMLImageElement or HTMLCanvasElement
    this.knownKeys = new Set([...BITMAP_KEYS, ...Object.keys(this.urls)]);
  }

  has(key) {
    return this.knownKeys.has(key);
  }

  url(key) {
    return this.has(key) ? (this.urls[key] ?? null) : null;
  }

  // Loaded image element or null (headless / not yet loaded).
  image(key) {
    const img = this.images.get(key);
    if (!img) return null;
    const width = img.naturalWidth ?? img.videoWidth ?? img.width ?? 0;
    return width > 0 ? img : null;
  }

  // Contract used by src/game/items/item.js: {x: width, y: height} or null.
  getSize(key) {
    const img = this.image(key);
    if (!img) return null;
    return {
      x: img.naturalWidth ?? img.videoWidth ?? img.width,
      y: img.naturalHeight ?? img.videoHeight ?? img.height,
    };
  }

  register(key, source) {
    if (!source) return false;
    this.knownKeys.add(key);
    this.images.set(key, source);
    return true;
  }

  registerAll(sources) {
    for (const [key, source] of Object.entries(sources || {})) this.register(key, source);
  }

  // loader(url) -> Promise<HTMLImageElement>. Browser-only; rejects in bun.
  loader(url) {
    return new Promise((resolve, reject) => {
      if (!hasDOM) {
        reject(new Error("BitmapRegistry.loader requires a DOM (no document)"));
        return;
      }
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("failed to load bitmap " + url));
      img.src = url;
    });
  }

  // Load the given keys (default: every mapped bitmap) and cache the elements.
  // Resolves with the list of keys that FAILED (empty = all good) so callers
  // can log without unhandled rejections.
  async load(keys = Object.keys(this.urls)) {
    const failed = [];
    await Promise.all(
      keys.map(async (key) => {
        try {
          this.images.set(key, await this.loader(this.urls[key]));
        } catch {
          failed.push(key);
        }
      }),
    );
    return failed;
  }
}

// Sound key -> URL (or null for unknown keys).
export function soundUrl(key, urls = {}) {
  return urls[key] || null;
}
