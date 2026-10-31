const STORAGE_KEY = 'capitalizze.transactions';
const STORAGE_KEY_GOALS = 'capitalizze.goals';

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

// Elementos Metas
const goalForm = document.getElementById('goal-form');
const goalsList = document.getElementById('goals-list');

// Elementos Simulador
const simInitial = document.getElementById('sim-initial');
const simMonthly = document.getElementById('sim-monthly');
const simRate = document.getElementById('sim-rate');
const simTime = document.getElementById('sim-time');
const simTotalInvested = document.getElementById('sim-total-invested');
const simInterest = document.getElementById('sim-interest');
const simFinal = document.getElementById('sim-final');
const simChartBars = document.getElementById('sim-chart-bars');

let transactions = load(STORAGE_KEY);
let goals = load(STORAGE_KEY_GOALS);

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatBRL(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// --- SISTEMA DE ABAS ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// --- BOTÃO DINÂMICO ---
typeSelect.addEventListener('change', (e) => {
  if (e.target.value === 'expense') {
    submitBtn.textContent = 'Adicionar Despesa';
    submitBtn.classList.add('danger');
  } else {
    submitBtn.textContent = 'Adicionar Entrada';
    submitBtn.classList.remove('danger');
  }
});

// --- FILTRO DE MÊS ---
function updateMonthFilter() {
  const months = new Set();
  const currentValue = monthFilter.value;

  transactions.forEach(t => {
    const date = new Date(t.createdAt);
    const monthYear = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    months.add(monthYear);
  });

  const sortedMonths = Array.from(months).sort((a, b) => {
    const [mA, yA] = a.split('/');
    const [mB, yB] = b.split('/');
    return new Date(yB, mB - 1) - new Date(yA, mA - 1);
  });

  monthFilter.innerHTML = '<option value="all">Todos os meses</option>';
  sortedMonths.forEach(m => {
    const option = document.createElement('option');
    option.value = m;
    option.textContent = m;
    monthFilter.appendChild(option);
  });

  if (currentValue && Array.from(monthFilter.options).some(o => o.value === currentValue)) {
    monthFilter.value = currentValue;
  } else {
    monthFilter.value = 'all';
  }
}

monthFilter.addEventListener('change', renderTransactions);

// --- RENDERIZAÇÃO GERAL ---
function render() {
  renderSummary();
  renderTransactions();
  renderChart();
  renderGoals();
}

function renderSummary() {
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  balanceEl.textContent = formatBRL(income - expense);
  incomeEl.textContent = formatBRL(income);
  expenseEl.textContent = formatBRL(expense);
}

function renderTransactions() {
  const filter = monthFilter.value;
  const filtered = transactions.filter(t => {
    if (filter === 'all') return true;
    const date = new Date(t.createdAt);
    const monthYear = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    return monthYear === filter;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="empty">Nenhuma transação encontrada para este filtro.</div>';
    return;
  }

  const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);

  listEl.innerHTML = sorted.map(t => `
    <div class="tx">
      <div class="tx-info">
        <div class="tx-desc">${escapeHtml(t.desc)}</div>
        <div class="tx-meta">${t.category} • ${new Date(t.createdAt).toLocaleDateString('pt-BR')}</div>
      </div>
      <div class="tx-amount ${t.type}">
        ${t.type === 'income' ? '+' : '−'} ${formatBRL(t.amount)}
      </div>
      <button class="tx-del" data-id="${t.id}" title="Excluir">✕</button>
    </div>
  `).join('');
}

function renderChart() {
  const expenses = transactions.filter(t => t.type === 'expense');
  if (expenses.length === 0) {
    chartBars.innerHTML = '<div class="empty">Adicione despesas para ver o gráfico.</div>';
    return;
  }
  const byCategory = {};
  expenses.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });
  const maxVal = Math.max(...Object.values(byCategory));

  chartBars.innerHTML = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => {
      const percent = (val / maxVal) * 100;
      return `
        <div class="chart-row">
          <div class="chart-label">${cat}</div>
          <div class="chart-bar-wrapper"><div class="chart-bar" style="width: ${percent}%; background: var(--danger);"></div></div>
          <div class="chart-value">${formatBRL(val)}</div>
        </div>
      `;
    }).join('');
}

function renderGoals() {
  if (goals.length === 0) {
    goalsList.innerHTML = '<div class="empty">Você ainda não tem metas. Crie uma acima!</div>';
    return;
  }

  goalsList.innerHTML = goals.map(g => {
    const percent = Math.min((g.current / g.target) * 100, 100);
    return `
      <div class="goal-item">
        <div class="goal-header">
          <div class="goal-title">${escapeHtml(g.name)}</div>
          <div class="goal-values">${formatBRL(g.current)} de ${formatBRL(g.target)}</div>
        </div>
        <div class="progress-wrapper">
          <div class="progress-bar" style="width: ${percent}%"></div>
        </div>
        <div class="goal-actions">
          <button class="btn btn-sm" data-action="add" data-id="${g.id}">+ Guardar</button>
          <button class="btn btn-sm danger" data-action="del" data-id="${g.id}">Excluir</button>
        </div>
      </div>
    `;
  }).join('');
}

// --- LÓGICA DO SIMULADOR DE JUROS COMPOSTOS ---
function simulate() {
  const initial = parseFloat(simInitial.value) || 0;
  const monthly = parseFloat(simMonthly.value) || 0;
  const rate = parseFloat(simRate.value) / 100 || 0; // Transforma 1% em 0.01
  const time = parseInt(simTime.value) || 0;

  // Total que saiu do bolso do usuário
  const totalInvested = initial + (monthly * time);
  let finalAmount = 0;

  if (rate === 0) {
    // Se não tem juros, o montante é só o que foi investido
    finalAmount = totalInvested;
  } else {
    // Fórmula de Juros Compostos com Aportes Mensais
    // M = C * (1+i)^t + P * (((1+i)^t - 1) / i)
    const factor = Math.pow(1 + rate, time);
    finalAmount = (initial * factor) + (monthly * ((factor - 1) / rate));
  }

  const interest = finalAmount - totalInvested;

  // Atualiza os Cards
  simTotalInvested.textContent = formatBRL(totalInvested);
  simInterest.textContent = formatBRL(interest);
  simFinal.textContent = formatBRL(finalAmount);

  // Desenha o Gráfico Proporcional
  if (finalAmount === 0) {
    simChartBars.innerHTML = '<div class="empty">Preencha os dados para ver o gráfico.</div>';
    return;
  }

  // Calcula a porcentagem de cada um em relação ao montante final
  const investedPct = (totalInvested / finalAmount) * 100;
  const interestPct = (interest / finalAmount) * 100;

  simChartBars.innerHTML = `
    <div class="chart-row">
      <div class="chart-label">Investido</div>
      <div class="chart-bar-wrapper">
        <div class="chart-bar" style="width: ${investedPct}%; background: var(--info);"></div>
      </div>
      <div class="chart-value">${formatBRL(totalInvested)}</div>
    </div>
    <div class="chart-row">
      <div class="chart-label">Juros</div>
      <div class="chart-bar-wrapper">
        <div class="chart-bar" style="width: ${interestPct}%; background: var(--warning);"></div>
      </div>
      <div class="chart-value">${formatBRL(interest)}</div>
    </div>
  `;
}

// Ouve as mudanças nos inputs do simulador em tempo real
[simInitial, simMonthly, simRate, simTime].forEach(input => {
  input.addEventListener('input', simulate);
});

// --- EVENTOS DE TRANSAÇÃO ---
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const desc = document.getElementById('desc').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);
  const type = typeSelect.value;
  const category = document.getElementById('category').value;

  if (!desc || !amount || amount <= 0) return;

  transactions.push({ id: uid(), desc, amount, type, category, createdAt: Date.now() });
  save(STORAGE_KEY, transactions);
  updateMonthFilter();
  render();
  
  form.reset();
  submitBtn.textContent = 'Adicionar Entrada';
  submitBtn.classList.remove('danger');
  document.getElementById('desc').focus();
});

listEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.tx-del');
  if (!btn) return;
  transactions = transactions.filter(t => t.id !== btn.dataset.id);
  save(STORAGE_KEY, transactions);
  updateMonthFilter();
  render();
});

// --- EVENTOS DE METAS ---
goalForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('goal-name').value.trim();
  const target = parseFloat(document.getElementById('goal-target').value);

  if (!name || !target || target <= 0) return;

  goals.push({ id: uid(), name, target, current: 0 });
  save(STORAGE_KEY_GOALS, goals);
  renderGoals();
  goalForm.reset();
});

goalsList.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const id = btn.dataset.id;
  const goal = goals.find(g => g.id === id);
  if (!goal) return;

  if (btn.dataset.action === 'del') {
    if (confirm(`Excluir a meta "${goal.name}"?`)) {
      goals = goals.filter(g => g.id !== id);
      save(STORAGE_KEY_GOALS, goals);
      renderGoals();
    }
  } 
  
  if (btn.dataset.action === 'add') {
    const amountStr = prompt(`Quanto você quer guardar para "${goal.name}"? (R$)`);
    if (amountStr === null) return;
    
    const amount = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, digite um valor válido.');
      return;
    }
    
    goal.current += amount;
    save(STORAGE_KEY_GOALS, goals);
    renderGoals();
  }
});

// --- INICIALIZAÇÃO ---
updateMonthFilter();
render();
simulate(); // Inicia o simulador com zeros