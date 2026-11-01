import { encryptData, decryptData } from './crypto.js';

let masterKey = null;

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

export function hasSavedData() {
  return localStorage.getItem('capitalizze.transactions') !== null;
}