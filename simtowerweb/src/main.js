// OpenSkyWeb bootstrap (UI agent).
//
// Boot: create an empty game shell -> show the edition/ownership gate -> load
// the verified edition's assets -> create or load a tower -> RAF loop. The sim
// never starts until the user has supplied an allowlisted game executable.
//
// All boot failures surface in an on-screen #erroverlay div instead of a dead
// black page.

import { BitmapRegistry } from "./render/assets.js";
import { loadSimTowerMedia } from "./render/simtower-dumper.js";
import { loadOpenSkyMedia } from "./render/opensky-media.js";
import { Renderer } from "./render/renderer.js";
import { createGame } from "./game/create.js";
import { SoundPlayer } from "./ui/soundplayer.js";
import { createUI } from "./ui/ui.js";
import { Storage } from "./core/storage.js";
import { AutosaveScheduler } from "./core/autosave.js";
import { reportJSON } from "./core/report.js";
import { loadSettings } from "./core/settings.js";
import { formatAutosaveResumeLabel } from "./ui/format.js";
import { BUILD_INFO } from "./core/version.js";
import {
  GAME_MODES,
  ownershipErrorMessage,
  verifyGameOwnership,
} from "./core/ownership.js";
import {
  cachedMediaFile,
  clearVerifiedMedia,
  loadVerifiedMedia,
  saveVerifiedMedia,
} from "./core/media-cache.js";

import "./ui/ui.css";

function injectStyles() {
  // ui.css used to be appended here as a <link> with a cache-busting query.
  // It is a static import now (see the top of this file): the build emits it
  // as a content-hashed stylesheet, which both versions it properly and keeps
  // it out of the origin-rooted path this file can no longer assume.
  // suppress the default /favicon.ico 404 noise
  if (!document.querySelector('link[rel="icon"]')) {
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.href = "data:,";
    document.head.appendChild(icon);
  }
}

function showError(message) {
  let el = document.getElementById("erroverlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "erroverlay";
    (document.getElementById("ui") || document.body).appendChild(el);
  }
  el.style.display = "block";
  el.textContent += message + "\n\n";
}

if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => showError(e.message + "\n" + (e.filename || "") + ":" + (e.lineno || 0)));
  window.addEventListener("unhandledrejection", (e) => showError(String(e.reason?.stack || e.reason || e)));
}

// Trigger a browser download for an in-memory Blob (URL revoked shortly after).
function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function downloadText(text, filename, mime) {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

// Dev-console unlock for the OpenSkyScraper community-art edition. The mode is
// fully playable without any original game file, but stays locked until the
// player opts in (or passes ?edition=opensky); `openSkyScraper.unlock()` in
// the dev console flips the flag persisted here.
export const OPENSKY_UNLOCK_KEY = "openskyweb.unlocked.opensky";

export function openSkyEditionUnlocked(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  if (!storage) return false;
  try {
    return storage.getItem(OPENSKY_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function setOpenSkyEditionUnlocked(unlocked, storage = typeof localStorage !== "undefined" ? localStorage : null) {
  if (!storage) return;
  try {
    if (unlocked) storage.setItem(OPENSKY_UNLOCK_KEY, "1");
    else storage.removeItem(OPENSKY_UNLOCK_KEY);
  } catch {
    // storage unavailable (private mode etc.) — unlock stays sessionless
  }
}

// Main menu overlay. It doubles as the edition picker: no action that creates,
// loads, or resumes a tower is available until an edition is prepared (an
// allowlisted SimTower file verified, or the OpenSkyScraper art loaded).
export function createMenu(game, {
  onStart, onLoad, onResume, onOptions, onVerified, hasAutosave, autosaveMeta,
}) {
  const el = document.createElement("div");
  el.id = "mainmenu";

  const panel = document.createElement("div");
  panel.className = "mm-panel";
  panel.innerHTML =
    "<h1>OpenSkyWeb</h1>" +
    '<div class="mm-sub">choose an edition to begin</div>';
  const editionList = document.createElement("div");
  editionList.className = "mm-editions";
  const ownershipStatus = document.createElement("div");
  ownershipStatus.className = "mm-ownership-status";
  ownershipStatus.textContent = "SimTower remake requires your original SIMTOWER.EXE or SIMTOWER.EX_.";

  let selectedMode = GAME_MODES[0];
  let verification = null;
  let verifying = false;
  // Token bumped whenever a verification flow (upload or cache restore) starts
  // or the selected edition changes; stale flows abort at their next await.
  let session = 0;
  const actions = [];

  for (const mode of GAME_MODES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mm-edition";
    button.dataset.mode = mode.id;
    button.disabled = !mode.enabled;
    button.textContent = mode.label + (mode.enabled ? "" : " — coming soon");
    button.title = mode.requires ?? mode.requiresLabel ?? mode.unavailableReason ?? "";
    button.classList.toggle("selected", mode.id === selectedMode.id);
    button.addEventListener("click", () => {
      if (!mode.enabled || verifying) return;
      selectedMode = mode;
      verification = null;
      session++;
      game.ownership = null;
      for (const b of editionList.querySelectorAll(".mm-edition")) b.classList.remove("selected");
      button.classList.add("selected");
      updateEditionUI();
      if (mode.id === "opensky") void prepareOpenSky();
      updateActions();
    });
    editionList.appendChild(button);
  }
  panel.appendChild(editionList);

  const mk = (label, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "osbtn";
    b.textContent = label;
    b.addEventListener("click", fn);
    panel.appendChild(b);
    return b;
  };
  const verifyButton = mk("Verify SIMTOWER.EXE / EX_", () => executableInput.click());
  const forgetButton = document.createElement("button");
  forgetButton.type = "button";
  forgetButton.className = "mm-forget";
  forgetButton.textContent = "Forget cached SIMTOWER file";
  forgetButton.hidden = true;
  forgetButton.title = "Remove the verified file stored in this browser's IndexedDB.";
  forgetButton.addEventListener("click", async () => {
    forgetButton.disabled = true;
    const cleared = await clearVerifiedMedia(selectedMode.id);
    forgetButton.disabled = false;
    forgetButton.hidden = true;
    ownershipStatus.textContent = cleared
      ? "Cached SIMTOWER file removed from this browser."
      : "Could not remove the cached file; clear site data instead.";
  });
  verifyButton.insertAdjacentElement("afterend", forgetButton);
  const newGameButton = mk("New Game", () => close(true));
  const loadGameButton = mk("Load Saved Tower", () => saveFileInput.click());
  actions.push(newGameButton, loadGameButton);
  if (hasAutosave) {
    const meta = autosaveMeta ?? Storage.getAutosaveMeta();
    const resumeLabel = formatAutosaveResumeLabel(meta);
    const resumeButton = mk(resumeLabel, () => { onResume?.(); close(false); });
    actions.push(resumeButton);
  }
  mk("Options", () => { onOptions?.(); });
  panel.insertBefore(ownershipStatus, verifyButton);
  panel.insertAdjacentHTML(
    "beforeend",
    '<div class="mm-hint">Arrows / wheel: scroll &nbsp; PageUp/Down: zoom<br>' +
    "0-3: speed &nbsp; O: status view &nbsp; M: map &nbsp; F: finance &nbsp; Esc: close<br>" +
    "Click items with the Inspect tool for details; build from the toolbox.</div>" +
    `<div class="mm-build-info" style="margin-top:10px;font-size:10px;color:#888;text-align:center;font-family:monospace;">` +
    `v${BUILD_INFO.version} · commit <span style="color:#aaa;">${BUILD_INFO.commitShort}</span> (${BUILD_INFO.branch})` +
    `</div>`,
  );
  el.appendChild(panel);

  const executableInput = document.createElement("input");
  executableInput.type = "file";
  executableInput.accept = ".exe,.ex_,application/octet-stream";
  executableInput.style.display = "none";
  executableInput.addEventListener("change", async () => {
    const file = executableInput.files && executableInput.files[0];
    if (!file) return;
    const mySession = ++session;
    try {
      verifying = true;
      updateActions();
      ownershipStatus.textContent = "Verifying SHA-256…";
      const result = await verifyGameOwnership(selectedMode.id, file);
      if (mySession !== session) return;
      if (!result.valid) {
        ownershipStatus.textContent = ownershipErrorMessage(result);
        return;
      }
      // Keep the verified bytes in the browser's own IndexedDB so the next
      // visit can restore without re-uploading; failure is non-fatal.
      const bytes = await file.arrayBuffer();
      const cached = await saveVerifiedMedia({
        mode: result.mode.id,
        filename: result.filename,
        kind: result.kind,
        hash: result.hash,
        bytes,
      });
      if (mySession !== session) return;
      forgetButton.hidden = !cached;
      await applyVerification(result, file, mySession, cached
        ? "SimTower verified and cached in this browser."
        : "SimTower verified for this browser session.");
    } catch (err) {
      ownershipStatus.textContent = "Verification setup failed: " + (err?.message || err);
    } finally {
      executableInput.value = "";
      if (mySession === session) {
        verifying = false;
        updateActions();
      }
    }
  });
  el.appendChild(executableInput);

  const saveFileInput = document.createElement("input");
  saveFileInput.type = "file";
  saveFileInput.accept = ".tower,.xml,text/xml,application/xml";
  saveFileInput.style.display = "none";
  saveFileInput.addEventListener("change", async () => {
    const file = saveFileInput.files && saveFileInput.files[0];
    if (!verification || !file) return;
    try {
      const text = await file.text();
      onLoad(text, file.name);
      close(false);
    } catch (err) {
      showError("Load failed: " + (err?.stack || err));
    } finally {
      saveFileInput.value = "";
    }
  });
  el.appendChild(saveFileInput);

  let open = true;
  function updateActions(busyLabel) {
    const ready = Boolean(verification) && !verifying;
    for (const action of actions) action.disabled = !ready;
    verifyButton.disabled = verifying;
    verifyButton.textContent = verifying ? (busyLabel || "Verifying…") : "Verify SIMTOWER.EXE / EX_";
  }

  async function applyVerification(result, file, mySession, doneStatus) {
    ownershipStatus.textContent = "Verified original SimTower media. Preparing assets…";
    await onVerified?.(result, file);
    if (mySession !== session) return;
    verification = result;
    game.ownership = { mode: result.mode.id, hash: result.hash, filename: result.filename };
    ownershipStatus.textContent = doneStatus;
  }

  // Restore a previously verified file from this browser's cache so the player
  // does not need to re-select it on every visit. The cached bytes are always
  // re-verified against the allowlist; any mismatch drops the cached record.
  (async () => {
    const mySession = session;
    const record = await loadVerifiedMedia(selectedMode.id);
    if (mySession !== session) return;
    if (!record) return;
    const file = cachedMediaFile(record);
    if (!file) {
      await clearVerifiedMedia(selectedMode.id);
      return;
    }
    try {
      verifying = true;
      updateActions("Restoring…");
      ownershipStatus.textContent = "Checking cached SimTower media…";
      const result = await verifyGameOwnership(selectedMode.id, file);
      if (mySession !== session) return;
      if (!result.valid) {
        await clearVerifiedMedia(selectedMode.id);
        forgetButton.hidden = true;
        ownershipStatus.textContent = "The cached SimTower file no longer matches; choose it again.";
        return;
      }
      forgetButton.hidden = false;
      await applyVerification(result, file, mySession, "SimTower media restored from this browser's cache.");
    } catch (err) {
      ownershipStatus.textContent = "Could not restore cached media: " + (err?.message || err);
    } finally {
      if (mySession === session) {
        verifying = false;
        updateActions();
      }
    }
  })();

  // Mode-aware chrome: the OpenSkyScraper edition has no file to verify; it
  // is dev-console locked until openSkyScraper.unlock() (or ?edition=opensky).
  function updateEditionUI() {
    const isOpenSky = selectedMode.id === "opensky";
    const unlocked = openSkyEditionUnlocked();
    const openskyButton = editionList.querySelector('[data-mode="opensky"]');
    if (openskyButton) {
      const openskyMode = GAME_MODES.find((m) => m.id === "opensky");
      openskyButton.textContent =
        openskyMode.label + (unlocked ? "" : " — locked (dev)");
      openskyButton.title = unlocked
        ? "Openly licensed OpenSkyscraper community art — no original file required."
        : "Locked — run openSkyScraper.unlock() in the dev console to enable.";
      openskyButton.classList.toggle("mm-edition-locked", !unlocked);
    }
    verifyButton.hidden = isOpenSky;
    if (isOpenSky) forgetButton.hidden = true;
    ownershipStatus.textContent = isOpenSky
      ? unlocked
        ? "OpenSkyScraper uses OpenSkyscraper's openly licensed art — no file required."
        : "Locked — run openSkyScraper.unlock() in the dev console to enable this edition."
      : "SimTower remake requires your original SIMTOWER.EXE or SIMTOWER.EX_.";
  }

  async function prepareOpenSky() {
    const mySession = ++session;
    try {
      verifying = true;
      updateActions("Preparing art…");
      ownershipStatus.textContent = "Preparing OpenSkyScraper community art…";
      const result = await verifyGameOwnership("opensky", null);
      if (mySession !== session) return;
      await onVerified?.(result, null);
      if (mySession !== session) return;
      verification = result;
      game.ownership = { mode: "opensky", hash: null, filename: "opensky-art" };
      ownershipStatus.textContent = "OpenSkyScraper community art ready.";
    } catch (err) {
      ownershipStatus.textContent = "Failed to prepare OpenSky art: " + (err?.message || err);
    } finally {
      if (mySession === session) {
        verifying = false;
        updateActions();
      }
    }
  }

  function close(fresh) {
    if (!open || !verification) return;
    open = false;
    el.style.display = "none";
    onStart(fresh);
  }

  updateEditionUI();
  updateActions();

  return {
    el,
    get open() { return open; },
    get verified() { return Boolean(verification); },
    close,
    // Re-read the dev-console unlock flag and refresh the edition buttons.
    refreshOpenSkyLock: updateEditionUI,
  };
}

async function boot() {
  injectStyles();

  const canvas = document.getElementById("game");
  if (!canvas) throw new Error("#game canvas not found");

  // Do not fetch edition assets before the ownership gate accepts a game file.
  const bitmaps = new BitmapRegistry();
  let editionMedia = null;

  // ?edition=opensky unlocks the community-art edition for this browser —
  // same flag the dev console handle flips.
  if (new URLSearchParams(location.search).get("edition") === "opensky") {
    setOpenSkyEditionUnlocked(true);
  }

  const settings = loadSettings();
  const sound = new SoundPlayer({
    muted: settings.muted,
    volume: settings.masterVolume,
    musicEnabled: settings.musicEnabled,
    sfxEnabled: settings.sfxEnabled,
  });
  const app = {
    window: { width: window.innerWidth, height: window.innerHeight },
    sound,
    bitmaps,
  };

  const game = createGame(app);
  game.zoom = settings.defaultZoom;
  game.zoomStep = settings.zoomStep;
  const renderer = new Renderer(canvas, { bitmaps });
  if (typeof window !== "undefined") {
    window.__game = game; // debug/testing handle
    window.__renderer = renderer;
    window.__OPENSKY_BUILD__ = BUILD_INFO;
    console.log(
      `%c[OpenSkyWeb] v${BUILD_INFO.version} (commit: ${BUILD_INFO.commitShort}, branch: ${BUILD_INFO.branch}, built: ${BUILD_INFO.builtAt})`,
      "color:#4ade80;font-weight:bold;",
    );
  }

  // UI hooks must be live before seeding (seedNewTower pokes them).
  const ui = createUI(game, {
    container: document.getElementById("ui"),
    renderer,
    sound,
    bitmaps,
  });
  game.ui.saveRequested = () => game.ui.saveAs(game.saveFilename || "tower.tower");
  game.ui.saveAs = (filename) => {
    try {
      const xml = game.encodeXML();
      downloadText(xml, filename, "application/xml");
      game.saveFilename = filename;
      game.markSaved();
      game.ui.showMessage("Saved " + filename);
    } catch (err) {
      showError("Save failed: " + (err?.stack || err));
    }
  };
  game.ui.exportScreenshot = () => {
    try {
      const canvas = renderer.capturePNG(game, 3);
      if (!canvas) {
        game.ui.showMessage("Screenshot unavailable");
        return;
      }
      const base = (game.saveFilename || "tower.tower").replace(/\.tower$/i, "");
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, base + ".png");
      }, "image/png");
    } catch (err) {
      showError("Screenshot failed: " + (err?.stack || err));
    }
  };
  game.ui.exportReport = () => {
    try {
      downloadText(reportJSON(game), "tower-report.json", "application/json");
    } catch (err) {
      showError("Report failed: " + (err?.stack || err));
    }
  };

  const inGameFileInput = document.createElement("input");
  inGameFileInput.type = "file";
  inGameFileInput.accept = ".tower,.xml,text/xml,application/xml";
  inGameFileInput.style.display = "none";
  inGameFileInput.addEventListener("change", async () => {
    const file = inGameFileInput.files && inGameFileInput.files[0];
    if (!file) return;
    if (!game.ownership?.mode) {
      game.ui.showMessage("Verify your game media from the main menu first");
      inGameFileInput.value = "";
      return;
    }
    try {
      const text = await file.text();
      game.decodeXML(text);
      game.saveFilename = file.name || "";
      refreshAll();
      game.ui.showMessage("Loaded " + (file.name || "tower"));
    } catch (err) {
      showError("Load failed: " + (err?.stack || err));
    } finally {
      inGameFileInput.value = "";
    }
  });
  document.getElementById("ui")?.appendChild(inGameFileInput);

  game.ui.loadRequested = () => {
    if (!game.ownership?.mode) {
      game.ui.showMessage("Verify your game media from the main menu first");
      return;
    }
    inGameFileInput.click();
  };
  game.ui.newGameRequested = () => {
    if (!game.ownership?.mode) {
      game.ui.showMessage("Verify your game media from the main menu first");
      return;
    }
    game.seedNewTower();
    refreshAll();
    game.ui.showMessage("Started new game");
  };

  const refreshAll = () => {
    game.ui.updateFunds();
    game.ui.updateRating();
    game.ui.updatePopulation();
    game.ui.updateMoneyStats();
    game.ui.updateSpeed();
    game.ui.updateTool();
    game.ui.updateTooltip();
    game.ui.updateTime();
    game.ui.reloadToolbox();
    game.ui.renderMap();
    game.ui.refreshFinance();
  };

  // ---- wake lock -------------------------------------------------------
  // Keep the screen on for the length of a play session — a tower runs on
  // for long idle-watching stretches, and a phone dimming/locking mid-game
  // is a worse interruption than the (silently no-op) unsupported case.
  let wakeLock = null;
  async function requestWakeLock() {
    try {
      wakeLock = (await navigator.wakeLock?.request("screen")) || null;
    } catch (_) {
      wakeLock = null; // unsupported, or document not visible — fine, no-op
    }
  }
  function releaseWakeLock() {
    wakeLock?.release().catch(() => {});
    wakeLock = null;
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releaseWakeLock();
    else if (!menu.open) requestWakeLock(); // OS releases the lock on hide; re-acquire
  });

  const menu = createMenu(game, {
    onStart(fresh) {
      if (fresh) {
        game.seedNewTower();
        refreshAll();
      }
      requestWakeLock();
    },
    onLoad(text, filename) {
      game.decodeXML(text);
      game.saveFilename = filename || "";
      refreshAll();
      requestWakeLock();
    },
    onResume() {
      if (Storage.loadFromSlot(game, "auto")) {
        refreshAll();
        game.ui.showMessage("Resumed from autosave");
      } else {
        game.ui.showMessage("No autosave found");
      }
      requestWakeLock();
    },
    onOptions() {
      game.ui.openOptionsDialog?.();
    },
    async onVerified(result, file) {
      editionMedia?.dispose();
      editionMedia = null;
      if (result.mode.id === "opensky") {
        const media = await loadOpenSkyMedia();
        editionMedia = media;
        bitmaps.registerAll(media.bitmaps);
        if (media.missing?.length) {
          console.warn("[OpenSkyScraper] sheets missing (features will degrade):", media.missing);
        }
        return;
      }
      editionMedia = await loadSimTowerMedia(file, result.kind);
      bitmaps.registerAll(editionMedia.bitmaps);
      sound.setUrls(editionMedia.soundUrls);
    },
    hasAutosave: Storage.hasAutosave(),
    autosaveMeta: Storage.getAutosaveMeta(),
  });
  document.getElementById("ui").appendChild(menu.el);

  // Dev-console handle for the OpenSkyScraper (community art) edition.
  if (typeof window !== "undefined") {
    window.openSkyScraper = {
      unlock() {
        setOpenSkyEditionUnlocked(true);
        menu.refreshOpenSkyLock();
        return "OpenSkyScraper edition unlocked — select it in the main menu.";
      },
      lock() {
        setOpenSkyEditionUnlocked(false);
        menu.refreshOpenSkyLock();
        return "OpenSkyScraper edition locked again.";
      },
      get unlocked() {
        return openSkyEditionUnlocked();
      },
    };
    if (!openSkyEditionUnlocked()) {
      console.info(
        "%c[OpenSkyWeb] Dev: the OpenSkyScraper (community art) edition is locked — run openSkyScraper.unlock() in this console to enable it, or reload with ?edition=opensky.",
        "color:#7dd3fc",
      );
    }
  }

  window.addEventListener("resize", () => ui.onResize());

  // ---- app-shell service worker ---------------------------------------
  // Static-asset caching only (see sw.js) — deferred past load so it never
  // competes with the initial boot for bandwidth/CPU.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      // Resolved against document.baseURI rather than hard-coded to the
      // origin root: the site is served from a subdirectory on GitHub Pages
      // (/Projects/simtowerweb/), and a worker registered at "/sw.js" would
      // 404 there — and if it did not, its scope would cover the whole site.
      navigator.serviceWorker.register(new URL("sw.js", document.baseURI)).catch((err) => {
        console.warn("[OpenSkyWeb] service worker registration failed:", err);
      });
    });
  }

  // ---- autosave + unsaved-changes guard -----------------------------------
  const autosave = new AutosaveScheduler();
  const wallNow = () => Date.now() / 1000;
  const gameDay = () => Math.floor(game.time.absolute);
  autosave.markSaved(wallNow(), gameDay()); // no autosave immediately on boot

  window.addEventListener("beforeunload", (e) => {
    if (game.isDirty) {
      e.preventDefault();
      e.returnValue = ""; // legacy browsers show a confirm
    }
  });

  const doAutosave = () => {
    if (menu.open) return;
    if (Storage.saveToSlot(game, "auto")) autosave.markSaved(wallNow(), gameDay());
  };

  setInterval(() => {
    if (menu.open) return;
    if (autosave.shouldSave(wallNow(), gameDay())) doAutosave();
  }, 15000);

  // Save immediately on losing focus — switching tabs/apps or minimizing is
  // exactly when a browser tab is most likely to get killed before the next
  // scheduled autosave fires. blur covers window/app switches; visibility
  // covers phones backgrounding the tab without necessarily blurring it.
  window.addEventListener("blur", doAutosave);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) doAutosave();
  });

  // ---- main loop -----------------------------------------------------------
  let last = performance.now();
  function tick(now) {
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;
    try {
      if (!menu.open) game.advance(dt);
      ui.advance(dt);
      renderer.frame(game);
    } catch (err) {
      showError("Frame error: " + (err?.stack || err));
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

if (typeof document === "undefined") {
  // headless (bun import of this module) — nothing to boot
} else if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", () => {
    boot().catch((err) => showError("Boot failed: " + (err?.stack || err)));
  });
} else {
  boot().catch((err) => showError("Boot failed: " + (err?.stack || err)));
}
