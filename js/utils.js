export function formatBRL(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
export function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

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