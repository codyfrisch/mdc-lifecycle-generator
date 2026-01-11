/**
 * Event form state management
 * Persists event configuration fields (event-type, pricing-version, plan-id, billing-period, reason, client-secret)
 */

const STORAGE_KEY = "lifecycle_webhook_event_form_state";

export type EventFormState = {
  event_type: string;
  pricing_version: string;
  plan_id: string;
  billing_period: string;
  renewal_date: string; // datetime-local format, can be empty string
  reason: string;
  // client_secret is NOT stored - session only
};

/**
 * Save event form state to localStorage
 */
export function saveEventFormState(state: EventFormState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to save event form state to localStorage:", error);
  }
}

/**
 * Load event form state from localStorage
 */
export function loadEventFormState(): EventFormState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as EventFormState;
  } catch {
    return null;
  }
}

/**
 * Clear event form state from localStorage
 */
export function clearEventFormState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear event form state from localStorage:", error);
  }
}
