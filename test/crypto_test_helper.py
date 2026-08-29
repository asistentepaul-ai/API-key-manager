#!/usr/bin/env python3
"""Helper script for crypto compatibility test.
Generates a sample vault, encrypts it, and optionally decrypts a payload.
Usage:
  python3 crypto_test_helper.py generate <password>   -> prints encrypted JSON payload
  python3 crypto_test_helper.py decrypt <password>    -> reads JSON from stdin, prints plaintext
"""
import sys
import json
import os

# Add parent of backend to path so we can import backend.crypto
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.crypto import encrypt_vault, decrypt_vault

SAMPLE_KEYS = [
    {"id": "a1b2c3d4e5f6a7b8c9d0e1f2", "name": "Test Key 1", "value": "sk-test-value-12345", "notes": "Nota de prueba", "created_at": "2025-01-01T00:00:00Z", "updated_at": "2025-01-01T00:00:00Z"},
    {"id": "b2c3d4e5f6a7b8c9d0e1f2a3", "name": "Test Key 2", "value": "ghp_test_token_67890", "notes": "", "created_at": "2025-06-15T12:30:00Z", "updated_at": "2025-06-15T12:30:00Z"}
]

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: crypto_test_helper.py generate|decrypt <password>", file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]
    password = sys.argv[2]

    if command == 'generate':
        plaintext = json.dumps({"keys": SAMPLE_KEYS}, ensure_ascii=False)
        payload = encrypt_vault(plaintext, password)
        print(json.dumps(payload))
    elif command == 'decrypt':
        payload = json.loads(sys.stdin.read())
        plaintext = decrypt_vault(payload, password)
        print(plaintext)
    else:
        print("Unknown command: " + command, file=sys.stderr)
        sys.exit(1)