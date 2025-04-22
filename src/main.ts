import { getCurrentAsrInstance, setCurrentAsrInstance } from "./asr/instance";
import {
  globalAsrMessage as currentAsrMessage,
  initializeASRSystem,
} from "./asr/manager";
import * as CONFIG from "./config";
import type {
  AsrResultDetail,
  AsrStatusUpdateDetail,
  MicButtonElement,
} from "./types";
import { DOM_SELECTORS } from "./ui/dom-selectors";
import { setupMicButtonObserver, updateMicButtonState } from "./ui/mic-button";

// Define navigator with gpu property
interface NavigatorWithGPU extends Navigator {
  gpu?: unknown;
}
declare const navigator: NavigatorWithGPU;

(function () {
  "use strict";

  setCurrentAsrInstance(null);

  // --- Check WebGPU Support ---
  if (!navigator.gpu) {
    console.warn("WebGPU not supported on this browser. ASR will not work.");
  }

  // --- Load Transformers.js dynamically ---
  let transformersLibLoaded = typeof window.transformers !== "undefined";

  if (!transformersLibLoaded && typeof require !== "undefined") {
    const scriptId = "hf-transformers-script";
    if (!document.getElementById(scriptId)) {
      console.log("Loading Hugging Face Transformers library...");
      const script = document.createElement("script");
      script.id = scriptId;
      script.type = "module";
      script.textContent = `
              console.log('[ASR] Injected script block executing...');
              console.log('[ASR] Attempting to load Transformers library...');
              try {
                  const { ${[
                    "AutoTokenizer",
                    "AutoProcessor",
                    "WhisperForConditionalGeneration",
                    "TextStreamer",
                    "full",
                    "env",
                  ].join(
                    ","
                  )} } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@${
        CONFIG.HUGGING_FACE_TRANSFORMERS_VERSION
      }');
                  console.log('[ASR] Transformers library imported successfully.');
                  window.transformers = { AutoTokenizer, AutoProcessor, WhisperForConditionalGeneration, TextStreamer, full, env };
                  window.transformers.env.backends.onnx.logLevel = 'info';
                  console.log('[ASR] Transformers library loaded and configured.');
                  document.dispatchEvent(new CustomEvent('transformersLoaded'));
              } catch (error) {
                  console.error("[ASR] Failed to load Hugging Face Transformers library:", error);
              }
          `;
      document.head.appendChild(script);
    }
  } else if (transformersLibLoaded && window.transformers) {
    window.transformers.env.backends.onnx.logLevel = "info";
  }

  console.log("Initializing ASR system...");
  // Initialize the ASR system (creates worker, checks WebGPU, etc.)
  initializeASRSystem();
  console.log("ASR system initialized");

  // --- All Worker/UI/Audio logic moved to respective modules ---

  // --- Global ASR Status Listener ---
  document.addEventListener("asrStatusUpdate", (e: Event) => {
    console.log(
      "[ASR] Received asrStatusUpdate event:",
      (e as CustomEvent).detail
    );
    const _event = e as CustomEvent<AsrStatusUpdateDetail>;
    // Update all mic buttons based on the new global state
    document
      .querySelectorAll<MicButtonElement>(".mic-btn[data-asr-init]")
      .forEach((btn) => updateMicButtonState(btn, btn.asrState || "idle")); // updateMicButtonState is now imported
  });

  // --- Global ASR Result Handler ---
  // Listens for results dispatched from asr/manager.ts
  if (!window._asrGlobalHandlerAttached) {
    // Store the last transcription to compare for incremental updates

    function globalAsrResultHandler(e: Event) {
      const event = e as CustomEvent<AsrResultDetail>;
      const { status, output = "", data } = event.detail;

      console.warn("[ASR] Received asrResult event:", event.detail);
      const asrInstance = getCurrentAsrInstance();
      if (!asrInstance) return;
      const { mic, chatInputContentEditable } = asrInstance;
      const currentMicState = mic.asrState;
      console.warn("Current mic state:", currentMicState);
      if (currentMicState === "transcribing") {
        if (status === "update") {
          /* generally we don't care about update chunks, but maybe we can do some fancy UI stuff? */
        } else if (status === "complete") {
          updateReactInput(chatInputContentEditable, output, false);

          updateMicButtonState(mic, "idle");
          chatInputContentEditable.focus();
        } else if (status === "error") {
          console.error("Transcription error:", data);
          updateMicButtonState(
            mic,
            "idle",
            `Error: ${data || "Unknown transcription error"}`
          );
        } else if (status === "transcribing_start") {
          // State is already transcribing
        }
      } else if (currentMicState === "idle" && status === "error") {
        updateMicButtonState(
          mic,
          "disabled",
          `ASR Error: ${data || currentAsrMessage}` // Use specific error or global one
        );
      }
    }
    document.addEventListener("asrResult", globalAsrResultHandler);
    window._asrGlobalHandlerAttached = true;
  }

  // --- Setup UI ---
  // Initialize the MutationObserver and inject styles via the imported function
  setupMicButtonObserver();

  // Set asrInstance after UI is initialized
  const mic = document.querySelector<MicButtonElement>(DOM_SELECTORS.micButton);
  const chatInputContentEditable = document.querySelector<HTMLDivElement>(
    DOM_SELECTORS.fullInputBox
  );
  if (mic && chatInputContentEditable) {
    setCurrentAsrInstance({ mic, chatInputContentEditable });
  }

  /**
   * Updates a React-controlled input by either replacing or appending text
   * @param element The input element to update
   * @param text The text to set/append
   * @param shouldReplace Whether to replace existing text (true) or append (false)
   */
  function updateReactInput(
    element: HTMLElement,
    text: string,
    shouldReplace: boolean = false
  ) {
    // Skip empty updates
    if (text === "") {
      return;
    }

    element.focus();

    if (shouldReplace) {
      // Don't update if nothing changed
      if (element.textContent === text) {
        return;
      }

      // Replace all content
      const selection = window.getSelection();
      const range = document.createRange();

      // Select all existing content
      range.selectNodeContents(element);
      selection?.removeAllRanges();
      selection?.addRange(range);

      // @ts-ignore - document.execCommand is deprecated - but it's the only way to update the input value that worked
      document.execCommand("insertText", false, text);
    } else {
      // Append mode - check if we need to add a space before appending
      const currentContent = element.textContent?.trim() || "";
      let textToAppend = text;

      // Add a space if:
      // 1. There's existing content
      // 2. The existing content doesn't already end with a space
      // 3. The new text doesn't start with a space
      if (currentContent.length > 0 && !text.startsWith(" ")) {
        textToAppend = " " + text;
      }

      // Move cursor to the end and insert
      const selection = window.getSelection();
      const range = document.createRange();

      // Place cursor at the end of content
      range.selectNodeContents(element);
      range.collapse(false); // false means collapse to end
      selection?.removeAllRanges();
      selection?.addRange(range);

      // @ts-ignore
      document.execCommand("insertText", false, textToAppend);
    }

    // Dispatch input event to ensure React knows about the change
    const inputEvent = new Event("input", { bubbles: true, cancelable: true });
    element.dispatchEvent(inputEvent);
  }
})(); // End of IIFE
