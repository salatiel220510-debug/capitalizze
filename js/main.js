// js/main.js
// Este é o cérebro do app. Ele controla a segurança, o setup inicial e liga o motor principal.

// --- IMPORTAÇÕES ---
import { deriveKey } from './crypto.js';
import { setMasterKey, hasSavedData, loadData, saveData } from './storage.js';
import { state } from './state.js';
import { renderAll } from './ui.js';
import { initEvents } from './events.js';

// --- ELEMENTOS DO DOM (Telas de Segurança) ---
const setupScreen = document.getElementById('setup-screen');
const newPinInput = document.getElementById('new-pin-input');
const setupSubmit = document.getElementById('setup-submit');
const setupBanksGrid = document.getElementById('setup-banks-grid');

const lockScreen = document.getElementById('lock-screen');
const pinInput = document.getElementById('pin-input');
const pinSubmit = document.getElementById('pin-submit');
const lockMsg = document.getElementById('lock-msg');

const AVAILABLE_BANKS = ['Nubank', 'Inter', 'Itaú', 'Bradesco', 'Caixa', 'Santander', 'C6 Bank', 'PicPay', 'Mercado Pago'];

// --- 1. INICIALIZAÇÃO DO FLUXO DE SEGURANÇA ---
function initSecurityFlow() {
  if (hasSavedData()) {
    // Se já existem dados salvos no navegador, o usuário já tem conta. Mostra a tela de PIN.
    setupScreen.style.display = 'none';
    lockScreen.style.display = 'flex';
    pinInput.focus();
  } else {
    // Se não tem dados, é um usuário novo. Mostra a tela de criar conta e escolher bancos.
    lockScreen.style.display = 'none';
    setupScreen.style.display = 'flex';
    renderSetupBanks();
    newPinInput.focus();
  }
}

// --- 2. LÓGICA DE SETUP (NOVO USUÁRIO) ---
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
  
  // Validação do PIN
  if (pin.length < 4 || pin.length > 6) {
    alert('O PIN precisa ter entre 4 e 6 dígitos.');
    return;
  }

  // Pega os bancos selecionados
  const selectedBanks = [];
  setupBanksGrid.querySelectorAll('input:checked').forEach(input => {
    selectedBanks.push(input.value);
  });

  if (selectedBanks.length === 0) {
    alert('Selecione pelo menos um banco para continuar.');
    return;
  }

  try {
    setupSubmit.textContent = 'Criando conta...';
    
    // Gera a chave de criptografia baseada no PIN
    const key = await deriveKey(pin);
    setMasterKey(key);

    // Configura o estado inicial
    state.banks = selectedBanks;
    state.profile.joined = Date.now();
    
    // Salva os dados iniciais criptografados
    await saveData('capitalizze.banks', state.banks);
    await saveData('capitalizze.profile', state.profile);
    await saveData('capitalizze.transactions', state.transactions);
    
    unlockApp();
  } catch (error) {
    console.error(error);
    alert('Erro ao criar a conta. Tente novamente.');
    setupSubmit.textContent = 'Criar Conta e Acessar';
  }
});

// --- 3. LÓGICA DE LOGIN (USUÁRIO ANTIGO) ---
async function handlePin() {
  const pin = pinInput.value;
  if (pin.length < 4 || pin.length > 6) { 
    lockMsg.textContent = 'O PIN deve ter entre 4 e 6 dígitos.'; 
    return; 
  }
  
  lockMsg.textContent = 'Descriptografando...';
  
  try {
    // Gera a chave baseada no PIN digitado
    const key = await deriveKey(pin);
    
    // IMPORTANTE: Coloca a chave no motor ANTES de tentar ler os dados
    setMasterKey(key); 
    
    // Tenta carregar uma transação de teste. Se o PIN estiver errado, vai retornar null.
    const testData = await loadData('capitalizze.transactions', null);
    
    if (testData !== null) {
      // PIN Correto! Carrega todo o resto.
      state.transactions = testData;
      state.profile = await loadData('capitalizze.profile', state.profile);
      state.goals = await loadData('capitalizze.goals', []);
      state.budgets = await loadData('capitalizze.budgets', {});
      state.banks = await loadData('capitalizze.banks', []);
      
      unlockApp();
    } else {
      // PIN Incorreto
      setMasterKey(null); // Limpa a chave da memória por segurança
      lockMsg.textContent = 'PIN incorreto. Tente novamente.';
      pinInput.value = '';
      pinInput.focus();
    }
  } catch (error) {
    console.error(error);
    lockMsg.textContent = 'Erro ao desbloquear. Tente novamente.';
  }
}

pinSubmit.addEventListener('click', handlePin);
pinInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handlePin(); });

// --- 4. DESBLOQUEAR O APP (MOTOR ACORDADO) ---
function unlockApp() {
  // Esconde as telas de segurança com uma animação suave
  setupScreen.classList.add('hidden');
  lockScreen.classList.add('hidden');
  
  setTimeout(() => {
    setupScreen.style.display = 'none';
    lockScreen.style.display = 'none';
  }, 500);

  // Aplica o tema claro se o usuário tiver escolhido antes
  if (localStorage.getItem('capitalizze.theme') === 'light') {
    document.body.classList.add('light-mode');
  }

  // Acorda o motor! Renderiza toda a tela e liga os cliques
  renderAll();
  initEvents();
}

// --- INICIALIZAÇÃO ---
initSecurityFlow();