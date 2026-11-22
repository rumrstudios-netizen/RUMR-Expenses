// Only ciphertext is persisted. PINs and derived keys remain in memory.
export const VAULT_KEY = 'rumr.device.v1';
const iterations = 600000;
const encode = bytes => btoa(String.fromCharCode(...bytes));
const decode = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
export function validPin(pin) { return /^\d{6,12}$/.test(pin); }
export async function deriveKey(pin, salt) {
 const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt:decode(salt),iterations,hash:'SHA-256'}, material, {name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
}
export async function seal(session, key, salt) {
 const iv = crypto.getRandomValues(new Uint8Array(12));
 const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, new TextEncoder().encode(JSON.stringify({access_token:session.access_token,refresh_token:session.refresh_token})));
 return {version:1,salt,iv:encode(iv),ciphertext:encode(new Uint8Array(ciphertext))};
}
export async function createVault(pin, session) {
 if (!validPin(pin)) throw Error('Choose a PIN with 6 to 12 digits.');
 const salt = encode(crypto.getRandomValues(new Uint8Array(16)));
 const key = await deriveKey(pin,salt);
 return {key,vault:await seal(session,key,salt)};
}
export async function openVault(pin, vault) {
 if (!vault || vault.version!==1 || typeof vault.salt!=='string' || decode(vault.salt).length!==16) throw Error('Device setup is unavailable. Sign in again to set a new PIN.');
 const key = await deriveKey(pin,vault.salt);
 try {
  const data = await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(vault.iv)},key,decode(vault.ciphertext));
  const session = JSON.parse(new TextDecoder().decode(data));
  if (!session.access_token || !session.refresh_token) throw Error('Invalid session');
  return {key,session};
 } catch { throw Error('That PIN did not unlock this device. Try again, or use Forgot PIN.'); }
}
