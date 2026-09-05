// UI assembly (UI agent) — builds all windows into #ui, assigns the real
// game.ui hook implementations (see the noopUI list at the top of game.js)
// and exposes per-frame advance() plus the Esc close-top-dialog chain
// (levelup → inspector → elevator → finance → map per Game.cpp:224-230).

import { Toolbox } from "./toolbox.js";
import { TimeWindow } from "./timewindow.js";
import { MenuBar } from "./menubar.js";
import {
  InspectorDialog, ElevatorDialog, MapWindow, FinanceWindow, LevelUpDialog, VictoryDialog, VipReviewDialog, FindDialog, SaveDialog, OptionsDialog,
  MessageLogDialog,
} from "./dialogs.js";
import { wireInput } from "./input.js";
import { ZoomControls } from "./zoomcontrols.js";

export function createUI(game, { container, renderer, sound, bitmaps } = {}) {
  const root = container || document.getElementById("ui");

  // ---- windows -------------------------------------------------------------

  const mapWindow = new MapWindow(game, root, { bitmaps });
  const financeWindow = new FinanceWindow(game, root);
  const elevatorDialog = new ElevatorDialog(game, root);
  const inspector = new InspectorDialog(game, root, {
    onOpenElevator: (e) => elevatorDialog.showForItem(e),
  });
  const levelUp = new LevelUpDialog(game, root);
  const victoryDialog = new VictoryDialog(game, root);
  const vipReviewDialog = new VipReviewDialog(game, root);
  const findDialog = new FindDialog(game, root, {
    onSelectPerson: (p) => inspector.showForPerson(p),
    onSelectItem: (item) => inspector.showForItem(item),
  });
  const saveDialog = new SaveDialog(game, root);
  const optionsDialog = new OptionsDialog(game, root, { sound });
  const timeWindow = new TimeWindow(game, root, {
    onToggleMute: () => sound?.toggleMuted() ?? false,
  });
  const messageLog = new MessageLogDialog(game, root, timeWindow.messages);
  timeWindow.onOpenLog = () => messageLog.toggle();
  const toolbox = new Toolbox(game, root, { bitmaps });
  const zoomControls = new ZoomControls(game, root);

  const menuBar = new MenuBar(game, root, {
    onNewGame: () => game.ui.newGameRequested?.(),
    onLoadGame: () => game.ui.loadRequested?.(),
    onSaveGame: () => game.ui.saveRequested?.(),
    onSaveAsGame: () => saveDialog.show(),
    onExportScreenshot: () => game.ui.exportScreenshot?.(),
    onExportReport: () => game.ui.exportReport?.(),
    onToggleFinance: () => financeWindow.toggle(),
    onToggleMap: () => mapWindow.toggle(),
    onToggleFind: (tab) => findDialog.toggle(tab),
    onToggleOptions: () => optionsDialog.toggle(),
    onCycleStatus: () => {
      game.cycleStatusMode();
      mapWindow.renderMap(true);
    },
    onSelectStatus: (mode) => {
      game.statusMode = mode;
      mapWindow.renderMap(true);
    },
  });

  // ---- input ---------------------------------------------------------------

  const closeTopDialog = () => {
    menuBar?.closeAll?.();
    if (victoryDialog.visible) { victoryDialog.close(); return true; }
    if (vipReviewDialog.visible) { vipReviewDialog.close(); return true; }
    if (messageLog.visible) { messageLog.close(); return true; }
    if (findDialog.visible) { findDialog.close(); return true; }
    if (saveDialog.visible) { saveDialog.close(); return true; }
    if (optionsDialog.visible) { optionsDialog.close(); return true; }
    if (levelUp.visible) { levelUp.close(); return true; }
    if (inspector.visible) { inspector.close(); return true; }
    if (elevatorDialog.visible) { elevatorDialog.close(); return true; }
    if (financeWindow.visible) { financeWindow.setVisible(false); return true; }
    if (mapWindow.visible) { mapWindow.setVisible(false); return true; }
    return false;
  };

  // ---- game.ui hooks ---------------------------------------------------------

  game.ui = {
    showMessage: (m) => {
      timeWindow.showMessage(m);
      // Keep an open log live rather than making the player reopen it.
      if (messageLog.visible) messageLog.refresh();
    },
    showMessageLog: () => messageLog.show(),
    updateFunds: () => timeWindow.updateFunds(),
    updateMoneyStats: () => timeWindow.updateMoneyStats(),
    updateRating: () => timeWindow.updateRating(),
    updatePopulation: () => timeWindow.updatePopulation(),
    updateTime: () => timeWindow.updateTime(),
    updateTooltip: () => timeWindow.updateTooltip(),
    updateTool: () => toolbox.updateTool(),
    updateSpeed: () => {
      toolbox.updateSpeed();
      timeWindow.updateSpeed();
    },
    reloadToolbox: () => toolbox.reload(),
    refreshInspector: () => inspector.refresh(),
    refreshElevatorDialog: () => elevatorDialog.refresh(),
    showLevelUp: (rating) => levelUp.show(rating),
    showVictoryDialog: (stats) => victoryDialog.show(stats),
    showVipReview: (review) => vipReviewDialog.show(review),
    showFindDialog: (tab) => findDialog.show(tab),
    openSaveDialog: () => saveDialog.toggle(),
    openOptionsDialog: () => optionsDialog.toggle(),
    showInspectorForItem: (item) => inspector.showForItem(item),
    showInspectorForPerson: (person) => inspector.showForPerson(person),
    showElevatorDialogForItem: (e) => elevatorDialog.showForItem(e),
    renderMap: () => mapWindow.renderMap(true),
    refreshFinance: () => financeWindow.refresh(),
    closeDialogs: () => {
      inspector.close();
      elevatorDialog.close();
      levelUp.close();
      victoryDialog.close();
      vipReviewDialog.close();
      findDialog.close();
      saveDialog.close();
      optionsDialog.close();
    },
  };

  const input = renderer
    ? wireInput(game, renderer, {
        onToggleMap: () => mapWindow.toggle(),
        onToggleFinance: () => financeWindow.toggle(),
        onToggleFind: (tab) => findDialog.toggle(tab),
        onToggleSave: () => saveDialog.toggle(),
        onToggleOptions: () => optionsDialog.toggle(),
        closeTopDialog,
        onSave: () => game.ui.saveRequested?.(),
      })
    : null;

  return {
    menuBar,
    toolbox,
    zoomControls,
    timeWindow,
    inspector,
    elevatorDialog,
    mapWindow,
    financeWindow,
    levelUp,
    input,
    saveDialog,
    optionsDialog,
    closeTopDialog,
    // Called once per RAF tick from main.js.
    advance(dt) {
      timeWindow.advance(dt);
      mapWindow.advance();
      menuBar.setDirty(game.isDirty);
    },
    onResize() {
      mapWindow.renderMap(true);
    },
  };
}
