# Cryptography Documentation

This document describes the cryptographic design and implementation used for storing sensitive data (client secrets) in the Monday Lifecycle Webhook Mock Tool. It is intended to serve as audit documentation.

## Overview

The application stores API client secrets for multiple monday.com apps. These secrets are encrypted at rest using industry-standard cryptographic primitives provided by the libsodium library.

## Threat Model

### Assets Protected

- **Client Secrets**: Static signing secrets for monday.com apps (used for JWT signing)
- **Future**: API keys and other sensitive credentials

### Threats Addressed

1. **Data at Rest**: Secrets encrypted in browser storage (IndexedDB)
2. **Memory Exposure**: Sensitive data zeroed from memory when locked
3. **Weak Passwords**: Argon2id provides resistance to brute-force attacks
4. **Cross-App Isolation**: Each app's secrets encrypted with a unique derived key

### Out of Scope

- **XSS Attacks**: If an attacker can execute JavaScript, they can use the decryption APIs while unlocked (see [SECURITY.md](./SECURITY.md) for XSS mitigations)
- **Physical Access**: Browser storage can be accessed by anyone with physical device access
- **Network Security**: This is a client-side tool; network security depends on the browser
- **Multi-User Support**: Single password vault by design (see [SECURITY.md](./SECURITY.md))

## Cryptographic Primitives

### Library

**libsodium** (via `libsodium-wrappers-sumo`)

- Version: 0.8.0 (as of implementation)
- Audited cryptographic library
- Used by: Signal, 1Password, Discord, and many others
- Website: https://libsodium.org

### Algorithms

| Function | Algorithm | Parameters |
|----------|-----------|------------|
| Password-based Key Derivation | Argon2id | See below |
| DEK Derivation | crypto_generichash (BLAKE2b keyed) | 32-byte subkeys |
| Authenticated Encryption | XSalsa20-Poly1305 | 24-byte nonce |
| Secure Random | ChaCha20-based CSPRNG | Via libsodium |

## Key Hierarchy

```
User Password
      │
      ▼
┌─────────────────────────────────┐
│         Argon2id KDF            │
│  ┌─────────────────────────┐    │
│  │ Salt: 16 bytes (random) │    │
│  │ Memory: 64 MiB          │    │
│  │ Iterations: 3           │    │
│  │ Parallelism: 1          │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
      │
      ▼
  Master Key (32 bytes)
      │
      ├──► BLAKE2b(master, "app1_id") ──► DEK₁ ──► Encrypt(secrets₁)
      │
      ├──► BLAKE2b(master, "app2_id") ──► DEK₂ ──► Encrypt(secrets₂)
      │
      └──► BLAKE2b(master, "appN_id") ──► DEKₙ ──► Encrypt(secretsₙ)
```

## Password-Based Key Derivation

### Algorithm: Argon2id

Argon2id is the recommended password hashing algorithm per OWASP guidelines. It provides:

- **Memory-hardness**: Resists GPU/ASIC attacks
- **Time-hardness**: Configurable iteration count
- **Side-channel resistance**: Argon2id variant

### Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Algorithm | Argon2id | OWASP recommended, hybrid of Argon2i and Argon2d |
| Memory | 64 MiB | Balance of security and browser performance |
| Iterations | 3 | OWASP recommended minimum |
| Parallelism | 1 | Single-threaded for browser compatibility |
| Output Length | 32 bytes | Full AES-256 key length |
| Salt Length | 16 bytes | libsodium default (crypto_pwhash_SALTBYTES) |

### Salt Management

- Generated using `sodium.randombytes_buf()` (cryptographically secure)
- Stored in IndexedDB alongside encrypted data
- Included in exports (required for decryption on import)
- New salt generated on password change

## Data Encryption Key (DEK) Derivation

### Algorithm: crypto_generichash (BLAKE2b keyed hash)

Each app's secrets are encrypted with a unique DEK derived from the master key. This provides:

- **Isolation**: Compromise of one DEK doesn't expose others
- **Determinism**: Same master key + app ID always produces same DEK
- **Non-storage**: DEKs are never stored, only derived on-demand

### Derivation Process

```
DEK = crypto_generichash(
    output_length: 32 bytes,
    message: app_id (UTF-8 encoded),
    key: master_key (32 bytes)
)
```

### Properties

- **Algorithm**: BLAKE2b with keyed mode (MAC construction)
- **Domain Separation**: Each app ID produces a cryptographically distinct DEK
- **Output**: 32-byte key suitable for crypto_secretbox

## Authenticated Encryption

### Algorithm: XSalsa20-Poly1305 (crypto_secretbox)

Combined authenticated encryption providing:

- **Confidentiality**: XSalsa20 stream cipher (256-bit key, 192-bit nonce)
- **Integrity**: Poly1305 MAC (128-bit tag)
- **Authentication**: Ciphertext cannot be modified without detection

### Parameters

| Parameter | Value |
|-----------|-------|
| Key Length | 32 bytes |
| Nonce Length | 24 bytes |
| MAC Length | 16 bytes (prepended to ciphertext) |

### Nonce Generation

- Generated using `sodium.randombytes_buf()` (cryptographically secure)
- 24-byte nonce provides sufficient space to avoid collisions
- New random nonce for each encryption operation
- Stored alongside ciphertext

## Storage

### Backend: IndexedDB

IndexedDB was chosen over localStorage for:

- **Binary Storage**: No base64 encoding overhead
- **Larger Limits**: 50+ MB vs 5-10 MB
- **Async API**: Non-blocking operations
- **Structured Data**: Native object storage

### Database Schema

```
Database: "lifecycle-secrets"
Version: 1

Object Store: "secrets"
  Key Path: "key"

Entries:
  {
    key: "salt",
    data: Uint8Array(16)  // Argon2id salt
  }
  {
    key: "app:{appId}",
    data: Uint8Array,     // Ciphertext
    nonce: Uint8Array(24) // Encryption nonce
  }
```

### Data at Rest

| Field | Storage | Sensitivity |
|-------|---------|-------------|
| Salt | IndexedDB | Public (required for KDF) |
| Nonce | IndexedDB | Public (required for decryption) |
| Ciphertext | IndexedDB | Encrypted (requires password) |

## Key Lifecycle

### Creation

1. User enters password for first time
2. Random salt generated via `randombytes_buf()`
3. Master key derived via Argon2id
4. Salt stored in IndexedDB
5. Master key held in memory while unlocked

### Usage (Encrypt)

1. Derive DEK from master key + app ID
2. Generate random nonce
3. Encrypt secrets with DEK + nonce
4. Store ciphertext + nonce in IndexedDB
5. Zero DEK from memory
6. Cache plaintext in memory for subsequent access

### Usage (Decrypt) - On-Demand with Caching

Secrets are **not** decrypted when the vault is unlocked. Instead, they are decrypted on-demand when first accessed:

1. **Unlock**: 
   - Verify password by decrypting one secret
   - Derive master key from password + salt
   - Hold master key in memory
   - **Save encrypted master key to sessionStorage** (for persistence across refresh)
2. **Page Refresh**: 
   - Restore master key from sessionStorage (if available)
   - Automatically unlock if session is valid
3. **First Access**: When a secret is needed:
   - Load ciphertext + nonce from IndexedDB
   - Derive DEK from master key + app ID
   - Decrypt and authenticate ciphertext
   - Zero DEK from memory
   - **Cache** decrypted secret in memory
3. **Subsequent Access**: Return cached secret (no decryption)
4. **Lock**: Clear cache, zero master key, and clear sessionStorage

This approach:
- Reduces unlock time (no bulk decryption)
- Minimizes plaintext in memory (only accessed secrets are decrypted)
- Avoids repeated expensive decryption operations via caching

### Destruction

1. Clear IndexedDB (salt + all encrypted data)
2. Clear sessionStorage (encrypted master key)
3. Zero master key from memory
4. Clear secrets cache from memory

### Password Change

1. Verify current password
2. Decrypt all secrets (loading any not already cached)
3. Generate new random salt
4. Derive new master key from new password + new salt
5. Re-encrypt all secrets with new DEKs
6. Store new salt + ciphertext
7. Update sessionStorage with new encrypted master key
8. Zero old master key from memory

## Memory Security

### What's Held in Memory

While unlocked, the following is held in memory:

| Data | When | Cleared |
|------|------|---------|
| Master Key | Always while unlocked | On lock/auto-lock |
| DEKs | During encrypt/decrypt only | Immediately after use |
| Plaintext Secrets | Only after first access (cached) | On lock/auto-lock |

**Session Storage:**
- Encrypted master key (in `sessionStorage`) - Persists across page refresh, cleared on tab close
- Session key (in `sessionStorage`) - Used to decrypt master key on refresh

Secrets are decrypted on-demand and cached for performance. This means:
- Only accessed secrets are ever in memory as plaintext
- Unused secrets remain encrypted in IndexedDB

### Auto-Lock

The vault automatically locks after **15 minutes** of inactivity to minimize exposure:

- Timer starts when vault is unlocked
- Timer resets on successful webhook send
- On timeout: master key zeroed, secrets cache cleared
- Encrypted data remains in IndexedDB for next unlock

### Session Persistence

The unlocked state persists across page refreshes using `sessionStorage`:

**How it works:**
1. On unlock: Master key is encrypted with a random session key using XSalsa20-Poly1305
2. Both encrypted master key and session key are stored in `sessionStorage`
3. On page refresh: Encrypted master key is decrypted and vault is automatically unlocked
4. On tab close: `sessionStorage` is cleared by the browser, requiring password re-entry

**Storage Format:**
```json
{
  "key": "base64-encoded-session-key",
  "nonce": "base64-encoded-nonce",
  "encrypted": "base64-encoded-encrypted-master-key"
}
```

**Security Properties:**
- **Survives**: Page refresh, navigation within the same tab
- **Cleared**: When tab/window closes, on explicit lock, or on password change
- **Encryption**: Master key encrypted with random session key (not password-derived)
- **XSS Risk**: If XSS occurs while unlocked, attacker could extract session key and maintain access until tab closes

**Tradeoff:**
This is a UX vs security tradeoff. The incremental XSS risk is minimal because:
- CSP blocks most XSS vectors
- Localhost-only operation limits attack surface
- Session ends when tab closes (unlike localStorage which persists)
- Auto-lock still applies (15-minute timeout)

### Sensitive Data Zeroing

libsodium's `sodium.memzero()` is used to clear:

- Master key (on lock, password change, or auto-lock timeout)
- DEKs (after each encryption/decryption)
- Any temporary key material

### Limitations

JavaScript does not guarantee memory zeroing due to:

- Garbage collection timing
- JIT compiler optimizations
- String interning

The implementation uses `memzero()` as a best-effort measure. The secrets cache (JavaScript object) cannot be securely zeroed.

## Export/Import Format

### Version 3 Format (Current)

```json
{
  "version": 3,
  "salt": "base64-encoded-salt",
  "apps": {
    "app_id_1": {
      "nonce": "base64-encoded-nonce",
      "ciphertext": "base64-encoded-ciphertext"
    }
  }
}
```

### Properties

- **Portable**: JSON format, base64 encoding for binary data
- **Self-contained**: Includes all data needed to decrypt (except password)
- **Versioned**: Version field enables future format changes

### Security Notes

- Export files should be treated as sensitive
- Password is still required to decrypt
- Salt is included (not secret, but unique per export)

## Related Security Documentation

For XSS protection, Content Security Policy, security headers, and other non-cryptographic security measures, see [SECURITY.md](./SECURITY.md).

## Implementation Files

| File | Purpose |
|------|---------|
| `src/ui/crypto/secrets-crypto.ts` | Core cryptographic operations |
| `src/ui/crypto/storage.ts` | IndexedDB storage wrapper |
| `src/ui/stores/secrets-store.ts` | Secrets state management |

## Compliance References

- **OWASP Password Storage Cheat Sheet**: Argon2id parameters
- **NIST SP 800-132**: Password-based key derivation
- **RFC 8439**: ChaCha20-Poly1305 (similar construction to XSalsa20-Poly1305)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 3 | 2026-01 | libsodium + Argon2id + IndexedDB |
| 2 | 2025 | Web Crypto API + envelope encryption (deprecated) |
| 1 | 2025 | Web Crypto API + single blob (deprecated) |

## Contact

For security concerns or questions about this implementation, please open an issue on the project repository.
