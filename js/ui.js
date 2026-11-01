import { state, AVAILABLE_BANKS, ACHIEVEMENTS_LIST } from './state.js';

export function formatBRL(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
export function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

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
  renderAchievements(); // NOVO
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

export function renderCategories() {
  const catSelect = document.getElementById('category');
  const budSelect = document.getElementById('budget-category');
  const recSelect = document.getElementById('rec-category');
  const catList = document.getElementById('categories-list');

  const options = state.categories.map(c => `<option value="${c}">${c}</option>`).join('');

  const currentCat = catSelect.value;
  catSelect.innerHTML = options;
  if (state.categories.includes(currentCat)) catSelect.value = currentCat;
  
  budSelect.innerHTML = options;
  recSelect.innerHTML = options;

  catList.innerHTML = state.categories.map(c => `
    <div class="tx">
      <div class="tx-desc">${escapeHtml(c)}</div>
      <button class="tx-del" data-action="del-cat" data-cat="${c}" title="Excluir">✕</button>
    </div>
  `).join('');
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
    listEl.innerHTML = '<div class="empty">Nenhuma transação encontrada com esses filtros.</div>'; 
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

export function renderProfile() {
  document.getElementById('profile-display-name').textContent = state.profile.name;
  document.getElementById('profile-display-email').textContent = state.profile.email;
  document.getElementById('profile-display-date').textContent = `Membro desde: ${new Date(state.profile.joined).toLocaleDateString('pt-BR')}`;
  
  document.getElementById('prof-name').value = state.profile.name;
  document.getElementById('prof-email').value = state.profile.email;

  const img = document.getElementById('profile-avatar-img');
  const placeholder = document.getElementById('profile-avatar-placeholder');
  
  if (state.profile.avatar) {
    img.src = state.profile.avatar; img.style.display = 'block'; placeholder.style.display = 'none';
  } else {
    img.style.display = 'none'; placeholder.style.display = 'block';
  }
}

export function renderBanksSettings() {
  const banksCheckboxes = document.getElementById('banks-checkboxes');
  banksCheckboxes.innerHTML = AVAILABLE_BANKS.map(bank => `
    <label class="bank-checkbox">
      <input type="checkbox" value="${bank}" ${state.banks.includes(bank) ? 'checked' : ''}>
      ${bank}
    </label>
  `).join('');
}

export function updateBankSelects() {
  const txBankSelect = document.getElementById('tx-bank');
  if (state.banks.length > 0) {
    txBankSelect.style.display = 'block';
    txBankSelect.innerHTML = `<option value="Geral">Selecione o Banco...</option>` + state.banks.map(b => `<option value="${b}">${b}</option>`).join('');
  } else {
    txBankSelect.style.display = 'none';
    txBankSelect.innerHTML = `<option value="Geral">Geral (Sem banco)</option>`;
  }
}