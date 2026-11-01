import { state } from './state.js';
import { saveData, loadData, setMasterKey } from './storage.js';
import { deriveKey } from './crypto.js';
import { renderAll, renderSummary, renderGoals, renderBudgets, renderProfile, renderBanksSettings, updateBankSelects, updateMonthFilter, renderTransactions, renderBills, renderDebts, renderCategories, renderRecurring, formatBRL } from './ui.js';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

let currentGoalId = null;
let currentDebtId = null;
const goalModal = document.getElementById('goal-modal');
const debtPaymentModal = document.getElementById('debt-payment-modal');

export function initEvents() {
  // 1. Navegação de Abas
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // 2. Formulário de Transações
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
    renderSummary(); updateMonthFilter();
    document.getElementById('tx-form').reset(); 
    submitBtn.textContent = 'Adicionar Entrada'; submitBtn.classList.remove('danger');
    showToast('Transação adicionada!');
  });

  // 3. Exclusão de Transação
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

  // Filtros
  document.getElementById('month-filter').addEventListener('change', renderTransactions);
  document.getElementById('filter-type').addEventListener('change', renderTransactions);
  document.getElementById('search-tx').addEventListener('input', renderTransactions);

  // 4. Categorias (NOVO)
  document.getElementById('category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newCat = document.getElementById('new-category-name').value.trim();
    if (!newCat || state.categories.includes(newCat)) { showToast('Categoria inválida ou já existe.', 'danger'); return; }
    
    state.categories.push(newCat);
    await saveData('capitalizze.categories', state.categories);
    renderCategories();
    document.getElementById('category-form').reset();
    showToast('Categoria criada!');
  });

  document.getElementById('categories-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="del-cat"]'); if (!btn) return;
    const cat = btn.dataset.cat;
    state.categories = state.categories.filter(c => c !== cat);
    await saveData('capitalizze.categories', state.categories);
    renderCategories();
    showToast('Categoria removida.', 'danger');
  });

  // 5. Lançamentos Recorrentes (NOVO)
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
    renderRecurring();
    document.getElementById('rec-form').reset();
    showToast('Lançamento fixo cadastrado!');
  });

  document.getElementById('recurring-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="del-rec"]'); if (!btn) return;
    state.recurring = state.recurring.filter(r => r.id !== btn.dataset.id);
    await saveData('capitalizze.recurring', state.recurring);
    renderRecurring();
    showToast('Lançamento fixo removido.', 'danger');
  });

  // 6. Contas Manuais
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
      await saveData('capitalizze.bills', state.bills);
      renderBills(); showToast('Conta removida.', 'danger');
    } else if (action === 'settle-bill') {
      const bill = state.bills.find(b => b.id === id); if (!bill) return;
      const txType = bill.type === 'pay' ? 'expense' : 'income';
      state.transactions.push({ id: uid(), desc: bill.desc, amount: bill.amount, type: txType, category: 'Geral', bank: state.banks.length > 0 ? state.banks[0] : 'Geral', createdAt: Date.now() });
      state.bills = state.bills.filter(b => b.id !== id);
      await saveData('capitalizze.transactions', state.transactions);
      await saveData('capitalizze.bills', state.bills);
      renderSummary(); updateMonthFilter(); renderTransactions(); renderBills();
      document.getElementById('bills-badge').style.display = 'none';
      showToast(`Conta ${bill.type === 'pay' ? 'paga' : 'recebida'} com sucesso!`);
    }
  });

  // 7. Dívidas
  document.getElementById('debt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const desc = document.getElementById('debt-desc').value.trim();
    const amount = parseFloat(document.getElementById('debt-amount').value);
    const type = document.getElementById('debt-type').value;
    const person = document.getElementById('debt-person').value.trim();
    if (!desc || !amount || amount <= 0) return;
    state.debts.push({ id: uid(), desc, total: amount, remaining: amount, type, person });
    await saveData('capitalizze.debts', state.debts);
    renderDebts(); document.getElementById('debt-form').reset(); showToast('Dívida cadastrada!');
  });

  document.getElementById('debts-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    const id = btn.dataset.id; const action = btn.dataset.action;
    if (action === 'del-debt') {
      state.debts = state.debts.filter(d => d.id !== id);
      await saveData('capitalizze.debts', state.debts);
      renderDebts(); showToast('Dívida removida.', 'danger');
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
    renderDebts(); renderSummary(); updateMonthFilter(); renderTransactions();
    debtPaymentModal.classList.remove('active'); currentDebtId = null;
    showToast(`Dívida abatida e ${formatBRL(amount)} adicionado às transações!`);
  });

  // 8. Metas
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
      renderGoals(); showToast('Meta excluída.', 'danger');
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
    if (goal) { goal.current += amount; await saveData('capitalizze.goals', state.goals); renderGoals(); showToast('Valor guardado!'); }
    goalModal.classList.remove('active'); currentGoalId = null;
  });

  // 9. Orçamentos
  document.getElementById('budget-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cat = document.getElementById('budget-category').value; const amount = parseFloat(document.getElementById('budget-amount').value);
    if (!amount || amount <= 0) return;
    state.budgets[cat] = amount; await saveData('capitalizze.budgets', state.budgets);
    renderBudgets(); document.getElementById('budget-form').reset(); showToast(`Orçamento de ${cat} definido!`);
  });

  document.getElementById('budgets-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="del-budget"]'); if (!btn) return;
    delete state.budgets[btn.dataset.cat]; await saveData('capitalizze.budgets', state.budgets);
    renderBudgets(); showToast('Orçamento removido.', 'danger');
  });

  // 10. Perfil, Tema, Bancos, Notificações, Segurança e Backup
  let currentAvatarBase64 = state.profile.avatar || null;
  document.getElementById('prof-avatar-input').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas'); const MAX_SIZE = 150;
        let width = img.width, height = img.height;
        if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
        else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        currentAvatarBase64 = canvas.toDataURL('image/jpeg', 0.8);
        document.getElementById('profile-avatar-img').src = currentAvatarBase64;
        document.getElementById('profile-avatar-img').style.display = 'block';
        document.getElementById('profile-avatar-placeholder').style.display = 'none';
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    state.profile.name = document.getElementById('prof-name').value.trim() || 'Visitante';
    state.profile.email = document.getElementById('prof-email').value.trim() || 'email@exemplo.com';
    state.profile.avatar = currentAvatarBase64;
    await saveData('capitalizze.profile', state.profile); renderProfile(); showToast('Perfil atualizado!');
  });

  document.getElementById('theme-toggle-settings').addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('capitalizze.theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
  });

  document.getElementById('banks-checkboxes').addEventListener('change', async (e) => {
    if (e.target.tagName === 'INPUT') {
      if (e.target.checked) { if (!state.banks.includes(e.target.value)) state.banks.push(e.target.value); }
      else { state.banks = state.banks.filter(b => b !== e.target.value); }
      await saveData('capitalizze.banks', state.banks); updateBankSelects(); renderSummary(); 
      showToast(`Bancos atualizados.`);
    }
  });

  const btnNotify = document.getElementById('btn-enable-notifications');
  function updateNotifyButton() {
    if (Notification.permission === 'granted') {
      btnNotify.textContent = '🔔 Ativado'; btnNotify.classList.add('btn-notify-active');
    } else if (Notification.permission === 'denied') {
      btnNotify.textContent = '🚫 Bloqueado'; btnNotify.classList.remove('btn-notify-active'); btnNotify.style.color = 'var(--danger)';
    } else {
      btnNotify.textContent = '🔔 Ativar'; btnNotify.classList.remove('btn-notify-active');
    }
  }
  updateNotifyButton();
  btnNotify.addEventListener('click', () => {
    if (Notification.permission === 'granted') { showToast('Notificações já estão ativas!', 'success'); return; }
    if (Notification.permission === 'denied') { showToast('Você bloqueou as notificações. Vá nas configurações do navegador para desbloquear.', 'danger'); return; }
    Notification.requestPermission().then(permission => {
      updateNotifyButton();
      if (permission === 'granted') {
        showToast('Notificações ativadas com sucesso!', 'success');
        new Notification('Capitalizze', { body: 'Você receberá alertas de contas a vencer!', icon: '/assets/logo.png' });
      }
    });
  });

  const changePinModal = document.getElementById('change-pin-modal');
  document.getElementById('btn-change-pin').addEventListener('click', () => {
    document.getElementById('old-pin').value = ''; document.getElementById('new-pin').value = '';
    changePinModal.classList.add('active'); setTimeout(() => document.getElementById('old-pin').focus(), 100);
  });
  document.getElementById('cancel-change-pin').addEventListener('click', () => changePinModal.classList.remove('active'));
  document.getElementById('confirm-change-pin').addEventListener('click', async () => {
    const oldPin = document.getElementById('old-pin').value; const newPin = document.getElementById('new-pin').value;
    if (oldPin.length < 4 || oldPin.length > 6 || newPin.length < 4 || newPin.length > 6) { showToast('Pins devem ter entre 4 e 6 dígitos.', 'danger'); return; }
    const oldKey = await deriveKey(oldPin); setMasterKey(oldKey);
    const testData = await loadData('capitalizze.transactions', null);
    if (testData === null) { showToast('PIN atual incorreto.', 'danger'); return; }
    const newKey = await deriveKey(newPin); setMasterKey(newKey);
    await saveData('capitalizze.transactions', state.transactions); await saveData('capitalizze.goals', state.goals);
    await saveData('capitalizze.budgets', state.budgets); await saveData('capitalizze.banks', state.banks);
    await saveData('capitalizze.bills', state.bills); await saveData('capitalizze.debts', state.debts);
    await saveData('capitalizze.recurring', state.recurring); await saveData('capitalizze.categories', state.categories);
    await saveData('capitalizze.profile', state.profile);
    changePinModal.classList.remove('active'); showToast('PIN alterado com sucesso!', 'success');
  });

  document.getElementById('btn-wipe-data').addEventListener('click', () => {
    const confirm = window.confirm("🚨 ATENÇÃO! Isso vai apagar TODAS as suas transações, metas e configurações PERMANENTEMENTE. Como os dados são criptografados, não há como recuperá-los. Tem certeza?");
    if (confirm) { localStorage.clear(); window.location.reload(); }
  });

  const simInputs = ['sim-initial', 'sim-monthly', 'sim-rate', 'sim-time'].map(id => document.getElementById(id));
  const calcSim = () => {
    const i = parseFloat(simInputs[0].value) || 0, m = parseFloat(simInputs[1].value) || 0, r = (parseFloat(simInputs[2].value) || 0)/100, t = parseInt(simInputs[3].value) || 0;
    const total = i + (m * t);
    const final = r === 0 ? total : (i * Math.pow(1+r, t)) + (m * ((Math.pow(1+r, t) - 1) / r));
    document.getElementById('sim-total-invested').textContent = formatBRL(total); document.getElementById('sim-interest').textContent = formatBRL(final - total); document.getElementById('sim-final').textContent = formatBRL(final);
  };
  simInputs.forEach(el => el.addEventListener('input', calcSim));

  const resCost = document.getElementById('res-cost'), resMonths = document.getElementById('res-months');
  const calcRes = () => { document.getElementById('res-result').textContent = formatBRL((parseFloat(resCost.value)||0) * (parseInt(resMonths.value)||0)); };
  [resCost, resMonths].forEach(el => el.addEventListener('input', calcRes));

  const calcVal = document.getElementById('calc-value'), calcFee = document.getElementById('calc-fee'), calcInst = document.getElementById('calc-installments');
  const calcTax = () => {
    const val = parseFloat(calcVal.value) || 0, fee = (parseFloat(calcFee.value) || 0) / 100, inst = parseInt(calcInst.value) || 1;
    const total = val * (1 + fee);
    document.getElementById('calc-total').textContent = formatBRL(total); document.getElementById('calc-per-installment').textContent = formatBRL(total / inst);
  };
  [calcVal, calcFee, calcInst].forEach(el => el.addEventListener('input', calcTax));

  const dailyInc = document.getElementById('daily-income'), dailyFix = document.getElementById('daily-fixed');
  const calcDaily = () => {
    const inc = parseFloat(dailyInc.value) || 0, fix = parseFloat(dailyFix.value) || 0;
    const avail = inc - fix; const daily = avail / 30;
    const resEl = document.getElementById('daily-result');
    resEl.textContent = formatBRL(daily > 0 ? daily : 0); resEl.style.color = avail <= 0 ? 'var(--danger)' : 'var(--success)';
  };
  [dailyInc, dailyFix].forEach(el => el.addEventListener('input', calcDaily));

  document.getElementById('btn-export').addEventListener('click', () => {
    const data = { transactions: state.transactions, goals: state.goals, budgets: state.budgets, banks: state.banks, bills: state.bills, debts: state.debts, recurring: state.recurring, categories: state.categories, profile: state.profile };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `capitalizze-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click(); URL.revokeObjectURL(url); showToast('Backup gerado!');
  });

  document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(evt) {
      try {
        const data = JSON.parse(evt.target.result);
        if (data.transactions) { state.transactions = data.transactions; await saveData('capitalizze.transactions', data.transactions); }
        if (data.goals) { state.goals = data.goals; await saveData('capitalizze.goals', data.goals); }
        if (data.budgets) { state.budgets = data.budgets; await saveData('capitalizze.budgets', data.budgets); }
        if (data.banks) { state.banks = data.banks; await saveData('capitalizze.banks', data.banks); }
        if (data.bills) { state.bills = data.bills; await saveData('capitalizze.bills', data.bills); }
        if (data.debts) { state.debts = data.debts; await saveData('capitalizze.debts', data.debts); }
        if (data.recurring) { state.recurring = data.recurring; await saveData('capitalizze.recurring', data.recurring); }
        if (data.categories) { state.categories = data.categories; await saveData('capitalizze.categories', data.categories); }
        if (data.profile) { state.profile = data.profile; await saveData('capitalizze.profile', data.profile); }
        showToast('Backup restaurado! Recarregando...', 'success');
        setTimeout(() => location.reload(), 1500);
      } catch (err) { showToast('Erro ao ler o arquivo.', 'danger'); }
    };
    reader.readAsText(file);
  });

  document.getElementById('btn-export-csv').addEventListener('click', () => {
    if (state.transactions.length === 0) { showToast('Não há transações para exportar.', 'danger'); return; }
    const headers = ['Data', 'Descrição', 'Categoria', 'Banco', 'Tipo', 'Valor'];
    const rows = state.transactions.map(t => {
      const date = new Date(t.createdAt).toLocaleDateString('pt-BR');
      const desc = `"${t.desc.replace(/"/g, '""')}"`; const category = `"${t.category}"`;
      const bank = `"${t.bank || 'Geral'}"`; const type = t.type === 'income' ? 'Entrada' : 'Saida';
      const amount = t.amount.toFixed(2).replace('.', ',');
      return [date, desc, category, bank, type, amount].join(';');
    });
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `capitalizze-extrato-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url); showToast('Relatório Excel gerado!');
  });
}

export function showToast(message, type = 'success', actionText = null, actionCallback = null) {
  const toastContainer = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.classList.add('toast', type);
  toast.innerHTML = `<span class="toast-msg">${message}</span>`;
  if (actionText && actionCallback) {
    const btn = document.createElement('button');
    btn.classList.add('toast-btn'); btn.textContent = actionText;
    btn.onclick = () => { actionCallback(); toast.style.animation = 'slideOutRight 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); };
    toast.appendChild(btn);
  }
  toastContainer.appendChild(toast);
  setTimeout(() => { if (document.body.contains(toast)) { toast.style.animation = 'slideOutRight 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); } }, 4000);
}