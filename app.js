const STORAGE_KEY = 'capitalizze.transactions';
const STORAGE_KEY_GOALS = 'capitalizze.goals';
const STORAGE_KEY_BUDGETS = 'capitalizze.budgets';
const STORAGE_KEY_THEME = 'capitalizze.theme';

// Elementos Transações
const form = document.getElementById('tx-form');
const listEl = document.getElementById('tx-list');
const balanceEl = document.getElementById('balance');
const incomeEl = document.getElementById('income');
const expenseEl = document.getElementById('expense');
const typeSelect = document.getElementById('type');
const submitBtn = document.getElementById('submit-btn');
const monthFilter = document.getElementById('month-filter');
const chartBars = document.getElementById('chart-bars');
const donutChart = document.getElementById('donut-chart');

// Elementos Metas
const goalForm = document.getElementById('goal-form');
const goalsList = document.getElementById('goals-list');
const goalModal = document.getElementById('goal-modal');
const modalGoalTitle = document.getElementById('modal-goal-title');
const modalGoalAmount = document.getElementById('modal-goal-amount');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');
let currentGoalId = null;

// Elementos Orçamentos
const budgetForm = document.getElementById('budget-form');
const budgetsList = document.getElementById('budgets-list');

// Elementos Simulador / Reserva / Backup / Tema
const simInitial = document.getElementById('sim-initial'), simMonthly = document.getElementById('sim-monthly'), simRate = document.getElementById('sim-rate'), simTime = document.getElementById('sim-time');
const resCost = document.getElementById('res-cost'), resMonths = document.getElementById('res-months');
const btnExport = document.getElementById('btn-export'), importFile = document.getElementById('import-file');
const themeToggle = document.getElementById('theme-toggle');
const toastContainer = document.getElementById('toast-container');

let transactions = load(STORAGE_KEY);
let goals = load(STORAGE_KEY_GOALS);
let budgets = load(STORAGE_KEY_BUDGETS) || {}; // Objeto: { "Alimentação": 500 }

function load(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }
function save(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function formatBRL(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

// --- LÓGICA DE TEMA (DARK/LIGHT) ---
function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
  if (savedTheme === 'light') document.body.classList.add('light-mode');
}
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light-mode');
  const isLight = document.body.classList.contains('light-mode');
  localStorage.setItem(STORAGE_KEY_THEME, isLight ? 'light' : 'dark');
});

// --- SISTEMA DE TOASTS (SUBSTITUINDO ALERTS) ---
function showToast(message, type = 'success', actionText = null, actionCallback = null) {
  const toast = document.createElement('div');
  toast.classList.add('toast', type);
  toast.innerHTML = `<span class="toast-msg">${message}</span>`;
  
  if (actionText && actionCallback) {
    const btn = document.createElement('button');
    btn.classList.add('toast-btn');
    btn.textContent = actionText;
    btn.onclick = () => {
      actionCallback();
      toast.style.animation = 'slideOutRight 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    };
    toast.appendChild(btn);
  }
  
  toastContainer.appendChild(toast);
  
  // Remove automaticamente após 4 segundos
  setTimeout(() => {
    if (document.body.contains(toast)) {
      toast.style.animation = 'slideOutRight 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// --- ABAS ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// --- INPUTS E FILTROS ---
typeSelect.addEventListener('change', (e) => {
  if (e.target.value === 'expense') { submitBtn.textContent = 'Adicionar Despesa'; submitBtn.classList.add('danger'); }
  else { submitBtn.textContent = 'Adicionar Entrada'; submitBtn.classList.remove('danger'); }
});

function updateMonthFilter() {
  const months = new Set();
  const currentValue = monthFilter.value;
  transactions.forEach(t => {
    const d = new Date(t.createdAt);
    months.add(`${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
  });
  const sorted = Array.from(months).sort((a, b) => {
    const [mA, yA] = a.split('/'); const [mB, yB] = b.split('/');
    return new Date(yB, mB - 1) - new Date(yA, mA - 1);
  });
  monthFilter.innerHTML = '<option value="all">Todos os meses</option>';
  sorted.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; monthFilter.appendChild(o); });
  monthFilter.value = (currentValue && Array.from(monthFilter.options).some(o => o.value === currentValue)) ? currentValue : 'all';
}
monthFilter.addEventListener('change', renderTransactions);

// --- RENDERIZAÇÃO GERAL ---
function render() { renderSummary(); renderTransactions(); renderCharts(); renderGoals(); renderBudgets(); }

function renderSummary() {
  const inc = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const exp = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  balanceEl.textContent = formatBRL(inc - exp); incomeEl.textContent = formatBRL(inc); expenseEl.textContent = formatBRL(exp);
}

function renderTransactions() {
  const filter = monthFilter.value;
  const filtered = transactions.filter(t => {
    if (filter === 'all') return true;
    const d = new Date(t.createdAt);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` === filter;
  });
  if (filtered.length === 0) { listEl.innerHTML = '<div class="empty">Nenhuma transação encontrada.</div>'; return; }
  const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);
  listEl.innerHTML = sorted.map(t => `
    <div class="tx">
      <div class="tx-info">
        <div class="tx-desc">${escapeHtml(t.desc)}</div>
        <div class="tx-meta">${t.category} • ${new Date(t.createdAt).toLocaleDateString('pt-BR')}</div>
      </div>
      <div class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '−'} ${formatBRL(t.amount)}</div>
      <button class="tx-del" data-id="${t.id}" title="Excluir">✕</button>
    </div>
  `).join('');
}

// --- GRÁFICOS (BARRAS E DONUT) ---
const CHART_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#64748b'];

function renderCharts() {
  const expenses = transactions.filter(t => t.type === 'expense');
  
  if (expenses.length === 0) {
    chartBars.innerHTML = '<div class="empty">Adicione despesas para ver o gráfico.</div>';
    donutChart.innerHTML = '<div class="empty">Adicione despesas para ver o gráfico.</div>';
    return;
  }

  // Agrupar por categoria
  const byCategory = {};
  expenses.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });
  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const totalExpense = sortedCats.reduce((s, [_, v]) => s + v, 0);
  const maxVal = sortedCats[0][1];

  // 1. Gráfico de Barras
  chartBars.innerHTML = sortedCats.map(([cat, val], i) => {
    const percent = (val / maxVal) * 100;
    return `<div class="chart-row"><div class="chart-label">${cat}</div><div class="chart-bar-wrapper"><div class="chart-bar" style="width: ${percent}%; background: ${CHART_COLORS[i % CHART_COLORS.length]}"></div></div><div class="chart-value">${formatBRL(val)}</div></div>`;
  }).join('');

  // 2. Gráfico Donut (SVG)
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  
  const svgCircles = sortedCats.map(([cat, val], i) => {
    const percent = val / totalExpense;
    const dashArray = `${percent * circumference} ${circumference}`;
    const dashOffset = -offset * circumference;
    offset += percent;
    return `<circle cx="60" cy="60" r="${radius}" stroke="${CHART_COLORS[i % CHART_COLORS.length]}" stroke-dasharray="${dashArray}" stroke-dashoffset="${dashOffset}" />`;
  }).join('');

  const legend = sortedCats.map(([cat, val], i) => `
    <div class="legend-item">
      <div class="legend-color" style="background: ${CHART_COLORS[i % CHART_COLORS.length]}"></div>
      <span>${cat} (${((val/totalExpense)*100).toFixed(1)}%)</span>
    </div>
  `).join('');

  donutChart.innerHTML = `
    <svg class="donut-svg" viewBox="0 0 120 120">${svgCircles}</svg>
    <div class="donut-legend">${legend}</div>
  `;
}

// --- METAS ---
function renderGoals() {
  if (goals.length === 0) { goalsList.innerHTML = '<div class="empty">Você ainda não tem metas. Crie uma acima!</div>'; return; }
  goalsList.innerHTML = goals.map(g => {
    const percent = Math.min((g.current / g.target) * 100, 100);
    return `
      <div class="goal-item">
        <div class="goal-header"><div class="goal-title">${escapeHtml(g.name)}</div><div class="goal-values">${formatBRL(g.current)} de ${formatBRL(g.target)}</div></div>
        <div class="progress-wrapper"><div class="progress-bar safe" style="width: ${percent}%"></div></div>
        <div class="goal-actions">
          <button class="btn btn-sm" data-action="add" data-id="${g.id}">+ Guardar</button>
          <button class="btn btn-sm danger" data-action="del" data-id="${g.id}">Excluir</button>
        </div>
      </div>`;
  }).join('');
}

// --- ORÇAMENTOS (LÓGICA DO MÊS ATUAL) ---
function renderBudgets() {
  const now = new Date();
  const currentMonthStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  
  // Pega os gastos do mês atual
  const currentExpenses = transactions.filter(t => {
    if (t.type !== 'expense') return false;
    const d = new Date(t.createdAt);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` === currentMonthStr;
  });

  const budgetEntries = Object.entries(budgets);
  
  if (budgetEntries.length === 0) {
    budgetsList.innerHTML = '<div class="empty">Nenhum orçamento definido para este mês.</div>';
    return;
  }

  budgetsList.innerHTML = budgetEntries.map(([cat, limit]) => {
    const spent = currentExpenses.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0);
    const percent = Math.min((spent / limit) * 100, 100);
    
    let barClass = 'safe';
    if (percent >= 100) barClass = 'danger';
    else if (percent >= 80) barClass = 'warning';

    return `
      <div class="budget-item">
        <div class="budget-header">
          <div class="budget-title">${cat}</div>
          <div class="budget-values" style="color: ${percent >= 100 ? 'var(--danger)' : 'var(--muted)'}">
            ${formatBRL(spent)} de ${formatBRL(limit)}
          </div>
        </div>
        <div class="progress-wrapper"><div class="progress-bar ${barClass}" style="width: ${percent}%"></div></div>
        <div class="goal-actions">
          <button class="btn btn-sm danger" data-action="del-budget" data-cat="${cat}">Remover</button>
        </div>
      </div>
    `;
  }).join('');
}

// --- LÓGICA DO SIMULADOR E RESERVA ---
function simulate() {
  const i = parseFloat(simInitial.value) || 0, m = parseFloat(simMonthly.value) || 0, r = (parseFloat(simRate.value) || 0)/100, t = parseInt(simTime.value) || 0;
  const total = i + (m * t);
  const final = r === 0 ? total : (i * Math.pow(1+r, t)) + (m * ((Math.pow(1+r, t) - 1) / r));
  document.getElementById('sim-total-invested').textContent = formatBRL(total);
  document.getElementById('sim-interest').textContent = formatBRL(final - total);
  document.getElementById('sim-final').textContent = formatBRL(final);
}
[simInitial, simMonthly, simRate, simTime].forEach(el => el.addEventListener('input', simulate));

function calcReserve() {
  const c = parseFloat(resCost.value) || 0, m = parseInt(resMonths.value) || 0;
  document.getElementById('res-result').textContent = formatBRL(c * m);
}
[resCost, resMonths].forEach(el => el.addEventListener('input', calcReserve));

// --- EVENTOS DE CRIAÇÃO E EXCLUSÃO ---
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const desc = document.getElementById('desc').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);
  if (!desc || !amount || amount <= 0) return;
  transactions.push({ id: uid(), desc, amount, type: typeSelect.value, category: document.getElementById('category').value, createdAt: Date.now() });
  save(STORAGE_KEY, transactions);
  updateMonthFilter(); render();
  form.reset(); submitBtn.textContent = 'Adicionar Entrada'; submitBtn.classList.remove('danger');
  showToast('Transação adicionada com sucesso!');
});

// Exclusão com botão de DESFAZER no Toast
listEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.tx-del');
  if (!btn) return;
  
  const id = btn.dataset.id;
  const removedTx = transactions.find(t => t.id === id);
  const index = transactions.findIndex(t => t.id === id);
  if (index === -1) return;

  // Remove temporariamente
  transactions.splice(index, 1);
  save(STORAGE_KEY, transactions); updateMonthFilter(); render();

  // Toast com Desfazer
  showToast('Transação excluída.', 'danger', 'Desfazer', () => {
    transactions.splice(index, 0, removedTx);
    save(STORAGE_KEY, transactions); updateMonthFilter(); render();
    showToast('Exclusão desfeita.', 'success');
  });
});

// Metas Eventos
goalForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('goal-name').value.trim();
  const target = parseFloat(document.getElementById('goal-target').value);
  if (!name || !target || target <= 0) return;
  goals.push({ id: uid(), name, target, current: 0 });
  save(STORAGE_KEY_GOALS, goals); renderGoals(); goalForm.reset();
  showToast('Meta criada!');
});

goalsList.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  const goal = goals.find(g => g.id === id);
  if (!goal) return;

  if (btn.dataset.action === 'del') {
    goals = goals.filter(g => g.id !== id);
    save(STORAGE_KEY_GOALS, goals); renderGoals();
    showToast('Meta excluída.', 'danger');
  } else if (btn.dataset.action === 'add') {
    currentGoalId = id;
    modalGoalTitle.textContent = `Guardar em: ${goal.name}`;
    modalGoalAmount.value = '';
    goalModal.classList.add('active');
    setTimeout(() => modalGoalAmount.focus(), 100);
  }
});

// Orçamentos Eventos
budgetForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const cat = document.getElementById('budget-category').value;
  const amount = parseFloat(document.getElementById('budget-amount').value);
  if (!amount || amount <= 0) return;
  budgets[cat] = amount;
  save(STORAGE_KEY_BUDGETS, budgets); renderBudgets(); budgetForm.reset();
  showToast(`Orçamento de ${cat} definido!`);
});

budgetsList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="del-budget"]');
  if (!btn) return;
  const cat = btn.dataset.cat;
  delete budgets[cat];
  save(STORAGE_KEY_BUDGETS, budgets); renderBudgets();
  showToast('Orçamento removido.', 'danger');
});

// Modal Metas
modalCancel.addEventListener('click', () => { goalModal.classList.remove('active'); currentGoalId = null; });
goalModal.addEventListener('click', (e) => { if (e.target === goalModal) { goalModal.classList.remove('active'); currentGoalId = null; } });
modalConfirm.addEventListener('click', () => {
  const amount = parseFloat(modalGoalAmount.value.replace(',', '.'));
  if (isNaN(amount) || amount <= 0) { showToast('Digite um valor válido.', 'danger'); return; }
  const goal = goals.find(g => g.id === currentGoalId);
  if (goal) {
    goal.current += amount;
    save(STORAGE_KEY_GOALS, goals); renderGoals();
    showToast('Valor guardado na meta!');
  }
  goalModal.classList.remove('active'); currentGoalId = null;
});
modalGoalAmount.addEventListener('keypress', (e) => { if (e.key === 'Enter') modalConfirm.click(); });

// Backup
btnExport.addEventListener('click', () => {
  const data = { transactions, goals, budgets };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `capitalizze-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click(); URL.revokeObjectURL(url);
  showToast('Backup gerado com sucesso!');
});

importFile.addEventListener('change', (e) => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.transactions) transactions = data.transactions;
      if (data.goals) goals = data.goals;
      if (data.budgets) budgets = data.budgets;
      save(STORAGE_KEY, transactions); save(STORAGE_KEY_GOALS, goals); save(STORAGE_KEY_BUDGETS, budgets);
      showToast('Backup restaurado! Recarregando...', 'success');
      setTimeout(() => location.reload(), 1500);
    } catch (err) { showToast('Erro ao ler o arquivo.', 'danger'); }
  };
  reader.readAsText(file);
});

// --- INICIALIZAÇÃO ---
initTheme();
updateMonthFilter();
render();
simulate();
calcReserve();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(err => console.log('Erro no SW:', err)));
}