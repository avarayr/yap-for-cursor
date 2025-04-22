/**
 * Register a global hotkey for the given key combination.
 * DOM compatible for modern browsers (primarily Chrome).
 * If a hotkey with the same key and target is already registered,
 * the old callback will be replaced with the new one.
 *
 * @param key The key or key combination to listen for (e.g., 'a', 'Shift+A', 'Control+Alt+Delete')
 * @param callback The function to execute when the hotkey is triggered
 * @param options Optional configuration for the hotkey behavior
 * @returns A function that can be called to unregister the hotkey
 */

// Store registered hotkeys to prevent duplicates and allow replacement
interface HotkeyRegistration {
  target: HTMLElement | Document;
  handler: EventListener;
  unregister: () => void;
}
const registeredHotkeys: Map<string, HotkeyRegistration> = new Map();

// Generate a unique identifier for a hotkey configuration
function getHotkeyId(key: string, target: HTMLElement | Document): string {
  return `${key}:${target === document ? "document" : "element"}`;
}

export function registerHotkey(
  key: string,
  callback: (event: KeyboardEvent) => void,
  options: {
    target?: HTMLElement | Document;
    preventDefault?: boolean;
    stopPropagation?: boolean;
    allowInInputs?: boolean;
  } = {}
): () => void {
  const {
    target = document,
    preventDefault = true,
    stopPropagation = true,
    allowInInputs = true,
  } = options;

  // Parse the key combination
  const keys = key.split("+").map((k) => k.trim().toLowerCase());
  const mainKey = keys[keys.length - 1];
  const modifiers = {
    ctrl: keys.includes("ctrl") || keys.includes("control"),
    alt: keys.includes("alt"),
    shift: keys.includes("shift"),
    meta:
      keys.includes("meta") || keys.includes("command") || keys.includes("cmd"),
  };

  // Generate a unique ID for this hotkey configuration
  const hotkeyId = getHotkeyId(key, target);

  // If this exact hotkey (key + target) is already registered, unregister the old one first.
  if (registeredHotkeys.has(hotkeyId)) {
    const existingRegistration = registeredHotkeys.get(hotkeyId)!;
    existingRegistration.unregister(); // This removes the old listener and cleans the map entry
  }

  // Define the event handler function for this registration
  // This closure captures the *new* callback
  const handler = (event: KeyboardEvent) => {
    // Skip if we're in an input and that's not allowed
    if (!allowInInputs && isInputElement(event.target as HTMLElement)) {
      return;
    }

    // Check if the event matches our hotkey
    const keyMatch = event.key.toLowerCase() === mainKey.toLowerCase();
    const ctrlMatch = event.ctrlKey === modifiers.ctrl;
    const altMatch = event.altKey === modifiers.alt;
    const shiftMatch = event.shiftKey === modifiers.shift;
    const metaMatch = event.metaKey === modifiers.meta;

    if (keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch) {
      if (preventDefault) {
        event.preventDefault();
      }
      if (stopPropagation) {
        event.stopPropagation();
      }
      // Execute the latest registered callback
      callback(event);
    }
  };

  // Define the unregister function for *this specific* registration
  const unregister = () => {
    target.removeEventListener("keydown", handler as EventListener, {
      capture: true,
    });
    // Remove this registration from the map
    registeredHotkeys.delete(hotkeyId);
  };

  // Register the new event listener
  target.addEventListener("keydown", handler as EventListener, {
    capture: true,
  });

  // Store the details of this registration, including its unregister function
  registeredHotkeys.set(hotkeyId, {
    target,
    handler: handler as EventListener,
    unregister,
  });

  // Return the unregister function for external use
  return unregister;
}

/**
 * Checks if the element is an input element where hotkeys should be ignored by default
 */
function isInputElement(element: HTMLElement | null): boolean {
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();
  const isContentEditable = element.getAttribute("contenteditable") === "true";

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    isContentEditable
  );
}
