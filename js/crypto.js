// js/crypto.js
const SALT = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

export async function deriveKey(pin) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(pin), { name: "PBKDF2" }, false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: 100000, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}

export async function encryptData(data, key) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(data))
  );
  return btoa(String.fromCharCode(...iv, ...new Uint8Array(encrypted)));
}

export async function decryptData(encryptedBase64, key) {
  try {
    const str = atob(encryptedBase64);
    const iv = new Uint8Array(str.slice(0, 12).split('').map(c => c.charCodeAt(0)));
    const data = new Uint8Array(str.slice(12).split('').map(c => c.charCodeAt(0)));
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch { return null; }
}