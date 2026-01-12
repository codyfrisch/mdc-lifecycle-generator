import { type Writable, writable } from "svelte/store";

/**
 * Modal open/closed state
 */
export const isConfigModalOpen: Writable<boolean> = writable<boolean>(false);

/**
 * Open the config modal
 */
export function openConfigModal(): void {
  isConfigModalOpen.set(true);
}

/**
 * Close the config modal
 */
export function closeConfigModal(): void {
  isConfigModalOpen.set(false);
}

/**
 * Toggle the config modal
 */
export function toggleConfigModal(): void {
  isConfigModalOpen.update((value) => !value);
}
