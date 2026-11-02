import { state, ACHIEVEMENTS_LIST } from './state.js';
import { saveData } from './storage.js';
import { showToast } from './utils.js';
import { initTransactionsEvents } from './modules/transactions.js';
import { initGoalsEvents } from './modules/goals.js';
import { initBillsEvents } from './modules/bills.js';
import { initToolsEvents } from './modules/tools.js';
import { initSettingsEvents } from './modules/settings.js';
import { renderAchievements } from './ui.js';

let inactivityTimer;
const LOCK_TIMEOUT = 120000;

export function initEvents() {
  resetInactivityTimer();
  ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(evt => {
    document.addEventListener(evt, resetInactivityTimer, { passive: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      setTimeout(() => { if(document.visibilityState === 'hidden') lockApp(); }, 60000);
    }
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Inicializa todos os módulos
  initTransactionsEvents();
  initGoalsEvents();
  initBillsEvents();
  initToolsEvents();
  initSettingsEvents();
  
  initTour();
  initPWA();
}

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(lockApp, LOCK_TIMEOUT);
}
function lockApp() { window.location.reload(); }

// --- TOUR E PWA ---
const tourSteps = [
  { icon: '👋', title: 'Bem-vindo ao Capitalizze!', text: 'Seu novo gerenciador financeiro. Vamos fazer um tour rápido para você saber onde fica cada coisa.' },
  { icon: '💰', title: 'Adicione suas Transações', text: 'Na aba "Início", você pode registrar tudo o que entra e sai do seu dinheiro. O app já calcula seu saldo automaticamente.' },
  { icon: '🎯', title: 'Contas, Metas e Dívidas', text: 'Use as abas superiores para não esquecer contas a pagar, criar metas e gerenciar dívidas.' },
  { icon: '🛡️', title: 'Segurança Máxima', text: 'Todos os dados são criptografados. Se ficar 2 minutos sem mexer, o app se bloqueia sozinho por segurança!' }
];
let currentTourStep = 0;

export function startTour() {
  const tourModal = document.getElementById('tour-modal');
  if (!tourModal) return;
  currentTourStep = 0; updateTourUI(); tourModal.classList.add('active');
}

function initTour() {
  document.getElementById('tour-next').onclick = async () => {
    if (currentTourStep < tourSteps.length - 1) { currentTourStep++; updateTourUI(); }
    else { await finishTour(); }
  };
  document.getElementById('tour-skip').onclick = async () => { await finishTour(); };
}

function updateTourUI() {
  const step = tourSteps[currentTourStep];
  document.getElementById('tour-icon').textContent = step.icon;
  document.getElementById('tour-title').textContent = step.title;
  document.getElementById('tour-text').textContent = step.text;
  document.getElementById('tour-next').textContent = currentTourStep === tourSteps.length - 1 ? 'Começar a Usar' : 'Próximo';
}

async function finishTour() {
  document.getElementById('tour-modal').classList.remove('active');
  state.profile.hasSeenTour = true;
  await saveData('capitalizze.profile', state.profile);
  showToast('Tour concluído! Bom proveito.', 'success');
}

function initPWA() {
  let deferredPrompt;
  const installBanner = document.getElementById('install-banner');
  const btnInstall = document.getElementById('btn-install');
  const btnCloseInstall = document.getElementById('btn-close-install');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    const lastDismissed = localStorage.getItem('capitalizze_install_dismissed');
    if (lastDismissed) {
      const days = (Date.now() - parseInt(lastDismissed)) / (1000 * 60 * 60 * 24);
      if (days < 7) return;
    }
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    installBanner.style.display = 'block';
  });

  btnInstall.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') { installBanner.style.display = 'none'; showToast('Instalado com sucesso!', 'success'); }
    deferredPrompt = null;
  });

  btnCloseInstall.addEventListener('click', () => {
    installBanner.style.display = 'none';
    localStorage.setItem('capitalizze_install_dismissed', Date.now().toString());
  });

  window.addEventListener('appinstalled', () => { installBanner.style.display = 'none'; });
}

// --- CONQUISTAS ---
export async function checkAchievements() {
  let newAchievementUnlocked = false;
  const unlock = (id) => {
    if (!state.achievements.includes(id)) {
      state.achievements.push(id); newAchievementUnlocked = true;
      const ach = ACHIEVEMENTS_LIST.find(a => a.id === id);
      showToast(`🏆 Conquista Desbloqueada: ${ach.title}`, 'success');
    }
  };

  if (state.transactions.length > 0) unlock('first_tx');
  if (Object.keys(state.budgets).length > 0) unlock('first_budget');
  const totalSaved = state.goals.reduce((sum, g) => sum + g.current, 0);
  if (totalSaved >= 1000) unlock('saver_1000');
  const hasActiveDebts = state.debts.some(d => d.remaining > 0.01);
  if (state.debts.length > 0 && !hasActiveDebts) unlock('debt_free');
  if (state.banks.length >= 3) unlock('multi_bank');

  if (newAchievementUnlocked) {
    await saveData('capitalizze.achievements', state.achievements);
    renderAchievements();
  }
}

export { showToast };