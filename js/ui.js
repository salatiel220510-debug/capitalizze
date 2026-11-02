import { state, ACHIEVEMENTS_LIST } from './state.js';
import { renderSummary, renderTransactions, updateMonthFilter, renderCharts } from './modules/transactions.js';
import { renderGoals, renderBudgets, renderDebts } from './modules/goals.js';
import { renderBills, renderRecurring } from './modules/bills.js';
import { renderProfile, renderCategories, renderBanksSettings, updateBankSelects } from './modules/settings.js';

export function renderAll() {
  renderCategories();
  renderSummary();
  renderTransactions();
  renderCharts();
  renderGoals();
  renderBudgets();
  renderBills();
  renderRecurring();
  renderDebts();
  renderAchievements();
  renderProfile();
  renderBanksSettings();
  updateBankSelects();
  updateMonthFilter();
}

export function renderAchievements() {
  const grid = document.getElementById('achievements-grid');
  grid.innerHTML = ACHIEVEMENTS_LIST.map(ach => {
    const isUnlocked = state.achievements.includes(ach.id);
    return `
      <div class="achievement ${isUnlocked ? 'unlocked' : ''}" title="${ach.desc}">
        <div class="achievement-icon">${ach.icon}</div>
        <div class="achievement-title">${ach.title}</div>
        <div class="achievement-desc">${ach.desc}</div>
      </div>
    `;
  }).join('');
}