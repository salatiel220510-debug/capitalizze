import { state } from '../state.js';
import { saveData, loadData, setMasterKey } from '../storage.js';
import { deriveKey } from '../crypto.js';
import { formatBRL, escapeHtml, showToast } from '../utils.js';
import { checkAchievements } from '../events.js';

export function initSettingsEvents() {
  // Lógica do Perfil (Avatar, Nome, Email)
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

  // Tema
  document.getElementById('theme-toggle-settings').addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('capitalizze.theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
  });

  // Bancos
  document.getElementById('banks-checkboxes').addEventListener('change', async (e) => {
    if (e.target.tagName === 'INPUT') {
      if (e.target.checked) { if (!state.banks.includes(e.target.value)) state.banks.push(e.target.value); }
      else { state.banks = state.banks.filter(b => b !== e.target.value); }
      await saveData('capitalizze.banks', state.banks); 
      updateBankSelects(); 
      // Importa do transactions para atualizar a tela
      const { renderSummary } = await import('./transactions.js'); renderSummary();
      checkAchievements();
      showToast(`Bancos atualizados.`);
    }
  });

  // Notificações
  const btnNotify = document.getElementById('btn-enable-notifications');
  function updateNotifyButton() {
    if (Notification.permission === 'granted') { btnNotify.textContent = '🔔 Ativado'; btnNotify.classList.add('btn-notify-active'); }
    else if (Notification.permission === 'denied') { btnNotify.textContent = '🚫 Bloqueado'; btnNotify.classList.remove('btn-notify-active'); btnNotify.style.color = 'var(--danger)'; }
    else { btnNotify.textContent = '🔔 Ativar'; btnNotify.classList.remove('btn-notify-active'); }
  }
  updateNotifyButton();
  btnNotify.addEventListener('click', () => {
    if (Notification.permission === 'granted') { showToast('Notificações já estão ativas!', 'success'); return; }
    if (Notification.permission === 'denied') { showToast('Você bloqueou as notificações.', 'danger'); return; }
    Notification.requestPermission().then(permission => {
      updateNotifyButton();
      if (permission === 'granted') {
        showToast('Notificações ativadas!', 'success');
        new Notification('Capitalizze', { body: 'Você receberá alertas de contas a vencer!', icon: '/assets/logo.png' });
      }
    });
  });

  // Alterar PIN e Apagar Tudo (Mantidos aqui)
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
    
    // Re-salva tudo com a nova chave
    await saveData('capitalizze.transactions', state.transactions); await saveData('capitalizze.goals', state.goals);
    await saveData('capitalizze.budgets', state.budgets); await saveData('capitalizze.banks', state.banks);
    await saveData('capitalizze.bills', state.bills); await saveData('capitalizze.debts', state.debts);
    await saveData('capitalizze.recurring', state.recurring); await saveData('capitalizze.categories', state.categories);
    await saveData('capitalizze.achievements', state.achievements); await saveData('capitalizze.profile', state.profile);
    changePinModal.classList.remove('active'); showToast('PIN alterado com sucesso!', 'success');
  });

  document.getElementById('btn-wipe-data').addEventListener('click', () => {
    const confirm = window.confirm("🚨 ATENÇÃO! Isso vai apagar TODAS as suas transações, metas e configurações PERMANENTEMENTE. Tem certeza?");
    if (confirm) { localStorage.clear(); window.location.reload(); }
  });

  // Backup JSON e Exportar CSV
  document.getElementById('btn-export').addEventListener('click', () => {
    const data = { transactions: state.transactions, goals: state.goals, budgets: state.budgets, banks: state.banks, bills: state.bills, debts: state.debts, recurring: state.recurring, categories: state.categories, achievements: state.achievements, profile: state.profile };
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
        if (data.achievements) { state.achievements = data.achievements; await saveData('capitalizze.achievements', data.achievements); }
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

  // Categorias
  document.getElementById('category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newCat = document.getElementById('new-category-name').value.trim();
    if (!newCat || state.categories.includes(newCat)) { showToast('Categoria inválida ou já existe.', 'danger'); return; }
    state.categories.push(newCat);
    await saveData('capitalizze.categories', state.categories);
    renderCategories(); document.getElementById('category-form').reset(); showToast('Categoria criada!');
  });

  document.getElementById('categories-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="del-cat"]'); if (!btn) return;
    state.categories = state.categories.filter(c => c !== btn.dataset.cat);
    await saveData('capitalizze.categories', state.categories);
    renderCategories(); showToast('Categoria removida.', 'danger');
  });
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

export function renderBanksSettings() {
  const banksCheckboxes = document.getElementById('banks-checkboxes');
  banksCheckboxes.innerHTML = [
    'Nubank', 'Inter', 'Itaú', 'Bradesco', 'Caixa', 'Santander', 'C6 Bank', 'PicPay', 'Mercado Pago'
  ].map(bank => `
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