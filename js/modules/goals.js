import { state } from '../state.js';
import { saveData } from '../storage.js';
import { formatBRL, escapeHtml, showToast } from '../utils.js';
import { checkAchievements } from '../events.js';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
let currentGoalId = null;
let currentDebtId = null;

export function initGoalsEvents() {
  const goalModal = document.getElementById('goal-modal');
  const debtPaymentModal = document.getElementById('debt-payment-modal');

  // Metas
  document.getElementById('goal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('goal-name').value.trim(); const target = parseFloat(document.getElementById('goal-target').value);
    if (!name || !target || target <= 0) return;
    state.goals.push({ id: uid(), name, target, current: 0 }); await saveData('capitalizze.goals', state.goals);
    renderGoals(); document.getElementById('goal-form').reset(); showToast('Meta criada!');
  });

  document.getElementById('goals-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    const id = btn.dataset.id; const goal = state.goals.find(g => g.id === id); if (!goal) return;
    if (btn.dataset.action === 'del-goal') {
      state.goals = state.goals.filter(g => g.id !== id); await saveData('capitalizze.goals', state.goals);
      checkAchievements(); renderGoals(); showToast('Meta excluída.', 'danger');
    } else if (btn.dataset.action === 'add-goal') {
      currentGoalId = id; document.getElementById('modal-goal-title').textContent = `Guardar em: ${goal.name}`;
      document.getElementById('modal-goal-amount').value = ''; goalModal.classList.add('active');
      setTimeout(() => document.getElementById('modal-goal-amount').focus(), 100);
    }
  });

  document.getElementById('modal-cancel').addEventListener('click', () => { goalModal.classList.remove('active'); currentGoalId = null; });
  goalModal.addEventListener('click', (e) => { if (e.target === goalModal) { goalModal.classList.remove('active'); currentGoalId = null; } });
  document.getElementById('modal-confirm').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('modal-goal-amount').value.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) { showToast('Valor inválido.', 'danger'); return; }
    const goal = state.goals.find(g => g.id === currentGoalId);
    if (goal) { goal.current += amount; await saveData('capitalizze.goals', state.goals); checkAchievements(); renderGoals(); showToast('Valor guardado!'); }
    goalModal.classList.remove('active'); currentGoalId = null;
  });

  // Orçamentos
  document.getElementById('budget-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cat = document.getElementById('budget-category').value; const amount = parseFloat(document.getElementById('budget-amount').value);
    if (!amount || amount <= 0) return;
    state.budgets[cat] = amount; await saveData('capitalizze.budgets', state.budgets);
    checkAchievements(); renderBudgets(); document.getElementById('budget-form').reset(); showToast(`Orçamento de ${cat} definido!`);
  });

  document.getElementById('budgets-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="del-budget"]'); if (!btn) return;
    delete state.budgets[btn.dataset.cat]; await saveData('capitalizze.budgets', state.budgets);
    renderBudgets(); showToast('Orçamento removido.', 'danger');
  });

  // Dívidas
  document.getElementById('debt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const desc = document.getElementById('debt-desc').value.trim();
    const amount = parseFloat(document.getElementById('debt-amount').value);
    const type = document.getElementById('debt-type').value;
    const person = document.getElementById('debt-person').value.trim();
    if (!desc || !amount || amount <= 0) return;
    state.debts.push({ id: uid(), desc, total: amount, remaining: amount, type, person });
    await saveData('capitalizze.debts', state.debts);
    checkAchievements();
    renderDebts(); document.getElementById('debt-form').reset(); showToast('Dívida cadastrada!');
  });

  document.getElementById('debts-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    const id = btn.dataset.id; const action = btn.dataset.action;
    if (action === 'del-debt') {
      state.debts = state.debts.filter(d => d.id !== id);
      await saveData('capitalizze.debts', state.debts); checkAchievements(); renderDebts(); showToast('Dívida removida.', 'danger');
    } else if (action === 'settle-debt') {
      const debt = state.debts.find(d => d.id === id); if (!debt) return;
      currentDebtId = id;
      document.getElementById('modal-debt-title').textContent = `Abater: ${debt.desc}`;
      document.getElementById('modal-debt-amount').value = '';
      debtPaymentModal.classList.add('active');
      setTimeout(() => document.getElementById('modal-debt-amount').focus(), 100);
    }
  });

  document.getElementById('cancel-debt-payment').addEventListener('click', () => { debtPaymentModal.classList.remove('active'); currentDebtId = null; });
  debtPaymentModal.addEventListener('click', (e) => { if (e.target === debtPaymentModal) { debtPaymentModal.classList.remove('active'); currentDebtId = null; } });
  
  document.getElementById('confirm-debt-payment').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('modal-debt-amount').value.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) { showToast('Valor inválido.', 'danger'); return; }
    const debt = state.debts.find(d => d.id === currentDebtId); if (!debt) return;
    debt.remaining = Math.max(0, debt.remaining - amount);
    const txType = debt.type === 'owe' ? 'expense' : 'income';
    state.transactions.push({ id: uid(), desc: `Abatimento: ${debt.desc}`, amount: amount, type: txType, category: 'Dívidas', bank: state.banks.length > 0 ? state.banks[0] : 'Geral', createdAt: Date.now() });
    await saveData('capitalizze.debts', state.debts); await saveData('capitalizze.transactions', state.transactions);
    checkAchievements();
    renderDebts(); renderSummary(); updateMonthFilter(); renderTransactions();
    debtPaymentModal.classList.remove('active'); currentDebtId = null;
    showToast(`Dívida abatida e ${formatBRL(amount)} adicionado às transações!`);
  });
}

export function renderGoals() {
  const goalsList = document.getElementById('goals-list');
  if (state.goals.length === 0) { goalsList.innerHTML = '<div class="empty">Você ainda não tem metas.</div>'; return; }
  goalsList.innerHTML = state.goals.map(g => {
    const percent = Math.min((g.current / g.target) * 100, 100);
    return `<div class="goal-item"><div class="goal-header"><div class="goal-title">${escapeHtml(g.name)}</div><div class="goal-values">${formatBRL(g.current)} de ${formatBRL(g.target)}</div></div><div class="progress-wrapper"><div class="progress-bar safe" style="width: ${percent}%"></div></div><div class="goal-actions"><button class="btn btn-sm" data-action="add-goal" data-id="${g.id}">+ Guardar</button><button class="btn btn-sm danger" data-action="del-goal" data-id="${g.id}">Excluir</button></div></div>`;
  }).join('');
}

export function renderBudgets() {
  const budgetsList = document.getElementById('budgets-list');
  const now = new Date();
  const currentMonthStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const currentExpenses = state.transactions.filter(t => t.type === 'expense' && `${String(new Date(t.createdAt).getMonth() + 1).padStart(2, '0')}/${new Date(t.createdAt).getFullYear()}` === currentMonthStr);
  
  const budgetEntries = Object.entries(state.budgets);
  if (budgetEntries.length === 0) { budgetsList.innerHTML = '<div class="empty">Nenhum orçamento definido.</div>'; return; }
  
  budgetsList.innerHTML = budgetEntries.map(([cat, limit]) => {
    const spent = currentExpenses.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0);
    const percent = Math.min((spent / limit) * 100, 100);
    let barClass = 'safe'; if (percent >= 100) barClass = 'danger'; else if (percent >= 80) barClass = 'warning';
    return `<div class="budget-item"><div class="budget-header"><div class="budget-title">${cat}</div><div class="budget-values" style="color: ${percent >= 100 ? 'var(--danger)' : 'var(--muted)'}">${formatBRL(spent)} de ${formatBRL(limit)}</div></div><div class="progress-wrapper"><div class="progress-bar ${barClass}" style="width: ${percent}%"></div></div><div class="goal-actions"><button class="btn btn-sm danger" data-action="del-budget" data-cat="${cat}">Remover</button></div></div>`;
  }).join('');
}

export function renderDebts() {
  const debtsList = document.getElementById('debts-list');
  if (state.debts.length === 0) { debtsList.innerHTML = '<div class="empty">Nenhuma dívida cadastrada.</div>'; return; }
  debtsList.innerHTML = state.debts.map(d => {
    const isOwe = d.type === 'owe';
    const color = isOwe ? 'var(--danger)' : 'var(--success)';
    const label = isOwe ? 'Abater (Pagar)' : 'Abater (Receber)';
    const btnClass = isOwe ? 'pay' : 'receive';
    const personText = d.person ? `• ${d.person}` : '';
    const paid = d.total - d.remaining;
    const percent = Math.min((paid / d.total) * 100, 100);
    const isSettled = d.remaining <= 0.01;
    
    return `
      <div class="debt-item" style="flex-direction: column; align-items: stretch;">
        <div class="goal-header" style="margin-bottom: 12px;">
          <div><div class="goal-title">${escapeHtml(d.desc)}</div><div class="tx-meta">${isOwe ? 'Eu devo' : 'Me devem'} ${personText}</div></div>
          <div class="tx-amount" style="color: ${color};">Falta: ${formatBRL(d.remaining > 0 ? d.remaining : 0)}</div>
        </div>
        <div class="progress-wrapper" style="margin-bottom: 16px;"><div class="progress-bar ${isSettled ? 'safe' : (isOwe ? 'danger' : 'safe')}" style="width: ${percent}%"></div></div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div class="tx-meta">Pago: ${formatBRL(paid)} de ${formatBRL(d.total)}</div>
          <div class="goal-actions">
            ${!isSettled ? `<button class="btn-settle ${btnClass}" data-action="settle-debt" data-id="${d.id}">${label}</button>` : `<span style="color: var(--success); font-weight: bold; margin-right: 12px;">✓ Quitada</span>`}
            <button class="tx-del" data-action="del-debt" data-id="${d.id}" title="Excluir">✕</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

import { renderSummary, updateMonthFilter, renderTransactions } from './transactions.js';