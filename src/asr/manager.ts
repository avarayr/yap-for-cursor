import type {
  AsrStatusUpdateDetail,
  WorkerMessage,
  WorkerResponse,
  AsrResultDetail,
  AsrManagerState,
  NavigatorWithMaybeGPU,
} from "../types";
import { fromScriptText } from "@aidenlx/esbuild-plugin-inline-worker/utils";
import WorkerCode from "worker:./worker.ts";

declare const navigator: NavigatorWithMaybeGPU;

// --- Refactored ASR State Management ---
let managerState: AsrManagerState = "uninitialized";
let managerMessage: string = "Click mic to initialize";
let worker: Worker | null = null;
let currentWorkerUrl: string | null = null;

/**
 * Updates the manager state and dispatches a global ASR status update event.
 */
function setManagerState(state: AsrManagerState, message?: string) {
  // Avoid redundant updates if state and message are the same
  if (state === managerState && message === managerMessage) {
    return;
  }
  console.log(
    `[ASR Manager] State changing: ${managerState} -> ${state}`,
    message ? `(${message})` : ""
  );
  managerState = state;

  // Determine user-facing message based on state
  switch (state) {
    case "uninitialized":
      managerMessage = message || "Click mic to initialize";
      break;
    case "initializing":
      managerMessage = message || "Initializing ASR...";
      break;
    case "loading_model":
      managerMessage = message || "Loading ASR model...";
      break;
    case "warming_up":
      managerMessage = message || "Preparing model...";
      break;
    case "ready":
      managerMessage = message || "ASR Ready";
      break;
    case "error":
      managerMessage = message || "ASR Error: Unknown";
      break;
    default:
      console.warn(
        "[ASR Manager] setManagerState called with unknown state:",
        state
      );
      managerMessage = "ASR Status Unknown";
  }

  // Dispatch the manager state directly
  console.log(
    `[ASR Manager] Dispatching asrStatusUpdate: { state: ${state}, message: ${managerMessage} }`
  );
  const detail: AsrStatusUpdateDetail = {
    state: state, // Use the AsrManagerState directly
    message: managerMessage,
  };
  document.dispatchEvent(
    new CustomEvent<AsrStatusUpdateDetail>("asrStatusUpdate", { detail })
  );
}

/**
 * Terminates the worker and resets the state.
 * @param errorMessage Optional error message to set.
 */
function cleanupWorker(errorMessage?: string) {
  console.warn(
    `[ASR Manager] Cleaning up worker. Error: ${errorMessage || "None"}`
  );
  if (worker) {
    worker.terminate();
    worker = null;
  }
  if (currentWorkerUrl) {
    URL.revokeObjectURL(currentWorkerUrl);
    currentWorkerUrl = null;
  }
  // Ensure state update happens *after* potential termination
  setManagerState(errorMessage ? "error" : "uninitialized", errorMessage);
}

/**
 * Creates the ASR worker instance and sets up listeners.
 * Should only be called internally.
 */
function createWorker(args?: { onReady?: () => void }): boolean {
  const { onReady } = args || {};

  console.log("[ASR Manager] createWorker called.");
  if (worker) {
    console.warn(
      "[ASR Manager] createWorker called when worker already exists."
    );
    return true;
  }
  if (managerState !== "uninitialized" && managerState !== "error") {
    console.warn(
      `[ASR Manager] createWorker called in unexpected state: ${managerState}`
    );
    return false;
  }

  if (!navigator.gpu) {
    console.error("[ASR Manager] createWorker: WebGPU not supported.");
    setManagerState("error", "WebGPU not supported");
    return false;
  }

  setManagerState("initializing", "Creating ASR Worker...");

  try {
    if (currentWorkerUrl) {
      URL.revokeObjectURL(currentWorkerUrl);
      currentWorkerUrl = null;
    }
    worker = fromScriptText(WorkerCode, {});
    currentWorkerUrl = (worker as any).objectURL;

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { status, data, ...rest } = e.data;
      console.log("[ASR Manager] Received message from worker:", e.data);

      switch (status) {
        case "loading":
          // Worker sends progress messages during model download
          setManagerState("loading_model", data || "Loading model...");
          break;
        case "ready":
          // Worker signals model is loaded and warmed up
          setManagerState("ready");
          onReady?.();
          break;
        case "error":
          console.error(
            "[ASR Manager] Received error status from Worker:",
            data
          );
          cleanupWorker(data || "Unknown worker error");
          break;
        case "transcribing_start":
        case "update":
        case "complete":
          // Result-related statuses are dispatched via asrResult
          document.dispatchEvent(
            new CustomEvent<AsrResultDetail>("asrResult", {
              detail: { status, ...rest, data },
            })
          );
          break;
        default:
          console.warn(
            "[ASR Manager] Received unknown status from worker:",
            status
          );
          break;
      }
    };

    worker.onerror = (err: ErrorEvent) => {
      console.error(
        "[ASR Manager] Unhandled Worker Error event:",
        err.message,
        err
      );
      cleanupWorker(err.message || "Unhandled worker error");
    };

    console.log(
      "[ASR Manager] Worker instance created, sending initial load message."
    );
    const initialMessage: WorkerMessage = { type: "load" };
    worker.postMessage(initialMessage);
    // State is already 'initializing', worker onmessage will update state further
    return true;
  } catch (error: any) {
    console.error("[ASR Manager] Failed to instantiate worker:", error);
    cleanupWorker(`Failed to create worker: ${error.message || error}`);
    return false;
  }
}

/**
 * Checks WebGPU support and sets initial state. Does not load the worker.
 */
export function initializeASRSystem(): void {
  console.log(
    "[ASR Manager] initializeASRSystem called (passive initialization)."
  );
  if (managerState !== "uninitialized") {
    console.log("[ASR Manager] Already initialized or initializing.");
    return;
  }

  if (!navigator.gpu) {
    console.warn("[ASR Manager] WebGPU not supported. ASR will be disabled.");
    setManagerState("error", "WebGPU not supported");
  } else {
    console.log(
      "[ASR Manager] WebGPU supported. ASR state remains 'uninitialized'."
    );
    // Explicitly set state (even if it's the same) to ensure event dispatch if needed
    // setManagerState("uninitialized"); // This might be redundant if default is handled
  }
}

/**
 * Called by UI elements to trigger the actual ASR worker creation
 * and model loading if it hasn't happened yet.
 */
export function triggerASRInitialization(args?: {
  onReady?: () => void;
}): void {
  console.log(
    "[ASR Manager] triggerASRInitialization called. Current state:",
    managerState
  );
  if (managerState === "uninitialized" || managerState === "error") {
    console.log("[ASR Manager] Triggering worker creation...");
    createWorker(args);
  } else {
    console.log(
      "[ASR Manager] Initialization trigger ignored, state is:",
      managerState
    );
  }
}

/**
 * Sends audio data to the worker for transcription if the worker is ready.
 * @param audioData The Float32Array containing the audio samples.
 * @param language The target language for transcription.
 */
export function requestTranscription(
  audioData: Float32Array,
  language: string
): void {
  console.log(
    "[ASR Manager] requestTranscription called. Current state:",
    managerState
  );
  if (managerState === "ready" && worker) {
    console.log("[ASR Manager] Worker is ready, posting generate message.");
    const message: WorkerMessage = {
      type: "generate",
      data: {
        audio: audioData,
        language: language,
      },
    };
    worker.postMessage(message);
  } else {
    console.warn(
      `[ASR Manager] Transcription requested but manager state is '${managerState}'. Ignoring.`
    );
    if (!worker) {
      console.error(
        "[ASR Manager] Worker instance is null, cannot transcribe."
      );
    }
  }
}

/** Checks if the ASR manager is in a ready state for transcription tasks. */
export function isWorkerReady(): boolean {
  return managerState === "ready";
}

/** Gets the current manager state enum value. */
export function getManagerState(): AsrManagerState {
  return managerState;
}

/** Gets the current manager state message. */
export function getManagerMessage(): string {
  return managerMessage;
}

/**
 * Sends a message to the worker to stop the current transcription.
 */
export function stopWorkerTranscription(): void {
  console.log(
    "[ASR Manager] stopWorkerTranscription called. Current state:",
    managerState
  );
  if (worker) {
    console.log("[ASR Manager] Sending stop message to worker.");
    const stopMessage: WorkerMessage = { type: "stop" };
    worker.postMessage(stopMessage);
  } else {
    console.warn(
      "[ASR Manager] Cannot send stop message: Worker does not exist."
    );
  }
}
