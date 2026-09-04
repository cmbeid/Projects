// Port of OT::Money (source/Money.h). Plain int bookkeeping, no floats.
export const K_RECENT_DAY_LIMIT = 7;

export class Money {
  constructor() {
    this.clear(0);
  }

  clear(balance) {
    this.balance = balance;
    this.todayIncome = 0;
    this.todayExpenses = 0;
    this.yesterdayIncome = 0;
    this.yesterdayExpenses = 0;
    this.todayTotalsByCategory = new Map();
    this.yesterdayTotalsByCategory = new Map();
    this.recentDays = []; // {income, expenses, totalsByCategory}
    this.quarterStartBalance = balance;
    this.lastQuarterBalance = balance;
    this.quarterIncome = 0;
    this.quarterExpenses = 0;
    this.quarterTotalsByCategory = new Map();
  }

  setBalance(b) {
    this.balance = b;
  }

  record(amount, category) {
    this.balance += amount;
    this.todayTotalsByCategory.set(category, (this.todayTotalsByCategory.get(category) || 0) + amount);
    this.quarterTotalsByCategory.set(category, (this.quarterTotalsByCategory.get(category) || 0) + amount);
    if (amount >= 0) this.todayIncome += amount;
    else this.todayExpenses -= amount; // stored positive
    if (amount >= 0) this.quarterIncome += amount;
    else this.quarterExpenses -= amount;
  }

  finalizeDay() {
    this.yesterdayIncome = this.todayIncome;
    this.yesterdayExpenses = this.todayExpenses;
    this.yesterdayTotalsByCategory = this.todayTotalsByCategory;
    this.recentDays.push({
      income: this.todayIncome,
      expenses: this.todayExpenses,
      totalsByCategory: this.todayTotalsByCategory,
    });
    if (this.recentDays.length > K_RECENT_DAY_LIMIT) {
      this.recentDays.splice(0, this.recentDays.length - K_RECENT_DAY_LIMIT);
    }
    this.todayIncome = 0;
    this.todayExpenses = 0;
    this.todayTotalsByCategory = new Map();
  }

  finalizeQuarter() {
    this.lastQuarterBalance = this.balance;
    this.quarterStartBalance = this.balance;
    this.quarterIncome = 0;
    this.quarterExpenses = 0;
    this.quarterTotalsByCategory = new Map();
  }
}
