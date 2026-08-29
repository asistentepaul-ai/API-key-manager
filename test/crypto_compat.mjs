#!/usr/bin/env node
/**
 * crypto_compat.mjs — Compatibility test between Python backend and Web Crypto API.
 *
 * 1. Generates a sample vault with Python backend, decrypts with Web Crypto.
 * 2. Encrypts with Web Crypto, decrypts with Python backend.
 * Exits with code 0 on success, non-zero on failure.
 */

import { webcrypto } from 'crypto';
import { execSync, spawnSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON = join(__dirname, '..', '..', 'venv', 'bin', 'python');
const HELPER = join(__dirname, 'crypto_test_helper.py');
const PASSWORD = 'test-master-password-123!';

// ===== Web Crypto implementation (mirrors crypto.js) =====
const { subtle } = webcrypto;

const SALT_LENGTH = 16;
const NONCE_LENGTH = 12;
const PBKDF2_ITERATIONS = 600000;
const KEY_LENGTH = 256;

function base64Encode(bytes) {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

function base64Decode(str) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveBits(masterPassword, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    enc.encode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  return subtle.deriveBits(
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
  return subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptVault(plaintext, masterPassword) {
  const salt = webcrypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const rawKey = await deriveBits(masterPassword, salt);
  const aesKey = await getAesKey(rawKey);
  const nonce = webcrypto.getRandomValues(new Uint8Array(NONCE_LENGTH));
  const enc = new TextEncoder();
  const ciphertext = await subtle.encrypt(
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
  const salt = base64Decode(payload.salt);
  const rawKey = await deriveBits(masterPassword, salt);
  const aesKey = await getAesKey(rawKey);
  const nonce = base64Decode(payload.nonce);
  const ciphertext = base64Decode(payload.ciphertext);
  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    ciphertext
  );
  const dec = new TextDecoder();
  return dec.decode(decrypted);
}

// Helper: run Python with args, return stdout
function runPython(args, stdin) {
  const opts = { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 };
  if (stdin !== undefined) opts.input = stdin;
  return execSync(`"${PYTHON}" ${args}`, { ...opts, shell: true });
}

// ===== Test =====
let failures = 0;

async function main() {
  // ---- Test 1: Python encrypt → Web Crypto decrypt ----
  console.log('Test 1: Python encrypt → Web Crypto decrypt...');
  const pyEncrypted = runPython(`"${HELPER}" generate "${PASSWORD}"`).trim();
  const pyPayload = JSON.parse(pyEncrypted);

  const wcDecrypted = await decryptVault(pyPayload, PASSWORD);
  const wcData = JSON.parse(wcDecrypted);

  const expectedKeys = [
    { id: 'a1b2c3d4e5f6a7b8c9d0e1f2', name: 'Test Key 1', value: 'sk-test-value-12345' },
    { id: 'b2c3d4e5f6a7b8c9d0e1f2a3', name: 'Test Key 2', value: 'ghp_test_token_67890' }
  ];

  let ok = true;
  for (let i = 0; i < expectedKeys.length; i++) {
    const ek = expectedKeys[i];
    const wk = wcData.keys[i];
    if (wk.id !== ek.id || wk.name !== ek.name || wk.value !== ek.value) {
      console.error(`  FAIL: key ${i} mismatch`);
      console.error(`    expected: ${JSON.stringify(ek)}`);
      console.error(`    got:      ${JSON.stringify(wk)}`);
      ok = false;
      failures++;
    }
  }
  if (ok) console.log('  PASS');

  // ---- Test 2: Web Crypto encrypt → Python decrypt ----
  console.log('Test 2: Web Crypto encrypt → Python decrypt...');
  const testKeys = [
    { id: 'x1y2z3', name: 'Web Key 1', value: 'wc-value-abc', notes: 'from web crypto', created_at: '2025-08-01T00:00:00Z', updated_at: '2025-08-01T00:00:00Z' },
    { id: 'a9b8c7', name: 'Web Key 2', value: 'wc-value-def', notes: '', created_at: '2025-08-02T00:00:00Z', updated_at: '2025-08-02T00:00:00Z' }
  ];
  const wcPlaintext = JSON.stringify({ keys: testKeys });
  const wcPayload = await encryptVault(wcPlaintext, PASSWORD);

  const pyDecrypted = runPython(`"${HELPER}" decrypt "${PASSWORD}"`, JSON.stringify(wcPayload)).trim();
  const pyData = JSON.parse(pyDecrypted);

  ok = true;
  for (let i = 0; i < testKeys.length; i++) {
    const tk = testKeys[i];
    const pk = pyData.keys[i];
    if (pk.id !== tk.id || pk.name !== tk.name || pk.value !== tk.value) {
      console.error(`  FAIL: key ${i} mismatch`);
      console.error(`    expected: ${JSON.stringify(tk)}`);
      console.error(`    got:      ${JSON.stringify(pk)}`);
      ok = false;
      failures++;
    }
  }
  if (ok) console.log('  PASS');

  // ---- Summary ----
  if (failures > 0) {
    console.error(`\nFAILED: ${failures} test(s) failed`);
    process.exit(1);
  } else {
    console.log('\nAll tests PASSED');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});