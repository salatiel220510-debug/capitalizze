// js/storage.js
import { encryptData, decryptData } from './crypto.js';

let masterKey = null; // A chave fica só na memória, não vai pro localStorage

export function setMasterKey(key) { masterKey = key; }
export function hasMasterKey() { return masterKey !== null; }

export async function saveData(key, data) {
  if (!masterKey) return;
  const encrypted = await encryptData(data, masterKey);
  localStorage.setItem(key, encrypted);
}

export async function loadData(key, fallback) {
  if (!masterKey) return fallback;
  const encrypted = localStorage.getItem(key);
  if (!encrypted) return fallback;
  const decrypted = await decryptData(encrypted, masterKey);
  return decrypted !== null ? decrypted : fallback;
}

// Função apenas para checar se existe algum dado salvo (para saber se é o primeiro acesso)
export function hasSavedData() {
  return localStorage.getItem('capitalizze.transactions') !== null;
}