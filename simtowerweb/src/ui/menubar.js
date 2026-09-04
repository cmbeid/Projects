// MenuBar (UI agent) — classic desktop / SimTower style top application menu bar.
// Provides intuitive access to Game/File, Finance, View modes, Search/Find,
// Options and Help, eliminating cramped toolbox shortcuts.
// Import-safe headless: no DOM access at module scope.

import { makeDraggable } from "./draggable.js";
import { formatDate } from "./format.js";

export class MenuBar {
  constructor(game, container, {
    onNewGame,
    onLoadGame,
    onSaveGame,
    onSaveAsGame,
    onExportScreenshot,
    onExportReport,
    onToggleFinance,
    onToggleMap,
    onToggleFind,
    onToggleOptions,
    onCycleStatus,
    onSelectStatus,
    onShowShortcuts,
  } = {}) {
    this.game = game;
    this.onNewGame = onNewGame;
    this.onLoadGame = onLoadGame;
    this.onSaveGame = onSaveGame;
    this.onSaveAsGame = onSaveAsGame;
    this.onExportScreenshot = onExportScreenshot;
    this.onExportReport = onExportReport;
    this.onToggleFinance = onToggleFinance;
    this.onToggleMap = onToggleMap;
    this.onToggleFind = onToggleFind;
    this.onToggleOptions = onToggleOptions;
    this.onCycleStatus = onCycleStatus;
    this.onSelectStatus = onSelectStatus;
    this.onShowShortcuts = onShowShortcuts;

    this.activeMenu = null;
    this.sheetOpen = false;

    if (typeof document === "undefined") return;

    this._container = container;

    this.el = document.createElement("div");
    this.el.id = "menubar";
    this.el.className = "menubar";

    const menus = this._menuDefs();
    this._buildHamburger();
    this._buildMenus(menus);
    this._buildMenuSheet(menus);

    // Close open dropdowns when clicking outside
    this._onDocClick = (e) => {
      if (!this.el.contains(e.target)) {
        this.closeAll();
      }
    };
    this._onDocKeyDown = (e) => {
      if (e.key === "Escape") {
        this.closeAll();
      }
    };
    document.addEventListener("click", this._onDocClick);
    document.addEventListener("keydown", this._onDocKeyDown);

    if (container) {
      container.appendChild(this.el);
    }

    // ISSUE-040: publish the bar's live size as CSS vars so anything that
    // needs to clear it (the HUD strip on wider tiers) or sit flush beside
    // it (the HUD strip merged into the same row, on phones — see
    // #timewindow's `left: calc(var(--menubar-w) + Npx)` in ui.css) can do
    // so exactly, instead of a guessed pixel offset.
    if (typeof ResizeObserver !== "undefined") {
      const publishHeight = () => {
        document.documentElement.style.setProperty("--menubar-h", `${this.el.offsetHeight}px`);
        document.documentElement.style.setProperty("--menubar-w", `${this.el.offsetWidth}px`);
      };
      this._menubarResizeObserver = new ResizeObserver(publishHeight);
      this._menubarResizeObserver.observe(this.el);
      publishHeight();

      // ui.css itself is injected as a <link> by main.js's injectStyles()
      // *without* being awaited, so this constructor can (and typically
      // does) run before that stylesheet has finished loading. The very
      // first publishHeight() above then measures unstyled buttons — every
      // item on its own line — and publishes a wildly inflated value
      // (observed: ~148px vs. a real ~45-65px), leaving a large dead gap
      // above the HUD until *something* nudges the ResizeObserver again.
      // Re-publish once that stylesheet actually loads so it's never stuck.
      const stylesLink = document.querySelector('link[data-os-ui]');
      if (stylesLink) {
        stylesLink.addEventListener("load", publishHeight, { once: true });
      }
    }
  }

  destroy() {
    if (typeof document !== "undefined") {
      document.removeEventListener("click", this._onDocClick);
      document.removeEventListener("keydown", this._onDocKeyDown);
    }
    this._menubarResizeObserver?.disconnect();
    this.el?.remove();
    this.sheetBackdrop?.remove();
    this.sheetEl?.remove();
  }

  closeAll() {
    this.activeMenu = null;
    this.closeSheet();
    if (!this.el) return;
    for (const dd of this.el.querySelectorAll(".menubar-dropdown")) {
      dd.style.display = "none";
      // Clear any narrow-viewport anchor override from _positionDropdown().
      dd.style.left = "";
      dd.style.right = "";
    }
    for (const b of this.el.querySelectorAll(".menubar-item-btn")) {
      b.classList.remove("active");
    }
  }

  // ISSUE-040: phone portrait replaces the per-title dropdown row with a
  // single hamburger button (the row doesn't fit six titles on a phone
  // width without wrapping the bar to 2-3 rows) opening one bottom sheet
  // built from the same menu definitions — see _buildMenuSheet().
  _buildHamburger() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "menubar-hamburger";
    btn.title = "Menu";
    btn.setAttribute("aria-label", "Menu");
    btn.innerHTML =
      '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
      '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>';
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.sheetOpen ? this.closeSheet() : this.openSheet();
    });
    this.el.appendChild(btn);
    this.hamburgerBtn = btn;
  }

  openSheet() {
    this.closeAll();
    this.sheetOpen = true;
    if (this.sheetBackdrop) this.sheetBackdrop.style.display = "";
    if (this.sheetEl) this.sheetEl.style.display = "";
    this._refreshSheetStats();
  }

  // Rating and date live in the HUD strip normally, but the merged phone
  // bar drops them (ui.css) to leave room for the fund total. Surface them
  // here instead, read fresh each time the sheet opens rather than kept
  // continuously in sync — the sheet is only ever open a moment.
  _refreshSheetStats() {
    if (!this.sheetStatsEl || !this.game) return;
    const rating = this.game.rating ?? 0;
    let stars = "";
    for (let i = 0; i < 5; i++) stars += i <= rating ? "★" : "☆";
    const date = formatDate(this.game.time).text;
    const pop = this.game.population ?? 0;
    // `.tw-dirty` is hidden on the phone tier, so this is the only place an
    // unsaved-changes state is legible there.
    const dirty = this.game.isDirty ? "   • unsaved" : "";
    this.sheetStatsEl.textContent = `${stars}   ${date}   Pop ${pop}${dirty}`;
  }

  // Mirrors the HUD's dirty asterisk onto the hamburger, so an unsaved tower is
  // visible on a phone without opening the sheet. Driven from the UI frame loop.
  setDirty(dirty) {
    if (this._dirty === dirty) return;
    this._dirty = dirty;
    this.hamburgerBtn?.classList.toggle("has-unsaved", dirty);
    if (this.sheetOpen) this._refreshSheetStats();
  }

  closeSheet() {
    this.sheetOpen = false;
    if (this.sheetBackdrop) this.sheetBackdrop.style.display = "none";
    if (this.sheetEl) this.sheetEl.style.display = "none";
  }

  // ISSUE-040: on narrow phones a dropdown anchored left:0 to a button that
  // sits mid-row can run off the right edge of the viewport (min-width:200px
  // vs. e.g. a 320px screen). Flip the anchor to the right edge of the menu
  // when that would happen, so the whole menu stays reachable.
  _positionDropdown(dropdown) {
    dropdown.style.left = "0";
    dropdown.style.right = "auto";
    const rect = dropdown.getBoundingClientRect();
    const overflow = rect.right - (window.innerWidth - 4);
    if (overflow > 0) {
      dropdown.style.left = "auto";
      dropdown.style.right = "0";
    }
  }

  _menuDefs() {
    return [
      {
        title: "Game",
        items: [
          { label: "New Game", action: () => this.onNewGame?.() },
          { label: "Load Saved Tower...", action: () => this.onLoadGame?.() },
          { label: "Save Tower", shortcut: "Ctrl+S", action: () => this.onSaveGame?.() },
          { label: "Save As...", action: () => this.onSaveAsGame?.() },
          { type: "separator" },
          { label: "Export Screenshot (PNG)", action: () => this.onExportScreenshot?.() },
          { label: "Export Tower Report (JSON)", action: () => this.onExportReport?.() },
        ],
      },
      {
        title: "Finance",
        items: [
          { label: "Finance & Pricing Controls", shortcut: "F", action: () => this.onToggleFinance?.() },
        ],
      },
      {
        title: "View",
        items: [
          { label: "Minimap", shortcut: "M", action: () => this.onToggleMap?.() },
          { type: "separator" },
          { label: "Status Mode: Normal", action: () => this.onSelectStatus?.(0) },
          { label: "Status Mode: Evaluation", action: () => this.onSelectStatus?.(1) },
          { label: "Status Mode: Tenancy & For Sale", action: () => this.onSelectStatus?.(2) },
          { label: "Status Mode: Hotel Cleanliness", action: () => this.onSelectStatus?.(3) },
          { type: "separator" },
          { label: "Cycle Status View", shortcut: "O", action: () => this.onCycleStatus?.() },
        ],
      },
      {
        title: "Search",
        items: [
          { label: "Find People...", action: () => this.onToggleFind?.("people") },
          { label: "Find Tenants...", action: () => this.onToggleFind?.("tenants") },
          { label: "Find Stressed Occupants...", action: () => this.onToggleFind?.("stressed") },
          { label: "Find Dirty Hotel Rooms...", action: () => this.onToggleFind?.("dirty") },
          { type: "separator" },
          { label: "Find & Search", shortcut: "Ctrl+F", action: () => this.onToggleFind?.("people") },
        ],
      },
      {
        title: "Options",
        items: [
          { label: "Options & Audio Settings", shortcut: "Ctrl+O", action: () => this.onToggleOptions?.() },
        ],
      },
      {
        title: "Help",
        items: [
          {
            label: "Keyboard Shortcuts & Controls",
            action: () => {
              if (this.onShowShortcuts) {
                this.onShowShortcuts();
              } else {
                this.game?.ui?.showMessage?.(
                  "Shortcuts: Arrows/Wheel=Scroll · PgUp/Dn=Zoom · 0-3=Speed · F=Finance · M=Map · O=View · Ctrl+S=Save · Ctrl+O=Options · Ctrl+F=Find"
                );
              }
            },
          },
        ],
      },
    ];
  }

  _buildMenus(menus) {
    for (const m of menus) {
      const wrapper = document.createElement("div");
      wrapper.className = "menubar-menu";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "menubar-item-btn";
      btn.textContent = m.title;

      const dropdown = document.createElement("div");
      dropdown.className = "menubar-dropdown";
      dropdown.style.display = "none";

      for (const item of m.items) {
        if (item.type === "separator") {
          const sep = document.createElement("div");
          sep.className = "menubar-separator";
          dropdown.appendChild(sep);
          continue;
        }

        const itemEl = document.createElement("button");
        itemEl.type = "button";
        itemEl.className = "menubar-dropdown-item";

        const labelSpan = document.createElement("span");
        labelSpan.className = "menubar-item-label";
        labelSpan.textContent = item.label;
        itemEl.appendChild(labelSpan);

        if (item.shortcut) {
          const scSpan = document.createElement("span");
          scSpan.className = "menubar-item-shortcut";
          scSpan.textContent = item.shortcut;
          itemEl.appendChild(scSpan);
        }

        itemEl.addEventListener("click", () => {
          this.closeAll();
          item.action?.();
        });

        dropdown.appendChild(itemEl);
      }

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.activeMenu === m.title) {
          this.closeAll();
        } else {
          this.closeAll();
          this.activeMenu = m.title;
          btn.classList.add("active");
          dropdown.style.display = "flex";
          this._positionDropdown(dropdown);
        }
      });

      btn.addEventListener("mouseenter", () => {
        if (this.activeMenu && this.activeMenu !== m.title) {
          this.closeAll();
          this.activeMenu = m.title;
          btn.classList.add("active");
          dropdown.style.display = "flex";
          this._positionDropdown(dropdown);
        }
      });

      wrapper.appendChild(btn);
      wrapper.appendChild(dropdown);
      this.el.appendChild(wrapper);
    }
  }

  // ISSUE-040: the phone-portrait counterpart to _buildMenus() — same menu
  // definitions (so Save/Load/Finance/Find/etc. stay wired to the exact
  // same callbacks), rendered as one scrollable, thumb-sized list inside a
  // bottom sheet instead of six cramped per-title dropdowns. Lives outside
  // #menubar (appended to the UI root) so its z-index isn't capped by
  // #menubar's own stacking context.
  _buildMenuSheet(menus) {
    const root = this._container;
    if (!root) return;

    const backdrop = document.createElement("div");
    backdrop.className = "osmodal-backdrop";
    backdrop.style.display = "none";
    backdrop.addEventListener("click", () => this.closeSheet());

    const sheet = document.createElement("div");
    sheet.id = "menu-sheet";
    sheet.className = "oswin";
    sheet.style.display = "none";

    const title = document.createElement("div");
    title.className = "oswin-title";
    const titleLabel = document.createElement("span");
    titleLabel.textContent = "Menu";
    const closeX = document.createElement("span");
    closeX.className = "oswin-x";
    closeX.dataset.close = "";
    closeX.textContent = "×";
    title.appendChild(titleLabel);
    title.appendChild(closeX);
    sheet.appendChild(title);

    const stats = document.createElement("div");
    stats.className = "ms-stats";
    sheet.appendChild(stats);
    this.sheetStatsEl = stats;

    const body = document.createElement("div");
    body.className = "oswin-body ms-body";

    for (const m of menus) {
      const section = document.createElement("div");
      section.className = "ms-section";
      section.textContent = m.title.toUpperCase();
      body.appendChild(section);

      for (const item of m.items) {
        if (item.type === "separator") continue; // section headers already group these

        const row = document.createElement("button");
        row.type = "button";
        row.className = "ms-item";

        const labelSpan = document.createElement("span");
        labelSpan.textContent = item.label;
        row.appendChild(labelSpan);

        if (item.shortcut) {
          const scSpan = document.createElement("span");
          scSpan.className = "ms-item-shortcut";
          scSpan.textContent = item.shortcut;
          row.appendChild(scSpan);
        }

        row.addEventListener("click", () => {
          this.closeSheet();
          item.action?.();
        });

        body.appendChild(row);
      }
    }

    sheet.appendChild(body);
    sheet.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) this.closeSheet();
    });

    root.appendChild(backdrop);
    root.appendChild(sheet);
    this.sheetBackdrop = backdrop;
    this.sheetEl = sheet;
    // Same swipe-down-to-close gesture as the other phone bottom sheets; the
    // grabber pill is drawn on this title bar too.
    makeDraggable(sheet, title, { onDismiss: () => this.closeSheet() });
  }
}
