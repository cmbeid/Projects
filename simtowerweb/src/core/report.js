// Tower statistics/report aggregation (CORE agent) — pure, DOM-free summary of
// game state for the "Export Report" action (SaveDialog) and headless tests.
// Produces a JSON/CSV snapshot: funds, rating, population, item counts, and
// quarterly finance figures — from game.money, game.items, game.time and
// game.pricing. No renderer/UI dependency.

// Plain-object snapshot of everything a tycoon report needs.
export function buildTowerReport(game) {
  const itemCounts = {};
  const itemNames = {};
  for (const item of game.items) {
    const id = item.prototype.id;
    itemCounts[id] = (itemCounts[id] || 0) + 1;
    if (itemNames[id] === undefined) itemNames[id] = item.prototype.name;
  }

  const m = game.money;
  const quarterByCategory = {};
  for (const [cat, total] of m.quarterTotalsByCategory) quarterByCategory[cat] = total;

  return {
    savedAt: new Date().toISOString(),
    filename: game.saveFilename || "tower.tower",
    funds: game.funds,
    rating: game.rating,
    population: game.population,
    date: {
      year: game.time.year,
      quarter: game.time.quarter,
      day: game.time.day,
      hour: Math.floor(game.time.hour),
    },
    tower: {
      items: game.items.size,
      floors: game.floorItems.size,
    },
    itemCounts,
    itemNames,
    money: {
      balance: m.balance,
      todayIncome: m.todayIncome,
      todayExpenses: m.todayExpenses,
      yesterdayIncome: m.yesterdayIncome,
      yesterdayExpenses: m.yesterdayExpenses,
      quarterIncome: m.quarterIncome,
      quarterExpenses: m.quarterExpenses,
      lastQuarterBalance: m.lastQuarterBalance,
      quarterByCategory,
    },
    pricing: { ...game.pricing },
  };
}

export function reportJSON(game) {
  return JSON.stringify(buildTowerReport(game), null, 2);
}

function csvEscape(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Row-oriented CSV: a header-agnostic "field,value" list (simplest, robust for
// arbitrary category/item keys), plus item counts appended as item:<id> rows.
export function reportCSV(game) {
  const r = buildTowerReport(game);
  const rows = [
    ["field", "value"],
    ["filename", r.filename],
    ["savedAt", r.savedAt],
    ["funds", r.funds],
    ["rating", r.rating],
    ["population", r.population],
    ["year", r.date.year],
    ["quarter", r.date.quarter],
    ["day", r.date.day],
    ["items", r.tower.items],
    ["floors", r.tower.floors],
    ["quarterIncome", r.money.quarterIncome],
    ["quarterExpenses", r.money.quarterExpenses],
    ["balance", r.money.balance],
  ];
  for (const [id, count] of Object.entries(r.itemCounts)) {
    rows.push(["item:" + id, count]);
  }
  for (const [cat, total] of Object.entries(r.money.quarterByCategory)) {
    rows.push(["category:" + cat, total]);
  }
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}
