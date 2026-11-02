import { state } from '../state.js';
import { saveData } from '../storage.js';
import { formatBRL, escapeHtml, showToast } from '../utils.js';
import { checkAchievements } from '../events.js';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function initTransactionsEvents() {
  const typeSelect = document.getElementById('type');
  const submitBtn = document.getElementById('submit-btn');
  
  typeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'expense') { submitBtn.textContent = 'Adicionar Despesa'; submitBtn.classList.add('danger'); }
    else { submitBtn.textContent = 'Adicionar Entrada'; submitBtn.classList.remove('danger'); }
  });

  document.getElementById('tx-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const desc = document.getElementById('desc').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);
    const txBankSelect = document.getElementById('tx-bank');
    
    if (!desc || !amount || amount <= 0) return;
    
    let bank = 'Geral';
    if (txBankSelect.style.display !== 'none') {
      bank = txBankSelect.value;
      if (bank === 'Geral') { showToast('Selecione um banco.', 'danger'); return; }
    }

    state.transactions.push({ 
      id: uid(), desc, amount, type: typeSelect.value, 
      category: document.getElementById('category').value, 
      bank, createdAt: Date.now() 
    });
    
    await saveData('capitalizze.transactions', state.transactions);
    checkAchievements();
    renderSummary(); updateMonthFilter();
    document.getElementById('tx-form').reset(); 
    submitBtn.textContent = 'Adicionar Entrada'; submitBtn.classList.remove('danger');
    showToast('Transação adicionada!');
  });

  document.getElementById('tx-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('.tx-del'); if (!btn) return;
    const id = btn.dataset.id; 
    const removedTx = state.transactions.find(t => t.id === id); 
    const index = state.transactions.findIndex(t => t.id === id);
    if (index === -1) return;

    state.transactions.splice(index, 1); 
    await saveData('capitalizze.transactions', state.transactions);
    renderSummary(); updateMonthFilter(); renderTransactions();
    
    showToast('Transação excluída.', 'danger', 'Desfazer', async () => {
      state.transactions.splice(index, 0, removedTx); 
      await saveData('capitalizze.transactions', state.transactions);
      renderSummary(); updateMonthFilter(); renderTransactions();
      showToast('Exclusão desfeita.');
    });
  });

  document.getElementById('month-filter').addEventListener('change', renderTransactions);
  document.getElementById('filter-type').addEventListener('change', renderTransactions);
  document.getElementById('search-tx').addEventListener('input', renderTransactions);
}

export function renderSummary() {
  const inc = state.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const exp = state.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  
  document.getElementById('balance').textContent = formatBRL(inc - exp);
  document.getElementById('income').textContent = formatBRL(inc);
  document.getElementById('expense').textContent = formatBRL(exp);

  const bankSummaryContainer = document.getElementById('bank-summary-container');
  const bankCardsContainer = document.getElementById('bank-cards');

  if (state.banks.length > 0) {
    bankSummaryContainer.style.display = 'block';
    bankCardsContainer.innerHTML = state.banks.map(bank => {
      const bankTxs = state.transactions.filter(t => t.bank === bank);
      const bInc = bankTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const bExp = bankTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      return `
        <div class="card bank-card">
          <div class="card-label">${bank}</div>
          <div class="card-value" style="font-size: 1.4rem; margin-bottom: 8px;">Saldo: ${formatBRL(bInc - bExp)}</div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
            <span style="color: var(--success)">+ ${formatBRL(bInc)}</span>
            <span style="color: var(--danger)">- ${formatBRL(bExp)}</span>
          </div>
        </div>
      `;
    }).join('');
  } else {
    bankSummaryContainer.style.display = 'none';
  }
}

export function renderTransactions() {
  const listEl = document.getElementById('tx-list');
  const filterMonth = document.getElementById('month-filter').value;
  const filterType = document.getElementById('filter-type').value;
  const searchTerm = document.getElementById('search-tx').value.toLowerCase();
  
  const filtered = state.transactions.filter(t => {
    if (filterMonth !== 'all') {
      const d = new Date(t.createdAt);
      if (`${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` !== filterMonth) return false;
    }
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (searchTerm) {
      const matchDesc = t.desc.toLowerCase().includes(searchTerm);
      const matchCat = t.category.toLowerCase().includes(searchTerm);
      if (!matchDesc && !matchCat) return false;
    }
    return true;
  });

  if (filtered.length === 0) { 
    listEl.innerHTML = '<div class="empty">Nenhuma transação encontrada.</div>'; 
    return; 
  }

  const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);
  
  listEl.innerHTML = sorted.map(t => `
    <div class="tx">
      <div class="tx-info">
        <div class="tx-desc">${escapeHtml(t.desc)}</div>
        <div class="tx-meta">${t.category} ${t.bank ? `• ${t.bank}` : ''} • ${new Date(t.createdAt).toLocaleDateString('pt-BR')}</div>
      </div>
      <div class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '−'} ${formatBRL(t.amount)}</div>
      <button class="tx-del" data-id="${t.id}" title="Excluir">✕</button>
    </div>
  `).join('');
}

export function updateMonthFilter() {
  const monthFilter = document.getElementById('month-filter');
  const months = new Set();
  const currentValue = monthFilter.value;

  state.transactions.forEach(t => {
    const d = new Date(t.createdAt);
    months.add(`${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
  });

  const sorted = Array.from(months).sort((a, b) => {
    const [mA, yA] = a.split('/'); const [mB, yB] = b.split('/');
    return new Date(yB, mB - 1) - new Date(yA, mA - 1);
  });

  monthFilter.innerHTML = '<option value="all">Todos os meses</option>';
  sorted.forEach(m => { 
    const o = document.createElement('option'); 
    o.value = m; o.textContent = m; 
    monthFilter.appendChild(o); 
  });
  
  monthFilter.value = (currentValue && Array.from(monthFilter.options).some(o => o.value === currentValue)) ? currentValue : 'all';
}

export function renderCharts() {
  const chartBars = document.getElementById('chart-bars');
  const donutChart = document.getElementById('donut-chart');
  const expenses = state.transactions.filter(t => t.type === 'expense');
  
  if (expenses.length === 0) {
    chartBars.innerHTML = '<div class="empty">Adicione despesas para ver o gráfico.</div>';
    donutChart.innerHTML = '<div class="empty">Adicione despesas para ver o gráfico.</div>';
    return;
  }

  const byCategory = {};
  expenses.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });
  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const totalExpense = sortedCats.reduce((s, [_, v]) => s + v, 0);
  const maxVal = sortedCats[0][1];
  const CHART_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#64748b'];

  chartBars.innerHTML = sortedCats.map(([cat, val], i) => {
    const percent = (val / maxVal) * 100;
    return `<div class="chart-row"><div class="chart-label">${cat}</div><div class="chart-bar-wrapper"><div class="chart-bar" style="width: ${percent}%; background: ${CHART_COLORS[i % CHART_COLORS.length]}"></div></div><div class="chart-value">${formatBRL(val)}</div></div>`;
  }).join('');

  const radius = 50, circumference = 2 * Math.PI * radius; let offset = 0;
  const svgCircles = sortedCats.map(([cat, val], i) => {
    const percent = val / totalExpense; 
    const dashArray = `${percent * circumference} ${circumference}`; 
    const dashOffset = -offset * circumference; 
    offset += percent;
    return `<circle cx="60" cy="60" r="${radius}" stroke="${CHART_COLORS[i % CHART_COLORS.length]}" stroke-dasharray="${dashArray}" stroke-dashoffset="${dashOffset}" />`;
  }).join('');
  
  const legend = sortedCats.map(([cat, val], i) => `<div class="legend-item"><div class="legend-color" style="background: ${CHART_COLORS[i % CHART_COLORS.length]}"></div><span>${cat} (${((val/totalExpense)*100).toFixed(1)}%)</span></div>`).join('');
  
  donutChart.innerHTML = `<svg class="donut-svg" viewBox="0 0 120 120">${svgCircles}</svg><div class="donut-legend">${legend}</div>`;
}