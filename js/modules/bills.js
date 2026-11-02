import { state } from '../state.js';
import { saveData } from '../storage.js';
import { formatBRL, escapeHtml, showToast } from '../utils.js';
import { renderSummary, updateMonthFilter, renderTransactions } from './transactions.js';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function initBillsEvents() {
  document.getElementById('rec-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const desc = document.getElementById('rec-desc').value.trim();
    const amount = parseFloat(document.getElementById('rec-amount').value);
    const type = document.getElementById('rec-type').value;
    const category = document.getElementById('rec-category').value;
    const day = parseInt(document.getElementById('rec-day').value);
    if (!desc || !amount || amount <= 0 || !day) return;
    state.recurring.push({ id: uid(), desc, amount, type, category, day, lastProcessed: "" });
    await saveData('capitalizze.recurring', state.recurring);
    renderRecurring(); document.getElementById('rec-form').reset(); showToast('Lançamento fixo cadastrado!');
  });

  document.getElementById('recurring-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="del-rec"]'); if (!btn) return;
    state.recurring = state.recurring.filter(r => r.id !== btn.dataset.id);
    await saveData('capitalizze.recurring', state.recurring);
    renderRecurring(); showToast('Lançamento fixo removido.', 'danger');
  });

  document.getElementById('bill-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const desc = document.getElementById('bill-desc').value.trim();
    const amount = parseFloat(document.getElementById('bill-amount').value);
    const type = document.getElementById('bill-type').value;
    const dueDay = parseInt(document.getElementById('bill-day').value);
    if (!desc || !amount || amount <= 0 || !dueDay) return;
    state.bills.push({ id: uid(), desc, amount, type, dueDay });
    await saveData('capitalizze.bills', state.bills);
    renderBills(); document.getElementById('bill-form').reset(); showToast('Conta cadastrada!');
  });

  document.getElementById('bills-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    const id = btn.dataset.id; const action = btn.dataset.action;
    if (action === 'del-bill') {
      state.bills = state.bills.filter(b => b.id !== id);
      await saveData('capitalizze.bills', state.bills); renderBills(); showToast('Conta removida.', 'danger');
    } else if (action === 'settle-bill') {
      const bill = state.bills.find(b => b.id === id); if (!bill) return;
      const txType = bill.type === 'pay' ? 'expense' : 'income';
      state.transactions.push({ id: uid(), desc: bill.desc, amount: bill.amount, type: txType, category: 'Geral', bank: state.banks.length > 0 ? state.banks[0] : 'Geral', createdAt: Date.now() });
      state.bills = state.bills.filter(b => b.id !== id);
      await saveData('capitalizze.transactions', state.transactions); await saveData('capitalizze.bills', state.bills);
      renderSummary(); updateMonthFilter(); renderTransactions(); renderBills();
      document.getElementById('bills-badge').style.display = 'none';
      showToast(`Conta ${bill.type === 'pay' ? 'paga' : 'recebida'} com sucesso!`);
    }
  });
}

export function renderBills() {
  const billsList = document.getElementById('bills-list');
  if (state.bills.length === 0) { billsList.innerHTML = '<div class="empty">Nenhuma conta cadastrada.</div>'; return; }
  const sortedBills = [...state.bills].sort((a, b) => a.dueDay - b.dueDay);
  billsList.innerHTML = sortedBills.map(b => {
    const isPay = b.type === 'pay';
    const color = isPay ? 'var(--danger)' : 'var(--success)';
    const label = isPay ? 'Pagar' : 'Receber';
    const btnClass = isPay ? 'pay' : 'receive';
    const sign = isPay ? '-' : '+';
    return `<div class="tx"><div class="tx-info"><div class="tx-desc">${escapeHtml(b.desc)}</div><div class="tx-meta">Vence dia ${b.dueDay}</div></div><div class="tx-amount" style="color: ${color}">${sign} ${formatBRL(b.amount)}</div><button class="btn-settle ${btnClass}" data-action="settle-bill" data-id="${b.id}">${label}</button><button class="tx-del" data-action="del-bill" data-id="${b.id}" title="Excluir">✕</button></div>`;
  }).join('');
}

export function renderRecurring() {
  const list = document.getElementById('recurring-list');
  if (state.recurring.length === 0) { list.innerHTML = '<div class="empty">Nenhum lançamento fixo cadastrado.</div>'; return; }
  const sorted = [...state.recurring].sort((a, b) => a.day - b.day);
  list.innerHTML = sorted.map(r => {
    const isInc = r.type === 'income';
    const color = isInc ? 'var(--success)' : 'var(--danger)';
    const sign = isInc ? '+' : '-';
    return `<div class="tx"><div class="tx-info"><div class="tx-desc">${escapeHtml(r.desc)}</div><div class="tx-meta">Todo dia ${r.day} • ${r.category}</div></div><div class="tx-amount" style="color: ${color}">${sign} ${formatBRL(r.amount)}</div><button class="tx-del" data-action="del-rec" data-id="${r.id}" title="Excluir">✕</button></div>`;
  }).join('');
}