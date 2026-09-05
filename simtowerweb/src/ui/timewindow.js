// Time window (UI agent) — port of TimeWindow.cpp as a DOM top bar.
//
// Left→right: analog watch (canvas, colors from renderWatch) + digital clock
// (HH:MM from Time.getHour(); the nonlinear day mapping is already in the hour
// value), star rating, date "D{day} Q{q} Y{y}" (day 2 = weekend → "Hol"),
// tooltip line (selected tool + speed), transient message line (queued, fades
// after ~4 s), FUND/POP/money-stats metrics, speed buttons, status-mode chip
// and a sound mute toggle.

import {
  MessageQueue, formatClock, formatDate, formatCommaMoney,
  formatSignedCompactMoney, toolTooltip,
} from "./format.js";
import { makeDraggable } from "./draggable.js";

const STATUS_NAMES = ["Normal", "Eval", "Pricing", "Hotel"];

export class TimeWindow {
  constructor(game, container, { onToggleMute } = {}) {
    this.game = game;
    this.messages = new MessageQueue();
    this.displayedSpeedMode = -1;
    this.displayedStatusMode = -1;
    this._clockText = "";
    this._dateText = null;

    this.el = document.createElement("div");
    this.el.id = "timewindow";
    this.el.className = "oswin";

    // watch + digital clock
    const watchCell = this._cell("tw-watchwrap");
    this.watchCanvas = document.createElement("canvas");
    this.watchCanvas.width = 34;
    this.watchCanvas.height = 34;
    watchCell.appendChild(this.watchCanvas);
    this.clock = document.createElement("div");
    this.clock.className = "tw-clock";
    watchCell.appendChild(this.clock);
    this.el.appendChild(watchCell);

    // rating stars
    const starCell = this._cell();
    this._label(starCell, "Rating");
    this.stars = document.createElement("div");
    this.stars.className = "tw-stars";
    starCell.appendChild(this.stars);
    this.el.appendChild(starCell);

    // date
    const dateCell = this._cell();
    this._label(dateCell, "Date");
    this.date = document.createElement("div");
    this.date.className = "tw-date";
    dateCell.appendChild(this.date);
    this.dirtyFlag = document.createElement("span");
    this.dirtyFlag.className = "tw-dirty";
    this.dirtyFlag.textContent = "*";
    this.dirtyFlag.title = "Unsaved changes";
    this.dirtyFlag.style.display = "none";
    dateCell.appendChild(this.dirtyFlag);
    this.el.appendChild(dateCell);

    // tooltip + message
    const msgCell = this._cell("tw-msgcell");
    this._label(msgCell, "Tool / Messages");
    this.tooltip = document.createElement("div");
    this.tooltip.className = "tw-tooltip";
    msgCell.appendChild(this.tooltip);
    this.message = document.createElement("div");
    this.message.className = "tw-message";
    this.message.style.opacity = "0";
    msgCell.appendChild(this.message);
    // Messages fade after 4 s, so anything that arrives while the player is
    // looking at the tower is lost. The cell is the obvious place to reach for
    // them, so make it the handle for the scrollback.
    msgCell.classList.add("tw-msgcell-clickable");
    msgCell.title = "Open the message log";
    msgCell.addEventListener("click", () => {
      if (this.onOpenLog) this.onOpenLog();
    });
    this.el.appendChild(msgCell);

    // FUND / POP / money stats
    const fundCell = this._cell();
    this._label(fundCell, "Fund");
    this.funds = document.createElement("div");
    this.funds.className = "tw-value";
    fundCell.appendChild(this.funds);
    this.moneyStats = document.createElement("div");
    this.moneyStats.className = "tw-stats";
    fundCell.appendChild(this.moneyStats);
    this.el.appendChild(fundCell);

    const popCell = this._cell();
    this._label(popCell, "Pop");
    this.population = document.createElement("div");
    this.population.className = "tw-value";
    popCell.appendChild(this.population);
    this.el.appendChild(popCell);

    // speed buttons
    const speedCell = this._cell("tw-speedrow");
    this._label(speedCell, "Speed");
    const row = document.createElement("div");
    row.className = "tw-speedrow";
    this.speedBtns = ["\u2016", "\u25b6", "\u25b6\u25b6", "\u25b6\u25b6\u25b6"].map((glyph, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "osbtn";
      b.textContent = glyph;
      b.title = ["Pause (0)", "Speed 1x (1)", "Speed 2x (2)", "Speed 4x (3)"][i];
      b.addEventListener("click", () => {
        // Shared pause-toggle memory lives on the game (see Game.togglePause),
        // so this row and the toolbox's cannot disagree about the resume speed.
        if (i === 0) this.game.togglePause();
        else this.game.setSpeedMode(i);
      });
      row.appendChild(b);
      return b;
    });
    speedCell.appendChild(row);
    this.el.appendChild(speedCell);

    // status mode indicator + mute
    const statusCell = this._cell();
    this._label(statusCell, "View");
    this.status = document.createElement("span");
    this.status.className = "tw-status";
    this.status.title = "Status view (O cycles)";
    statusCell.appendChild(this.status);
    if (onToggleMute) {
      const mute = document.createElement("button");
      mute.type = "button";
      mute.className = "osbtn";
      mute.textContent = "\ud83d\udd07";
      mute.title = "Toggle sound";
      mute.addEventListener("click", () => {
        const muted = onToggleMute();
        mute.textContent = muted ? "\ud83d\udd07" : "\ud83d\udd0a";
      });
      statusCell.appendChild(mute);
    }
    this.el.appendChild(statusCell);

    // ISSUE-040 follow-up: `.tw-msgcell` is display:none on the phone tiers,
    // which hid the entire message system there — build rejections, bulldoze
    // refusals, save/load confirmations, the "Next: <requirement>" star hint,
    // promotions and every EventSystem alert. Mirror the *same* MessageQueue
    // into a toast so phones get identical text on identical timing; CSS picks
    // which of the two surfaces is visible. Appended to the UI root rather than
    // to #timewindow so the `.tw-msgcell` rule can never hide it too.
    this.toast = document.createElement("div");
    this.toast.id = "toast";
    this.toast.setAttribute("role", "status");
    this.toast.setAttribute("aria-live", "polite");
    this.toast.style.opacity = "0";
    container.appendChild(this.toast);

    container.appendChild(this.el);
    makeDraggable(this.el);

    this.updateRating();
    this.updateFunds();
    this.updatePopulation();
    this.updateMoneyStats();
    this.updateTime();
  }

  _cell(extra) {
    const c = document.createElement("div");
    c.className = "tw-cell" + (extra ? " " + extra : "");
    return c;
  }

  _label(cell, text) {
    const l = document.createElement("div");
    l.className = "tw-label";
    l.textContent = text;
    cell.appendChild(l);
  }

  // ---- game.ui hooks -------------------------------------------------------

  showMessage(msg) {
    const t = this.game.time;
    this.messages.show(msg, formatDate(t).text + " " + formatClock(t.getHour()));
    this._renderMessage();
  }

  updateFunds() {
    this.funds.textContent = formatCommaMoney(this.game.funds);
  }

  updateMoneyStats() {
    const m = this.game.money;
    // Money.recentNet(): trailing-7-day net (sum of income - expenses).
    let week = 0;
    for (const d of m.recentDays) week += d.income - d.expenses;
    this.moneyStats.textContent =
      "D " + formatSignedCompactMoney(m.todayIncome) + "/" +
      formatSignedCompactMoney(-m.todayExpenses) +
      " W " + formatSignedCompactMoney(week);
  }

  updateRating() {
    let s = "";
    for (let i = 0; i < 5; i++) s += i <= this.game.rating ? "\u2605" : "\u2606";
    this.stars.textContent = s;
  }

  updatePopulation() {
    this.population.textContent = String(this.game.population);
  }

  // Dirty-state indicator (asterisk next to the date, ISSUE-030).
  updateDirty() {
    if (this.dirtyFlag) {
      this.dirtyFlag.style.display = this.game.isDirty ? "" : "none";
    }
  }

  updateTime() {
    const t = this.game.time;
    const text = formatClock(t.getHour());
    if (text !== this._clockText) {
      this._clockText = text;
      this.clock.textContent = text;
    }
    const d = formatDate(t);
    if (d.text !== this._dateText) {
      this._dateText = d.text;
      this.date.textContent = d.text;
      this.date.classList.toggle("weekend", d.weekend);
    }
  }

  updateTooltip() {
    this.tooltip.textContent = toolTooltip(this.game);
  }

  updateSpeed() {
    const sm = this.game.speedMode;
    this.speedBtns.forEach((b, i) => b.classList.toggle("checked", i === sm));
    this.updateTooltip();
  }

  // ---- per-frame -----------------------------------------------------------

  advance(dt) {
    // tooltip depends on speed label — refresh on change (TimeWindow::advance)
    if (this.displayedSpeedMode !== this.game.speedMode) {
      this.displayedSpeedMode = this.game.speedMode;
      this.updateTooltip();
      this.updateSpeed();
    }
    if (this.displayedStatusMode !== this.game.statusMode) {
      this.displayedStatusMode = this.game.statusMode;
      this.status.textContent = STATUS_NAMES[this.game.statusMode] || "Normal";
    }
    this.updateDirty();
    this.updateTime();
    this.messages.advance(dt);
    this._renderMessage();
    this._renderWatch();
  }

  _renderMessage() {
    const msg = this.messages.current;
    if (msg) {
      if (this.message.textContent !== msg) this.message.textContent = msg;
      this.message.style.opacity = "1";
      if (this.toast) {
        if (this.toast.textContent !== msg) this.toast.textContent = msg;
        this.toast.style.opacity = "1";
      }
    } else {
      this.message.style.opacity = "0";
      if (this.toast) this.toast.style.opacity = "0";
    }
  }

  // Port of TimeWindow::renderWatch — hour hand 2π·h/12 at 0.6·r in
  // (230,240,248), minute hand 2π·h at r in (0,190,255).
  _renderWatch() {
    const ctx = this.watchCanvas.getContext("2d");
    if (!ctx) return;
    const w = this.watchCanvas.width;
    const h = this.watchCanvas.height;
    const mid = w / 2;
    const radiusM = h / 2;
    const radiusH = 0.6 * radiusM;
    const hour = this.game.time.getHour();
    const angleH = 2 * Math.PI * (hour / 12);
    const angleM = 2 * Math.PI * hour;

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(126, 209, 255, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mid, mid, radiusM - 0.5, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgb(230, 240, 248)";
    ctx.beginPath();
    ctx.moveTo(mid, mid);
    ctx.lineTo(mid + radiusH * Math.sin(angleH), mid + radiusH * -Math.cos(angleH));
    ctx.stroke();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgb(0, 190, 255)";
    ctx.beginPath();
    ctx.moveTo(mid, mid);
    ctx.lineTo(mid + radiusM * 0.95 * Math.sin(angleM), mid + radiusM * 0.95 * -Math.cos(angleM));
    ctx.stroke();
  }
}
