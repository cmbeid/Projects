// Toolbox window (UI agent) — port of ToolboxWindow.cpp as plain DOM.
//
// Matches OpenSky/SimTower C++ ToolboxWindow layout and interactions:
// - Top row: Bulldozer, Finger (resize elevator shaft), Inspector.
// - Middle grid: 3-column palette containing unlocked parents + standalone tools
//   in catalog registration order. Locked items are omitted.
// - Press-and-hold (300 ms) on category parents (lobby, stairs, elevator-standard,
//   hotel_single, condo) opens an overlay with unlocked child alternatives.
// - Releasing over an alternative selects it and swaps the slot icon to display it
//   (parentActiveChild slot substitution). Short click selects current slot tool.
// - Bottom rows: Speed controls (Pause toggles back to lastSpeedMode) + Map/Fin/View toggles.

import {
  toolboxIconIndex,
  toolLabel,
  formatCompactMoney,
  isChildTool,
  isCategoryParent,
  getVisibleGridPrototypes,
  getOverlayAlternatives,
} from "./format.js";
import { makeDraggable } from "./draggable.js";

const ITEMS_SHEET = "simtower/ui/toolbox/items";
const TOOLS_SHEET = "simtower/ui/toolbox/tools";
const HOLD_MS = 300;

// Tools row order per ToolboxWindow.cpp STEP 1: bulldozer, finger, inspector.
const TOOL_BUTTONS = [
  { id: "bulldozer", cell: 0, title: "Bulldoze" },
  { id: "finger", cell: 1, title: "Resize elevator shaft" },
  { id: "inspector", cell: 2, title: "Inspect" },
];

const SPEED_BUTTONS = ["||", "\u25b6", "\u25b6\u25b6", "\u25b6\u25b6\u25b6"];

export class Toolbox {
  constructor(game, container, { bitmaps = null } = {}) {
    this.game = game;
    this.bitmaps = bitmaps;
    this.parentActiveChild = new Map(); // parentId -> displayed child protoId

    this.el = document.createElement("div");
    this.el.id = "toolbox";
    this.el.className = "oswin";

    this.toolBtns = new Map(); // tool name -> element
    this.gridSlots = new Map(); // parent/standalone protoId -> { el, iconEl, priceEl, protoId }
    this.speedBtns = [];

    // Press-and-hold overlay state
    this.holdingParent = null;
    this.holdingSlotEl = null;
    this.holdTimer = null;
    this.overlayEl = null;
    this.overlayButtons = []; // array of { el, protoId }
    this.hoveredOverlayProto = null;

    // ISSUE-040 phone layout: the toolbox collapses to its header strip.
    this.collapsed = false;

    // Bind document-level pointer listeners for reliable release & drag
    this._onDocPointerMove = this._onDocPointerMove.bind(this);
    this._onDocPointerUp = this._onDocPointerUp.bind(this);
    if (typeof document !== "undefined") {
      document.addEventListener("pointermove", this._onDocPointerMove);
      document.addEventListener("pointerup", this._onDocPointerUp);
      document.addEventListener("pointercancel", this._onDocPointerUp);
    }

    if (container) container.appendChild(this.el);
    makeDraggable(this.el);

    // Publish the drawer's live height so the phone toast layer can sit
    // exactly clear of it, the same way MenuBar publishes --menubar-h/-w.
    if (typeof ResizeObserver !== "undefined" && typeof document !== "undefined") {
      this._resizeObserver = new ResizeObserver(() => this._publishHeight());
      this._resizeObserver.observe(this.el);
    }

    this.reload();
  }

  destroy() {
    this._clearHold();
    this._resizeObserver?.disconnect();
    if (typeof document !== "undefined") {
      document.removeEventListener("pointermove", this._onDocPointerMove);
      document.removeEventListener("pointerup", this._onDocPointerUp);
      document.removeEventListener("pointercancel", this._onDocPointerUp);
    }
    this.el.remove();
  }

  // Rebuild the palette (called on boot, rating change / load).
  reload() {
    const g = this.game;
    this._clearHold();
    this.el.replaceChildren();
    this.toolBtns.clear();
    this.gridSlots.clear();
    this.speedBtns = [];

    // ISSUE-040 narrow-screen drawer chrome: header strip collapses the body.
    const header = document.createElement("div");
    header.className = "tb-header";
    const title = document.createElement("span");
    title.className = "tb-title";
    title.textContent = "TOOLS";
    this.titleEl = title;
    // The HUD speed row is hidden on phones because "the drawer carries it" —
    // but the drawer's speed row is inside .tb-body, so collapsing the drawer
    // would otherwise take the only pause control on the device with it.
    const pauseBtn = document.createElement("button");
    pauseBtn.type = "button";
    pauseBtn.className = "osbtn tb-pause";
    pauseBtn.title = "Pause / resume";
    pauseBtn.addEventListener("click", () => this._onSpeedPress(0));
    this.pauseBtn = pauseBtn;

    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.className = "osbtn tb-collapse";
    collapseBtn.textContent = "\u25be";
    collapseBtn.setAttribute("aria-expanded", String(!this.collapsed));
    collapseBtn.title = "Collapse / expand the toolbox";
    collapseBtn.addEventListener("click", () => this.toggleCollapsed());
    header.appendChild(title);
    header.appendChild(pauseBtn);
    header.appendChild(collapseBtn);
    this.el.appendChild(header);

    // Everything below the header goes in .tb-body, which is what
    // `#toolbox.collapsed .tb-body { display: none }` hides. The tool row and
    // the palette used to be appended to this.el directly, so collapsing the
    // phone drawer hid only the speed buttons and left the palette — the whole
    // point of collapsing — on screen.
    const body = document.createElement("div");
    body.className = "tb-body";

    // Preserve valid slot substitutions across reload
    for (const [parentId, childId] of Array.from(this.parentActiveChild.entries())) {
      const childProto = g.itemFactory?.prototypesById?.[childId];
      if (!childProto) {
        this.parentActiveChild.delete(parentId);
      }
    }

    // STEP 1: Tool buttons (bulldozer, finger, inspector)
    const tools = document.createElement("div");
    tools.className = "tb-tools";
    for (const t of TOOL_BUTTONS) {
      const b = document.createElement("div");
      b.className = "tb-toolbtn";
      b.title = t.title;
      b.appendChild(this._iconCanvas(TOOLS_SHEET, t.cell, 21, 21, 24, 24));
      b.addEventListener("click", () => g.selectTool(t.id));
      tools.appendChild(b);
      this.toolBtns.set(t.id, b);
    }
    body.appendChild(tools);

    // STEP 2: 3-column Item Grid (parents + standalone tools only, filtered by rating)
    const gridWrap = document.createElement("div");
    gridWrap.className = "tb-grid-wrap";

    const grid = document.createElement("div");
    grid.className = "tb-grid";

    const allPrototypes = g.itemFactory?.prototypes || [];
    const visiblePrototypes = getVisibleGridPrototypes(allPrototypes, g.rating);

    for (const proto of visiblePrototypes) {
      const displayedId = this.parentActiveChild.get(proto.id) || proto.id;
      const displayedProto = g.itemFactory.prototypesById[displayedId] || proto;

      const slot = document.createElement("div");
      slot.className = "tb-item";
      slot.dataset.protoId = proto.id;

      const icon = document.createElement("div");
      icon.className = "tb-icon";
      this._applyIcon(icon, displayedProto.id);
      slot.appendChild(icon);

      const price = document.createElement("span");
      price.className = "tb-price";
      price.textContent = formatCompactMoney(displayedProto.price);
      slot.appendChild(price);

      this._updateSlotTooltip(slot, displayedProto);

      if (isCategoryParent(proto.id)) {
        // Press-and-hold handler for category parents
        slot.addEventListener("pointerdown", (e) => {
          if (e.button !== 0) return;
          this._startHold(proto.id, slot, e);
        });
      } else {
        // Standalone tool: select immediately on click
        slot.addEventListener("click", () => g.selectTool("item-" + proto.id));
      }

      grid.appendChild(slot);
      this.gridSlots.set(proto.id, { el: slot, iconEl: icon, priceEl: price, baseProto: proto });
    }
    gridWrap.appendChild(grid);
    body.appendChild(gridWrap);

    // STEP 3: Speed controls (pause toggles back to last non-zero mode)
    const speedRow = document.createElement("div");
    speedRow.className = "tb-speedrow";
    for (let i = 0; i < 4; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "osbtn";
      b.textContent = SPEED_BUTTONS[i];
      b.title = ["Pause (0)", "Speed 1x (1)", "Speed 2x (2)", "Speed 4x (3)"][i];
      b.addEventListener("click", () => this._onSpeedPress(i));
      speedRow.appendChild(b);
      this.speedBtns.push(b);
    }
    body.appendChild(speedRow);

    this.el.appendChild(body);
    this.el.classList.toggle("collapsed", !!this.collapsed);

    this.updateTool();
    this.updateSpeed();
    this._publishHeight();
  }

  // Publish the drawer's live height for the phone toast layer to clear, the
  // same way MenuBar publishes --menubar-h/-w. Called from reload() as well as
  // from the observer: the observer alone is not enough, since the first
  // callback would land while the drawer is still empty, and delivery is
  // suspended entirely while the document is hidden.
  _publishHeight() {
    if (typeof document === "undefined" || !this.el) return;
    document.documentElement.style.setProperty("--toolbox-h", `${this.el.offsetHeight}px`);
  }

  // ISSUE-040: narrow screens collapse the palette to its header strip.
  toggleCollapsed() {
    this.collapsed = !this.collapsed;
    this.el.classList.toggle("collapsed", this.collapsed);
    const btn = this.el.querySelector(".tb-collapse");
    if (btn) btn.setAttribute("aria-expanded", String(!this.collapsed));
    this._publishHeight();
  }

  // Set background-position from the canonical SimTower sprite-cell mapping.
  _applyIcon(iconEl, protoId) {
    const idx = toolboxIconIndex(protoId);
    const source = this.bitmaps?.image?.(ITEMS_SHEET);
    if (!source) {
      iconEl.style.backgroundImage = "none";
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, idx * 32, 0, 32, 32, 0, 0, 32, 32);
    iconEl.style.backgroundImage = `url(${canvas.toDataURL("image/png")})`;
    iconEl.style.backgroundPosition = "0 0";
  }

  _updateSlotTooltip(slotEl, proto) {
    slotEl.title = `${proto.name} \u2014 $${proto.price.toLocaleString("en-US")} (${proto.size.x}\u00d7${proto.size.y})`;
    // ISSUE-040: surface the long-press-armed height since there's no
    // Ctrl/Shift key on touch to show it in the moment the way it would
    // for a keyboard player holding the modifier down.
    if (proto.id === "lobby") {
      const h = this.game.lobbyHeight || 1;
      if (h > 1) slotEl.title += ` \u2014 armed for ${h} floors (long-press to change)`;
    }
  }

  _updateSlotVisual(parentId, displayedProtoId) {
    const slotInfo = this.gridSlots.get(parentId);
    if (!slotInfo) return;
    const proto = this.game.itemFactory?.prototypesById?.[displayedProtoId] || slotInfo.baseProto;
    this._applyIcon(slotInfo.iconEl, proto.id);
    slotInfo.priceEl.textContent = formatCompactMoney(proto.price);
    this._updateSlotTooltip(slotInfo.el, proto);
  }

  // Nearest-neighbour slice of a sprite sheet cell onto a small canvas.
  _iconCanvas(sheet, cell, cw, ch, w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const draw = (img) => {
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, cell * cw, 0, cw, ch, 0, 0, w, h);
    };
    const source = this.bitmaps?.image?.(sheet);
    if (source) draw(source);
    return c;
  }

  // ---- Press-and-Hold & Overlay Mechanics ------------------------------------

  _startHold(parentId, slotEl, event) {
    this._clearHold();
    this.holdingParent = parentId;
    this.holdingSlotEl = slotEl;
    this.hoveredOverlayProto = null;

    this.holdTimer = setTimeout(() => {
      this._showOverlay(parentId, slotEl);
    }, HOLD_MS);
  }

  _showOverlay(parentId, slotEl) {
    const g = this.game;
    const displayedId = this.parentActiveChild.get(parentId) || parentId;
    const alternatives = getOverlayAlternatives(
      parentId,
      displayedId,
      g.itemFactory.prototypesById,
      g.rating
    );

    // ISSUE-040: the lobby's height (normally Ctrl/held-Shift while placing
    // \u2014 no such thing on touch) gets its own synthetic entries here instead
    // of a real prototype swap, so it's reachable via the same long-press
    // gesture as everything else in this overlay.
    const isLobby = parentId === "lobby";
    if (alternatives.length === 0 && !isLobby) return;
    navigator.vibrate?.(15); // touch confirmation for the arm moment

    this.overlayEl = document.createElement("div");
    this.overlayEl.className = "tb-overlay";

    // Position overlay relative to the slot
    const slotRect = slotEl.getBoundingClientRect();
    const toolboxRect = this.el.getBoundingClientRect();
    const topOffset = slotRect.top - toolboxRect.top;
    const leftOffset = slotRect.right - toolboxRect.left + 4;

    this.overlayEl.style.top = `${topOffset}px`;
    this.overlayEl.style.left = `${leftOffset}px`;

    this.overlayButtons = [];

    for (const altProto of alternatives) {
      const btn = document.createElement("div");
      btn.className = "tb-item tb-overlay-item";
      btn.title = `${altProto.name} \u2014 $${altProto.price.toLocaleString("en-US")} (${altProto.size.x}\u00d7${altProto.size.y})`;

      const icon = document.createElement("div");
      icon.className = "tb-icon";
      this._applyIcon(icon, altProto.id);
      btn.appendChild(icon);

      const price = document.createElement("span");
      price.className = "tb-price";
      price.textContent = formatCompactMoney(altProto.price);
      btn.appendChild(price);

      this.overlayEl.appendChild(btn);
      this.overlayButtons.push({ el: btn, protoId: altProto.id });
    }

    if (isLobby) {
      for (const floors of [1, 2, 3]) {
        const btn = document.createElement("div");
        btn.className = "tb-item tb-overlay-item tb-overlay-height";
        btn.title = `${floors}-floor lobby`;
        if (floors === (g.lobbyHeight || 1)) btn.classList.add("checked");

        const label = document.createElement("div");
        label.className = "tb-icon tb-height-icon";
        label.textContent = "\u00d7" + floors;
        btn.appendChild(label);

        const sub = document.createElement("span");
        sub.className = "tb-price";
        sub.textContent = floors === 1 ? "floor" : "floors";
        btn.appendChild(sub);

        this.overlayEl.appendChild(btn);
        // Synthetic id, not a real catalog prototype \u2014 _onDocPointerUp()
        // special-cases the "lobby:h" prefix instead of selecting it as a tool.
        this.overlayButtons.push({ el: btn, protoId: "lobby:h" + floors });
      }
    }

    this.el.appendChild(this.overlayEl);
    // This overlay is the only touch route to escalators, express/service
    // elevators, twin/suite hotel rooms and multi-floor lobbies, so it must
    // never open off-screen. On phones the toolbox is a full-width bottom
    // drawer, which puts right-column slots hard against the viewport edge.
    this._fitOverlayInViewport(slotRect, toolboxRect);
  }

  // Prefer the right of the slot (the desktop placement), fall back to its
  // left, then clamp — same flip-then-fit approach as
  // MenuBar._positionDropdown(). Offsets are relative to #toolbox, which is
  // what the overlay is absolutely positioned against.
  _fitOverlayInViewport(slotRect, toolboxRect) {
    const el = this.overlayEl;
    if (!el || typeof window === "undefined") return;
    const margin = 4;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let rect = el.getBoundingClientRect();

    if (rect.right > vw - margin) {
      const leftOfSlot = slotRect.left - toolboxRect.left - rect.width - margin;
      el.style.left = `${
        leftOfSlot >= 0
          ? leftOfSlot
          : Math.max(margin - toolboxRect.left, vw - margin - rect.width - toolboxRect.left)
      }px`;
      rect = el.getBoundingClientRect();
    }
    if (rect.left < margin) {
      el.style.left = `${margin - toolboxRect.left}px`;
      rect = el.getBoundingClientRect();
    }
    if (rect.bottom > vh - margin) {
      el.style.top = `${(parseFloat(el.style.top) || 0) - (rect.bottom - (vh - margin))}px`;
      rect = el.getBoundingClientRect();
    }
    if (rect.top < margin) {
      el.style.top = `${(parseFloat(el.style.top) || 0) + (margin - rect.top)}px`;
    }
  }

  _onDocPointerMove(e) {
    if (!this.overlayEl || this.overlayButtons.length === 0) return;

    let hovered = null;
    for (const ob of this.overlayButtons) {
      const rect = ob.el.getBoundingClientRect();
      const isInside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      ob.el.classList.toggle("hover", isInside);
      if (isInside) hovered = ob.protoId;
    }
    this.hoveredOverlayProto = hovered;
  }

  _onDocPointerUp(e) {
    if (!this.holdingParent) return;

    const parentId = this.holdingParent;
    let selectedProtoId = null;

    if (this.overlayEl && this.hoveredOverlayProto) {
      // Released over a hovered overlay alternative
      selectedProtoId = this.hoveredOverlayProto;
    } else {
      // Short click or released off overlay: select currently displayed slot item
      selectedProtoId = this.parentActiveChild.get(parentId) || parentId;
    }

    // ISSUE-040: a lobby-height entry isn't a real prototype — arm the
    // height on the game and fall through as a plain lobby selection.
    if (selectedProtoId && selectedProtoId.startsWith("lobby:h")) {
      this.game.lobbyHeight = Number(selectedProtoId.slice(7)) || 1;
      selectedProtoId = parentId;
    }

    // Apply slot substitution
    if (selectedProtoId === parentId) {
      this.parentActiveChild.delete(parentId);
    } else {
      this.parentActiveChild.set(parentId, selectedProtoId);
    }
    this._updateSlotVisual(parentId, selectedProtoId);

    // Clean up hold & overlay
    this._clearHold();

    // Select the chosen tool
    this.game.selectTool("item-" + selectedProtoId);
    // selectTool() only refreshes when the tool actually changed, but a lobby
    // height pick keeps the same tool — refresh the header readout regardless.
    this._updateHeaderLabel();
  }

  _clearHold() {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
    }
    this.overlayButtons = [];
    this.hoveredOverlayProto = null;
    this.holdingParent = null;
    this.holdingSlotEl = null;
  }

  // ---- Tool & Speed Updates --------------------------------------------------

  // Highlight the selected tool (game.ui.updateTool).
  updateTool() {
    const sel = this.game.selectedTool;
    this._updateHeaderLabel();

    // Update non-item tool buttons
    for (const [name, el] of this.toolBtns) {
      el.classList.toggle("checked", name === sel);
    }

    // Update item grid slots
    let selectedProtoId = "";
    if (sel && sel.startsWith("item-")) {
      selectedProtoId = sel.slice(5);
    }

    const parentOfSelected = selectedProtoId ? isChildTool(selectedProtoId) : null;

    for (const [slotId, slotInfo] of this.gridSlots) {
      let isChecked = false;

      if (parentOfSelected && slotId === parentOfSelected) {
        // A child tool is selected; update parent slot to show child and highlight it
        if (this.parentActiveChild.get(parentOfSelected) !== selectedProtoId) {
          this.parentActiveChild.set(parentOfSelected, selectedProtoId);
          this._updateSlotVisual(parentOfSelected, selectedProtoId);
        }
        isChecked = true;
      } else if (!parentOfSelected && slotId === selectedProtoId) {
        // Direct parent or standalone item selected
        if (isCategoryParent(slotId) && this.parentActiveChild.has(slotId)) {
          this.parentActiveChild.delete(slotId);
          this._updateSlotVisual(slotId, slotId);
        }
        isChecked = true;
      }

      slotInfo.el.classList.toggle("checked", isChecked);
    }
  }

  // The phone tier hides `.tw-msgcell` — and with it the tool tooltip — while
  // native title= never fires on touch at all, so the armed tool and its price
  // have nowhere else to appear. The drawer header carries them instead, and
  // stays visible when the drawer is collapsed.
  _updateHeaderLabel() {
    if (!this.titleEl) return;
    let label = toolLabel(this.game);
    // Surface the long-press-armed lobby height here too; it is otherwise only
    // discoverable from a title= tooltip that touch never shows.
    if (label && this.game.toolPrototype?.id === "lobby" && (this.game.lobbyHeight || 1) > 1) {
      label += ` ×${this.game.lobbyHeight} floors`;
    }
    this.titleEl.textContent = label || "TOOLS";
    this.titleEl.classList.toggle("tb-title-tool", Boolean(label));
  }

  // Highlight the active speed mode (game.ui.updateSpeed).
  updateSpeed() {
    const sm = this.game.speedMode;
    this.speedBtns.forEach((b, i) => b.classList.toggle("checked", i === sm));
    if (this.pauseBtn) {
      // Label the *action*, not the state: play to resume, pause to pause.
      this.pauseBtn.textContent = sm === 0 ? "▶" : "‖";
      this.pauseBtn.title = sm === 0 ? "Resume" : "Pause";
    }
  }

  // ToolboxWindow::onSpeedButtonPress — pause toggles back to lastSpeedMode.
  _onSpeedPress(mode) {
    if (mode === 0) this.game.togglePause();
    else this.game.setSpeedMode(mode);
  }
}
