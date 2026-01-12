# Monday Lifecycle Webhook Mock Tool

A browser-based development tool for generating and sending mock Monday.com lifecycle webhook events with properly signed JWTs for testing webhook handlers.

> **⚠️ DISCLAIMER**
> 
> This tool is provided "AS IS" without warranty of any kind. Use at your own risk. The authors are not responsible for any damages, data loss, or security issues that may arise from using this tool. This is a development/testing utility and should not be used in production environments. Always verify webhook implementations with official Monday.com documentation.

## Features

- **Interactive Web UI**: Pure frontend application built with Svelte and Vite
- **Secure Secret Storage**: Client secrets are encrypted in IndexedDB using libsodium (Argon2id + XSalsa20-Poly1305)
- **Event Configurations**: Save and reuse test configurations for different event scenarios
- **Multi-App/Account Support**: Manage multiple apps and accounts with separate configurations
- **All 12 Event Types**: Supports all Monday.com lifecycle webhook events
- **JWT Signing**: Generates properly signed JWTs using your app's client secret
- **Live Preview**: See the event payload and JWT claims before sending
- **HTTPS by Default**: Dev server runs on HTTPS for secure local development
- **Webhook Proxy**: Server-side proxy bypasses CORS restrictions (dev server only)

## Installation

```bash
pnpm install
```

## Usage

### Start Development Server

```bash
pnpm dev
```

This starts the Vite dev server at `https://localhost:5173` (HTTPS with self-signed certificate).

> **⚠️ IMPORTANT**: This tool **must** run via `pnpm dev` (Vite dev server), not as a production build. The webhook proxy middleware that bypasses CORS restrictions only runs in development mode. Production builds will fail to send webhooks due to CORS.

### Initial Setup

1. **Open the Settings** (gear icon in header)

2. **Add an App**:
   - Click "Add App" in the Apps tab
   - Enter App ID, Client ID, App Name, and Webhook URL
   - Add pricing versions with their plans
   - Unlock secrets and add your Client Secret

3. **Add an Account**:
   - Switch to the Accounts tab
   - Click "Add Account"
   - Enter Account ID, User ID, and other account details

4. **Unlock Secrets**:
   - Click "Locked" button in the header
   - Set an encryption password (first time) or enter your existing password
   - This decrypts your stored secrets for use

### Creating Event Configurations

1. **Select App and Account** from the dropdowns at the top of the main page

2. **Create a Configuration**:
   - Click the "+" button in the sidebar
   - Give it a descriptive name (e.g., "Install Flow", "Upgrade to Pro")
   - Select event type, pricing version, plan, billing period
   - Optionally set renewal date and reason

3. **Preview the Event**:
   - The Event Payload section shows the webhook body
   - The JWT Payload section shows the claims that will be signed

4. **Send the Webhook**:
   - Click "Send Webhook"
   - View the response status in the message area
   - Check the History section for past sends

### Managing Configurations

- **Duplicate**: Hover over a config and click the copy icon to create a copy
- **Delete**: Hover over a config and click the trash icon
- **Edit**: Click on any config to select and edit it
- **Auto-save**: Changes are automatically saved as you edit

### Import / Export

Use the Import/Export buttons in Settings to backup and restore your configuration:

**Exported data includes:**
- Apps (IDs, names, webhook URLs, pricing versions, plans)
- Accounts (IDs, names, user info)
- Event configurations (all saved test scenarios)
- Encrypted secrets (still requires your password to decrypt)

**Notes:**
- Secrets remain encrypted in the export file - they're useless without your password
- Importing merges with existing data (doesn't overwrite)
- If you import encrypted secrets, you'll need to unlock with the **same password** used when they were encrypted

## Security

### Secret Encryption

Client secrets are encrypted using industry-standard cryptographic primitives:
- **Key Derivation**: Argon2id (64 MiB memory, 3 iterations) - OWASP recommended
- **DEK Derivation**: BLAKE2b keyed hash for per-app key isolation
- **Encryption**: XSalsa20-Poly1305 (authenticated encryption)
- **Storage**: Encrypted secrets stored in IndexedDB, separate from app configuration
- **On-Demand Decryption**: Secrets are decrypted only when accessed, not all at once

The encryption password is never stored. If you forget it, you'll need to clear secrets and re-enter them.

See [docs/CRYPTOGRAPHY.md](./docs/CRYPTOGRAPHY.md) and [docs/SECURITY.md](./docs/SECURITY.md) for detailed security documentation.

### Best Practices

- Use a strong encryption password (12+ characters, mixed case, numbers, symbols)
- Lock secrets when not actively testing
- Don't share your browser profile with others
- Consider this tool appropriate for development secrets only

## Event Types

The tool supports all Monday.com lifecycle webhook events:

| Event | Description |
|-------|-------------|
| `install` | App installed on an account |
| `uninstall` | App uninstalled from an account |
| `app_subscription_created` | New paid subscription started |
| `app_subscription_changed` | Plan or billing period changed |
| `app_subscription_renewed` | Subscription successfully renewed |
| `app_subscription_cancelled_by_user` | User initiated cancellation |
| `app_subscription_cancelled` | Cancellation took effect |
| `app_subscription_cancellation_revoked_by_user` | User revoked cancellation |
| `app_subscription_renewal_attempt_failed` | Renewal payment failed (retrying) |
| `app_subscription_renewal_failed` | Renewal permanently failed |
| `app_trial_subscription_started` | Trial period started |
| `app_trial_subscription_ended` | Trial period ended |

## Development

```bash
# Start dev server (HTTPS) - REQUIRED for webhook proxy
pnpm dev

# Type check
pnpm check-types

# Lint
pnpm lint
```

> **Note**: This tool only runs in development mode via `pnpm dev`. Production builds are not supported because the webhook proxy middleware that bypasses CORS restrictions only runs in the Vite dev server.

## Data Storage

App configuration and event configs are stored in browser localStorage:

| Key | Description |
|-----|-------------|
| `lifecycle_webhook_apps` | App configurations (no secrets) |
| `lifecycle_webhook_accounts` | Account configurations |
| `lifecycle_webhook_event_configs` | Saved event configurations |
| `lifecycle_webhook_history_*` | Webhook send history (per account/app) |

Encrypted secrets are stored in IndexedDB:

| Database | Store | Description |
|---------|-------|-------------|
| `lifecycle-secrets` | `secrets` | Encrypted client secrets (binary format) |
| `lifecycle-secrets` | `secrets` (key: `salt`) | Argon2id salt for key derivation |

**Note**: HTTP and HTTPS origins have separate storage. Data from `http://localhost:5173` is not accessible from `https://localhost:5173`.

## Dependencies

- **svelte**: UI framework
- **jose**: JWT signing
- **zod**: Schema validation
- **vite**: Development server and build tool
- **@vitejs/plugin-basic-ssl**: HTTPS for development
- **libsodium-wrappers-sumo**: Cryptographic operations (Argon2id, XSalsa20-Poly1305)
- **idb**: IndexedDB wrapper for encrypted secrets storage

## License

MIT

---

*This tool is not affiliated with or endorsed by Monday.com. Use responsibly.*
