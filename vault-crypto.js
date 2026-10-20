// Vault crypto — shared by the web app (browser) and tools/vault.mjs (Node 20+).
// Everything that leaves the device is AES-256-GCM ciphertext. The key is derived
// from username + password with PBKDF2-SHA256 and never stored anywhere.

const te = new TextEncoder();
const td = new TextDecoder();
const MAGIC = [0x4c, 0x50, 0x53, 0x31]; // "LPS1"
export const KDF_ITERATIONS = 600000;

export function toB64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function fromB64(str) {
  const s = atob(String(str).replace(/\s+/g, ""));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function randomId(prefix = "") {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  const r = randomBytes(12);
  let s = "";
  for (const b of r) s += a[b % a.length];
  return prefix + s;
}

export async function deriveKey(username, password, saltB64, iterations = KDF_ITERATIONS) {
  const material = te.encode(String(username).trim().toLowerCase() + "\n" + String(password));
  const base = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: fromB64(saltB64), iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function seal(key, bytes) {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes));
  const out = new Uint8Array(4 + 12 + ct.length);
  out.set(MAGIC, 0);
  out.set(iv, 4);
  out.set(ct, 16);
  return out;
}

export async function open(key, sealed) {
  const u8 = sealed instanceof Uint8Array ? sealed : new Uint8Array(sealed);
  for (let i = 0; i < 4; i++) {
    if (u8[i] !== MAGIC[i]) throw new Error("not-a-vault-file");
  }
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: u8.subarray(4, 16) }, key, u8.subarray(16));
  return new Uint8Array(pt);
}

export async function sealJSON(key, value) {
  return seal(key, te.encode(JSON.stringify(value)));
}

export async function openJSON(key, sealed) {
  return JSON.parse(td.decode(await open(key, sealed)));
}

// Fixed value sealed inside vault.json at creation. Changing it would lock out the existing vault.
export const CHECK_TEXT = "lapis-vault-ok";

// vault.json lives in the public site. It holds only the KDF salt, a check value
// and (after setup) the sealed storage secret. None of it is readable without the key.
export async function unlockVault(vault, username, password) {
  const key = await deriveKey(username, password, vault.kdf.salt, vault.kdf.iter);
  try {
    const txt = td.decode(await open(key, fromB64(vault.check)));
    if (txt !== CHECK_TEXT) throw new Error("bad-check");
  } catch {
    throw new Error("wrong-credentials");
  }
  return key;
}

export async function createVault(username, password) {
  const salt = toB64(randomBytes(16));
  const key = await deriveKey(username, password, salt, KDF_ITERATIONS);
  const check = toB64(await seal(key, te.encode(CHECK_TEXT)));
  return {
    vault: { v: 1, kdf: { alg: "PBKDF2-SHA256", iter: KDF_ITERATIONS, salt }, check, secret: null },
    key,
  };
}
