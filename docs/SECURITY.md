# Security Documentation

This document describes the security architecture and considerations for the Monday Lifecycle Webhook Mock Tool.

## Overview

This is a **local development tool** designed to simulate monday.com webhook lifecycle events. It runs exclusively on `localhost` and is not intended for production deployment or multi-user environments.

## Threat Model

### Threats Addressed

| Threat | Mitigation |
|--------|------------|
| Secrets at Rest | Encrypted in IndexedDB (see [CRYPTOGRAPHY.md](./CRYPTOGRAPHY.md)) |
| Cross-Site Scripting (XSS) | Strict CSP, localhost-only operation |
| Clickjacking | `frame-ancestors 'none'`, `X-Frame-Options: DENY` |
| MIME Sniffing | `X-Content-Type-Options: nosniff` |
| CORS Issues | Server-side webhook proxy |

### Out of Scope

| Threat | Reason |
|--------|--------|
| Multi-user Access Control | Single-user local tool |
| Network Attacks | Localhost-only; no remote access |
| Physical Access | Browser storage accessible to device owner |
| XSS While Unlocked | If attacker can execute JS, they can use unlocked APIs |

## Single-User Design

**Important:** The secrets vault uses a **single password** for all stored secrets. This tool does **not** support:

- Multiple users with unique passwords
- Role-based access control
- Password sharing or delegation
- Session management across users

This design decision was intentional—implementing multi-user authentication adds significant complexity that is inappropriate for a local development tool. If you need multi-user access to webhook testing, consider:

- Running separate instances per user
- Using a proper secrets management system (e.g., HashiCorp Vault)
- Sharing only the application config (without encrypted secrets)

## XSS Protection

### Localhost-Only Operation

This tool is designed to run exclusively on localhost, which provides inherent protections:

- **Same-Origin Policy**: External websites cannot access localStorage/IndexedDB on localhost
- **No Remote Injection**: External sites cannot inject scripts into the localhost origin
- **Controlled Environment**: User has full control over what runs locally

### Content Security Policy (CSP)

A strict CSP is enforced via both HTML meta tag and server headers:

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
connect-src 'self' https: wss:;
worker-src 'self' blob:;
img-src 'self' data:;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
```

**Protections:**

| Directive | Protection |
|-----------|------------|
| `script-src 'self' 'wasm-unsafe-eval'` | Only bundled scripts + WebAssembly (for libsodium) |
| `object-src 'none'` | No Flash/plugins |
| `frame-ancestors 'none'` | Prevents clickjacking (HTTP header only) |
| `connect-src ... https:` | Webhooks must use HTTPS |

**Note:** `'wasm-unsafe-eval'` is required for libsodium's WebAssembly module. This is narrower than `'unsafe-eval'` and only allows WebAssembly compilation, not JavaScript eval().

### Additional Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Additional clickjacking protection |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage |

### Framework Protections

- **Svelte**: Automatic HTML escaping in templates
- **No `innerHTML`**: Application avoids direct DOM manipulation with untrusted data

## Webhook Proxy (CORS Bypass)

### Background

When sending webhooks from a browser, Cross-Origin Resource Sharing (CORS) restrictions may block requests to external servers that don't include appropriate CORS headers.

In production, **monday.com sends webhooks from their backend servers** where CORS is not a concern—it's a browser-only security mechanism.

### Implementation

To accurately simulate real-world webhook delivery, this tool includes a **Vite dev server proxy** that forwards webhook requests server-side:

```
Browser                    Vite Dev Server              Target Server
   │                            │                            │
   │  POST /api/webhook-proxy   │                            │
   │  {targetUrl, payload, jwt} │                            │
   │ ─────────────────────────► │                            │
   │                            │  POST {targetUrl}          │
   │                            │  Authorization: {jwt}      │
   │                            │  Body: {payload}           │
   │                            │ ─────────────────────────► │
   │                            │                            │
   │                            │  ◄───── Response ───────── │
   │                            │                            │
   │  ◄──── Proxied Response ── │                            │
   │                            │                            │
```

### Security Considerations

| Aspect | Implementation |
|--------|----------------|
| Request Validation | Requires `targetUrl`, `payload`, and `jwt` |
| No Open Relay | Only available during local development |
| Protocol Restriction | CSP restricts webhooks to HTTPS targets |
| No Credential Storage | Proxy only forwards; doesn't store requests |

### Why Not Direct Fetch?

Direct browser `fetch()` to external URLs fails when:

1. Target server doesn't send `Access-Control-Allow-Origin` header
2. Target server doesn't allow the `Authorization` header via `Access-Control-Allow-Headers`
3. Preflight `OPTIONS` requests are rejected

The proxy eliminates these issues by making requests from Node.js where CORS doesn't apply.

## Implementation Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | CSP headers, webhook proxy middleware |
| `src/ui/index.html` | CSP meta tag (backup) |
| `src/ui/crypto/secrets-crypto.ts` | Core cryptographic operations |
| `src/ui/crypto/storage.ts` | IndexedDB storage wrapper |
| `src/ui/stores/secrets-store.ts` | Secrets state management |
| `src/core/http-sender.ts` | Webhook sending via proxy |

## Related Documentation

- [CRYPTOGRAPHY.md](./CRYPTOGRAPHY.md) - Detailed cryptographic implementation

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01 | Initial security documentation |
