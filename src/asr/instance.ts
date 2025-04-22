import type { AsrInstance } from "../types";

declare global {
  interface Window {
    _currentAsrInstance?: AsrInstance | null;
  }
}

/**
 * Sets the current global ASR instance.
 */
export function setCurrentAsrInstance(instance: AsrInstance | null) {
  window._currentAsrInstance = instance;
}

/**
 * Gets the current global ASR instance.
 */
export function getCurrentAsrInstance(): AsrInstance | null {
  return window._currentAsrInstance ?? null;
}
