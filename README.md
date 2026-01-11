# Monday Lifecycle Webhook Mock Tool

An interactive web UI tool for generating and sending mock Monday.com lifecycle webhook events with properly signed JWTs for testing webhook handlers.

## Features

- **Interactive Web UI**: Pure frontend application built with Vite
- **State Management**: Tracks subscription state per account/app to maintain realistic renewal dates
- **All 12 Event Types**: Supports all Monday.com lifecycle webhook events
- **JWT Signing**: Generates properly signed JWTs using client secret
- **State Persistence**: Uses localStorage to persist state across sessions
- **Lifecycle Flow Support**: Handles complex flows like trial → free/paid transitions

## Installation

```bash
pnpm install
```

## Usage

### Start Development Server

```bash
pnpm dev
```

This will start the Vite dev server and open your browser to `http://localhost:5173`.

### Using the Tool

1. **Load Configuration**:
   - Upload a JSON config file or paste it into the textarea
   - Click "Load Config" to load the configuration

2. **Configure Event**:
   - Select event type from dropdown
   - Enter webhook URL (required)
   - Fill in app ID, account ID, pricing version, plan, etc.
   - Enter client secret for JWT signing

3. **Preview**:
   - The preview section shows the generated event payload
   - JWT preview is shown when client secret is provided

4. **Send Webhook**:
   - Click "Send Webhook" to send the event to your endpoint
   - Response status and message are displayed
   - State is automatically updated after sending

5. **View State**:
   - Current state for the account/app is displayed
   - Click "Reset State" to clear state for testing

## Configuration Format

The tool expects a JSON configuration file with the following structure:

```json
{
  "apps": {
    "1234567890": {
      "app_id": "1234567890",
      "app_name": "Test App",
      "hasFreePlan": true,
      "hasTrialPlan": true
    }
  },
  "plans": {
    "5": {
      "plan1": {
        "plan_id": "plan1",
        "isFree": false,
        "isTrial": false,
        "price": 29.99
      },
      "plan2": {
        "plan_id": "plan2",
        "isFree": true,
        "isTrial": false,
        "price": 0
      },
      "trial_plan": {
        "plan_id": "trial_plan",
        "isFree": false,
        "isTrial": true,
        "price": 0
      }
    }
  }
}
```

### Configuration Fields

- **apps**: App-level configuration
  - `app_id`: Monday.com app ID
  - `app_name`: App name
  - `hasFreePlan`: Whether app supports free plans
  - `hasTrialPlan`: Whether app supports trial plans

- **plans**: Plan configuration by pricing version
  - Keys are pricing version numbers (as strings)
  - Values are objects keyed by `plan_id`
  - Each plan has:
    - `plan_id`: Plan identifier
    - `isFree`: Whether this is a free plan
    - `isTrial`: Whether this is a trial plan
    - `price`: Plan price (for upgrade/downgrade detection)

## Event Flow Patterns

### Initial Installation

- **App with Trial**: `install` → `app_trial_subscription_started`
- **App with Free Plan**: `install` → Free plan (renewal_date = 10 years)
- **App with Paid Only**: `install` → `app_subscription_created`

### Trial Transitions

- **Trial → Free**: `app_trial_subscription_ended` (trial plan in event data)
- **Trial → Paid**: `app_subscription_created` (NO `app_trial_subscription_ended`)

### Subscription Changes

- **Upgrades**: Immediate, renewal_date stays same
- **Downgrades (monthly)**: Sent at renewal_date, renewal_date changes
- **Downgrades (yearly)**: Immediate, renewal_date changes

### Cancellation

- **User Cancels**: `app_subscription_cancelled_by_user` (renewal_date stays same)
- **Cancellation Takes Effect**: `app_subscription_cancelled` at renewal_date (renewal_date becomes null)
- **Cancellation Revoked**: `app_subscription_cancellation_revoked_by_user` (restores renewal_date)

### Renewal Failures

- **Renewal Attempt Fails**: `app_subscription_renewal_attempt_failed` (may also receive `app_subscription_renewed` due to async payments)
- **Final Failure**: `app_subscription_renewal_failed` (renewal_date becomes null, no cancelled event)

### Uninstall/Reinstall

- **Uninstall**: Marks subscription as `cancelled_by_user` (won't renew)
- **Reinstall**: `install` can be sent again, but does NOT reactivate renewals

## Special Behaviors

### Renewal Date Logic

- **Free plans**: `renewal_date = now + 10 years`
- **Trial plans**: `renewal_date = now + 14 days`
- **Paid plans**: `renewal_date = now + billing_period`
- **Cancelled**: `renewal_date = null`
- **Subscription changed**: Upgrades keep same renewal_date, downgrades may change it

### State Tracking

The tool tracks subscription state per account/app combination:

- `plan_id`: Current plan
- `previous_plan_id`: Previous plan (for upgrade/downgrade detection)
- `renewal_date`: Current renewal date (ISO string or null)
- `pricing_version`: Current pricing version
- `billing_period`: Current billing period
- `subscription_type`: "paid" | "trial" | "free"
- `is_active`: Whether subscription is active
- `cancelled_by_user`: Whether marked for cancellation
- `app_has_free_plan`: Whether app supports free plans
- `app_has_trial_plan`: Whether app supports trial plans

State is persisted in localStorage and persists across browser sessions.

## Development

```bash
# Type check
pnpm check-types

# Build
pnpm build

# Preview production build
pnpm preview
```

## Dependencies

- `@tmm/schema-monday`: Monday.com lifecycle schemas
- `jose`: JWT signing
- `zod`: Schema validation
- `vite`: Development server and build tool

## License

UNLICENSED
