/* crypto.js — Web Crypto API compatible with Python backend/crypto.py
 * PBKDF2-SHA256 (600000 iterations, 32-byte/256-bit key, 16-byte salt)
 * AES-256-GCM (12-byte nonce, 16-byte tag appended to ciphertext, no AAD)
 * Payload format: {"salt": base64, "nonce": base64, "ciphertext": base64}
 * Plaintext: JSON string of {"keys": [...]}
 */

const SALT_LENGTH = 16;
const NONCE_LENGTH = 12;
const PBKDF2_ITERATIONS = 600000;
const KEY_LENGTH = 256;

function base64Encode(bytes) {
  var binary = '';
  var chunkSize = 8192;
  for (var i = 0; i < bytes.length; i += chunkSize) {
    var chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

function base64Decode(str) {
  var binary = atob(str);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveBits(masterPassword, salt) {
  var enc = new TextEncoder();
  var keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    KEY_LENGTH
  );
}

async function getAesKey(rawKey) {
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptVault(plaintext, masterPassword) {
  var salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  var rawKey = await deriveBits(masterPassword, salt);
  var aesKey = await getAesKey(rawKey);
  var nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));
  var enc = new TextEncoder();
  var ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    enc.encode(plaintext)
  );
  return {
    salt: base64Encode(salt),
    nonce: base64Encode(nonce),
    ciphertext: base64Encode(new Uint8Array(ciphertext))
  };
}

async function decryptVault(payload, masterPassword) {
  var salt = base64Decode(payload.salt);
  var rawKey = await deriveBits(masterPassword, salt);
  var aesKey = await getAesKey(rawKey);
  var nonce = base64Decode(payload.nonce);
  var ciphertext = base64Decode(payload.ciphertext);
  var decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    ciphertext
  );
  var dec = new TextDecoder();
  return dec.decode(decrypted);
}