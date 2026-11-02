import { deriveKey } from './crypto.js';
import { setMasterKey, hasSavedData, loadData, saveData } from './storage.js';
import { state, AVAILABLE_BANKS } from './state.js';
import { renderAll } from './ui.js';
import { initEvents, startTour, showToast } from './events.js';

const setupScreen = document.getElementById('setup-screen');
const newPinInput = document.getElementById('new-pin-input');
const setupSubmit = document.getElementById('setup-submit');
const setupBanksGrid = document.getElementById('setup-banks-grid');

const lockScreen = document.getElementById('lock-screen');
const pinInput = document.getElementById('pin-input');
const pinSubmit = document.getElementById('pin-submit');
const lockMsg = document.getElementById('lock-msg');

const loadingScreen = document.getElementById('loading-screen'); // NOVO

function initSecurityFlow() {
  if (hasSavedData()) {
    setupScreen.style.display = 'none';
    lockScreen.style.display = 'flex';
    pinInput.focus();
  } else {
    lockScreen.style.display = 'none';
    setupScreen.style.display = 'flex';
    renderSetupBanks();
    newPinInput.focus();
  }
}

function renderSetupBanks() {
  setupBanksGrid.innerHTML = AVAILABLE_BANKS.map(bank => `
    <label class="bank-checkbox">
      <input type="checkbox" value="${bank}">
      ${bank}
    </label>
  `).join('');
}

setupSubmit.addEventListener('click', async () => {
  const pin = newPinInput.value;
  if (pin.length < 4 || pin.length > 6) { alert('O PIN precisa ter entre 4 e 6 dígitos.'); return; }

  const selectedBanks = [];
  setupBanksGrid.querySelectorAll('input:checked').forEach(input => selectedBanks.push(input.value));
  if (selectedBanks.length === 0) { alert('Selecione pelo menos um banco para continuar.'); return; }

  try {
    setupSubmit.textContent = 'Criando conta...';
    
    // Mostra a tela de Loading
    setupScreen.style.display = 'none';
    loadingScreen.style.display = 'flex';
    lockScreen.style.display = 'none';

    const key = await deriveKey(pin);
    setMasterKey(key);
    state.banks = selectedBanks;
    state.profile.joined = Date.now();
    
    await saveData('capitalizze.banks', state.banks);
    await saveData('capitalizze.profile', state.profile);
    await saveData('capitalizze.transactions', state.transactions);
    await saveData('capitalizze.categories', state.categories);
    await saveData('capitalizze.achievements', state.achievements);
    
    unlockApp();
  } catch (error) {
    console.error(error);
    alert('Erro ao criar a conta. Tente novamente.');
    setupSubmit.textContent = 'Criar Conta e Acessar';
    loadingScreen.style.display = 'none';
    setupScreen.style.display = 'flex';
  }
});

async function handlePin() {
  const pin = pinInput.value;
  if (pin.length < 4 || pin.length > 6) { lockMsg.textContent = 'O PIN deve ter entre 4 e 6 dígitos.'; return; }
  
  lockMsg.textContent = 'Verificando...';
  
  // Mostra a tela de Loading
  lockScreen.style.display = 'none';
  loadingScreen.style.display = 'flex';

  try {
    const key = await deriveKey(pin);
    setMasterKey(key); 
    const testData = await loadData('capitalizze.transactions', null);
    
    if (testData !== null) {
      state.transactions = testData;
      state.profile = await loadData('capitalizze.profile', state.profile);
      state.goals = await loadData('capitalizze.goals', []);
      state.budgets = await loadData('capitalizze.budgets', {});
      state.banks = await loadData('capitalizze.banks', []);
      state.bills = await loadData('capitalizze.bills', []);
      state.debts = await loadData('capitalizze.debts', []);
      state.recurring = await loadData('capitalizze.recurring', []);
      state.categories = await loadData('capitalizze.categories', state.categories);
      state.achievements = await loadData('capitalizze.achievements', []);
      unlockApp();
    } else {
      setMasterKey(null);
      lockMsg.textContent = 'PIN incorreto. Tente novamente.';
      pinInput.value = '';
      // Esconde Loading e mostra bloqueio de novo
      loadingScreen.style.display = 'none';
      lockScreen.style.display = 'flex';
      pinInput.focus();
    }
  } catch (error) {
    console.error(error);
    lockMsg.textContent = 'Erro ao desbloquear. Tente novamente.';
    loadingScreen.style.display = 'none';
    lockScreen.style.display = 'flex';
  }
}

pinSubmit.addEventListener('click', handlePin);
pinInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handlePin(); });

function unlockApp() {
  // O Loading já está ativo, apenas escondemos tudo e mostramos o conteúdo
  setTimeout(() => {
    loadingScreen.style.display = 'none';
  }, 800); // Pequeno delay para a animação do Loading ser visível

  if (localStorage.getItem('capitalizze.theme') === 'light') document.body.classList.add('light-mode');

  processRecurringTransactions();
  renderAll();
  initEvents();
  checkDueBills(); 
  
  // Dispara o Tour se for a primeira vez
  if (!state.profile.hasSeenTour) {
    setTimeout(startTour, 1000); // Espera 1 segundo para o app carregar antes de abrir o tour
  }
}

async function processRecurringTransactions() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const today = now.getDate();
  let changed = false;

  state.recurring.forEach(rec => {
    if (today >= rec.day && rec.lastProcessed !== currentMonth) {
      state.transactions.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        desc: rec.desc + ' (Automático)', amount: rec.amount, type: rec.type,
        category: rec.category, bank: state.banks.length > 0 ? state.banks[0] : 'Geral',
        createdAt: Date.now()
      });
      rec.lastProcessed = currentMonth;
      changed = true;
    }
  });

  if (changed) {
    await saveData('capitalizze.transactions', state.transactions);
    await saveData('capitalizze.recurring', state.recurring);
    showToast('Lançamentos fixos adicionados!', 'success');
  }
}

function checkDueBills() {
  const badge = document.getElementById('bills-badge');
  if (!state.bills || state.bills.length === 0) { badge.style.display = 'none'; return; }
  const today = new Date().getDate();
  const tomorrow = today + 1;
  const dueBills = state.bills.filter(b => b.dueDay === today || b.dueDay === tomorrow);
  
  if (dueBills.length > 0) {
    badge.style.display = 'inline-block';
    if (Notification.permission === 'granted') {
      dueBills.forEach(bill => {
        const isToday = bill.dueDay === today;
        const msg = `A conta "${bill.desc}" (R$ ${bill.amount.toFixed(2)}) vence ${isToday ? 'HOJE' : 'AMANHÃ'}!`;
        new Notification('Capitalizze - Lembrete de Conta', { body: msg, icon: '/assets/logo.png', vibrate: [200, 100, 200] });
      });
    }
  } else { badge.style.display = 'none'; }
}

initSecurityFlow();

// Carrega o Vercel Analytics apenas se estiver no ambiente de produção
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  const script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/insights/script.js';
  document.head.appendChild(script);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      setInterval(() => registration.update(), 60 * 60 * 1000);
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            if (Notification.permission === 'granted') {
              const notif = new Notification('Capitalizze Atualizado 🚀', {
                body: 'Uma nova versão está disponível. Clique aqui para recarregar o app!', icon: '/assets/logo.png'
              });
              notif.onclick = () => window.location.reload();
            } else {
              if(confirm('Nova versão disponível! Deseja recarregar agora?')) window.location.reload();
            }
          }
        });
      });
    }).catch(err => console.log('Erro no SW:', err));
  });
}