import { getCurrentAsrInstance, setCurrentAsrInstance } from "./asr/instance";
import { initializeASRSystem } from "./asr/manager";
import * as CONFIG from "./config";
import type {
  AsrResultDetail,
  AsrStatusUpdateDetail,
  MicButtonElement,
  MicButtonState,
  AsrManagerState,
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
  initializeASRSystem();
  console.log("ASR system initialized");

  // --- Global ASR Status Listener (Updated) ---
  document.addEventListener("asrStatusUpdate", (e: Event) => {
    const event = e as CustomEvent<AsrStatusUpdateDetail>;
    const managerState = event.detail.state;
    const message = event.detail.message;
    console.log(
      `[ASR] Received asrStatusUpdate: State=${managerState}, Msg=${message}`
    );

    let targetMicState: MicButtonState;
    switch (managerState) {
      case "uninitialized":
      case "ready":
      case "error":
        targetMicState = "idle";
        break;
      case "initializing":
      case "loading_model":
      case "warming_up":
        targetMicState = "disabled";
        break;
      default:
        console.warn(
          "[ASR] Unhandled manager state in status listener:",
          managerState
        );
        targetMicState = "idle";
    }

    if (managerState === "error") {
      console.error(
        "[ASR System Error]:",
        message || "Unknown ASR system error"
      );
    }

    document
      .querySelectorAll<MicButtonElement>(".mic-btn[data-asr-init]")
      .forEach((btn) => {
        if (btn.asrState !== targetMicState) {
          updateMicButtonState(btn, targetMicState);
        }
      });
  });

  // --- Global ASR Result Handler ---
  if (!window._asrGlobalHandlerAttached) {
    let buffer = "";
    function globalAsrResultHandler(e: Event) {
      const event = e as CustomEvent<AsrResultDetail>;
      const { status, output = "", data } = event.detail;

      const asrInstance = getCurrentAsrInstance();
      if (!asrInstance) return;
      const { mic, chatInputContentEditable } = asrInstance;
      const currentMicState = mic.asrState;

      if (status === "transcribing_start") {
        updateMicButtonState(mic, "transcribing");
      } else if (status === "update") {
        buffer += output;
        if (currentMicState !== "transcribing") {
          updateMicButtonState(mic, "transcribing");
        }
      } else if (status === "complete") {
        updateReactInput(chatInputContentEditable, buffer, false);
        buffer = "";
        updateMicButtonState(mic, "idle");
        chatInputContentEditable.focus();
      } else if (status === "error") {
        console.error("Transcription error:", data);
        updateMicButtonState(
          mic,
          "idle",
          `Error: ${data || "Unknown transcription error"}`
        );
      }
    }
    document.addEventListener("asrResult", globalAsrResultHandler);
    window._asrGlobalHandlerAttached = true;
  }

  // --- Setup UI ---
  setupMicButtonObserver();

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
    if (text === "") {
      return;
    }

    element.focus();

    if (shouldReplace) {
      if (element.textContent === text) {
        return;
      }

      const selection = window.getSelection();
      const range = document.createRange();

      range.selectNodeContents(element);
      selection?.removeAllRanges();
      selection?.addRange(range);

      document.execCommand("insertText", false, text);
    } else {
      const currentContent = element.textContent?.trim() || "";
      let textToAppend = text;

      if (currentContent.length > 0 && !text.startsWith(" ")) {
        textToAppend = " " + text;
      }

      const selection = window.getSelection();
      const range = document.createRange();

      range.selectNodeContents(element);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);

      document.execCommand("insertText", false, textToAppend);
    }

    const inputEvent = new Event("input", { bubbles: true, cancelable: true });
    element.dispatchEvent(inputEvent);
  }
})();
