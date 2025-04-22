import type {
  AsrStatusUpdateDetail,
  WorkerMessage,
  WorkerResponse,
  AsrResultDetail,
} from "../types";
import { fromScriptText } from "@aidenlx/esbuild-plugin-inline-worker/utils";
import WorkerCode from "worker:./worker.ts";

// Define navigator with gpu property
interface NavigatorWithGPU extends Navigator {
  gpu?: {
    requestAdapter: () => Promise<GPUAdapter | null>;
  };
}

interface GPUAdapter {
  requestDevice: () => Promise<GPUDevice>;
}

interface GPUDevice {
  createCommandEncoder: () => GPUCommandEncoder;
}

interface GPUCommandEncoder {
  finish: () => GPUCommandBuffer;
}

interface GPUCommandBuffer {}

declare const navigator: NavigatorWithGPU;

// --- Global ASR Status Management ---
export let globalAsrStatus: AsrStatusUpdateDetail["status"] | "uninitialized" =
  "uninitialized";
export let globalAsrMessage: string = "Click to initialize";

// --- Worker Instance Management ---
let worker: Worker | null = null;
let workerReady: boolean = false;
let workerLoading: boolean = false;
let workerError: string | null = null;
let currentWorkerUrl: string | null = null;

/**
 * Dispatches a global ASR status update event.
 */
function dispatchStatusUpdate(
  status: AsrStatusUpdateDetail["status"] | "uninitialized",
  message?: string
) {
  globalAsrStatus = status;
  globalAsrMessage =
    message ||
    (status === "ready"
      ? "ASR Ready"
      : status === "error"
      ? `ASR Error: ${workerError || "Unknown"}`
      : status === "loading"
      ? "Loading ASR model..."
      : status === "initializing"
      ? "Initializing ASR..."
      : status === "uninitialized"
      ? "Click mic to initialize"
      : "ASR status unknown");
  console.log(`ASR Status: ${status}`, message ? `(${message})` : "");
  const detail: AsrStatusUpdateDetail = {
    status: status === "uninitialized" ? "initializing" : status,
    message: globalAsrMessage,
  };
  document.dispatchEvent(
    new CustomEvent<AsrStatusUpdateDetail>("asrStatusUpdate", { detail })
  );
}

/**
 * Creates or returns the existing ASR worker instance.
 * Should only be called internally by triggerASRInitialization.
 */
function getOrCreateWorker(): Worker | null {
  console.log("[ASR Manager] getOrCreateWorker called.");
  if (worker) {
    console.warn(
      "[ASR Manager] getOrCreateWorker called when worker already exists."
    );
    return worker;
  }
  if (workerLoading) {
    console.warn(
      "[ASR Manager] getOrCreateWorker called while already loading."
    );
    return null;
  }
  if (workerError) {
    dispatchStatusUpdate("error", workerError);
    return null;
  }
  if (!navigator.gpu) {
    console.error(
      "[ASR Manager] getOrCreateWorker called but WebGPU not supported."
    );
    workerError = "WebGPU not supported";
    dispatchStatusUpdate("error", workerError);
    return null;
  }

  workerLoading = true;
  console.log("[ASR Manager] Attempting to create worker...");
  dispatchStatusUpdate("loading", "Creating ASR Worker...");

  try {
    if (currentWorkerUrl) {
      URL.revokeObjectURL(currentWorkerUrl);
      currentWorkerUrl = null;
    }
    worker = fromScriptText(WorkerCode, {});

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { status, data, ...rest } = e.data;
      console.log("[ASR Manager] Received message from worker:", e.data);
      switch (status) {
        case "loading":
          dispatchStatusUpdate("loading", data);
          break;
        case "ready":
          workerReady = true;
          workerLoading = false;
          workerError = null;
          dispatchStatusUpdate("ready");
          break;
        case "error":
          console.error(
            "[ASR Manager] Received error status from Worker:",
            data
          );
          workerError = data || "Unknown worker error";
          workerLoading = false;
          workerReady = false;
          dispatchStatusUpdate("error", workerError);
          worker?.terminate();
          worker = null;
          if (currentWorkerUrl) {
            URL.revokeObjectURL(currentWorkerUrl);
            currentWorkerUrl = null;
          }
          break;
        default:
          document.dispatchEvent(
            new CustomEvent<AsrResultDetail>("asrResult", {
              detail: { status, ...rest, data },
            })
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
      workerError = err.message || "Unhandled worker error";
      workerLoading = false;
      workerReady = false;
      dispatchStatusUpdate("error", `Worker failed: ${workerError}`);
      worker?.terminate();
      worker = null;
      if (currentWorkerUrl) {
        URL.revokeObjectURL(currentWorkerUrl);
        currentWorkerUrl = null;
      }
    };

    console.log(
      "[ASR Manager] Worker instance created, sending initial load message."
    );
    const initialMessage: WorkerMessage = { type: "load" };
    worker.postMessage(initialMessage);
  } catch (error: any) {
    console.error("[ASR Manager] Failed to instantiate worker:", error);
    workerError = `Failed to create worker: ${error.message || error}`;
    workerLoading = false;
    dispatchStatusUpdate("error", workerError);
    worker = null;
    if (currentWorkerUrl) {
      URL.revokeObjectURL(currentWorkerUrl);
      currentWorkerUrl = null;
    }
  }

  return worker;
}

/**
 * Checks WebGPU support and sets initial status. Does not load the worker.
 */
export function initializeASRSystem(): void {
  console.log(
    "[ASR Manager] initializeASRSystem called (passive initialization)."
  );
  if (!navigator.gpu) {
    console.warn("[ASR Manager] WebGPU not supported. ASR will be disabled.");
    workerError = "WebGPU not supported";
    dispatchStatusUpdate("error", workerError);
  } else {
    console.log(
      "[ASR Manager] WebGPU supported. ASR is ready to be loaded on demand."
    );
    if (globalAsrStatus !== "error") {
      dispatchStatusUpdate("uninitialized");
    }
  }
}

/**
 * Called by UI elements (e.g., mic button) to trigger the actual
 * ASR worker creation and model loading if it hasn't happened yet.
 */
export function triggerASRInitialization(): void {
  console.log("[ASR Manager] triggerASRInitialization called.");
  if (globalAsrStatus === "uninitialized" && !workerError) {
    console.log(
      "[ASR Manager] ASR is uninitialized, proceeding to load worker."
    );
    if (!navigator.gpu) {
      console.error(
        "[ASR Manager] Triggered initialization but WebGPU not supported."
      );
      workerError = "WebGPU not supported";
      dispatchStatusUpdate("error", workerError);
      return;
    }
    getOrCreateWorker();
  } else if (workerLoading) {
    console.log("[ASR Manager] Initialization already in progress.");
  } else if (workerReady) {
    console.log("[ASR Manager] ASR already initialized and ready.");
  } else if (workerError) {
    console.log(
      "[ASR Manager] Cannot initialize due to previous error:",
      workerError
    );
    dispatchStatusUpdate("error", workerError);
  } else {
    console.warn(
      "[ASR Manager] triggerASRInitialization called in unexpected state:",
      globalAsrStatus
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
  console.log("[ASR Manager] requestTranscription called.");
  if (isWorkerReady() && worker) {
    console.log("[ASR Manager] Worker is ready, posting generate message.");
    const message: WorkerMessage = {
      type: "generate",
      data: {
        audio: audioData,
        language: language,
      },
    };
    worker.postMessage(message);
  } else if (!worker) {
    console.error(
      "[ASR Manager] Transcription requested, but worker does not exist."
    );
    dispatchStatusUpdate("error", "Worker instance missing");
  } else if (workerLoading) {
    console.warn(
      "[ASR Manager] Transcription requested, but worker is still loading."
    );
  } else if (workerError) {
    console.error(
      "[ASR Manager] Transcription requested, but worker is in error state:",
      workerError
    );
    dispatchStatusUpdate("error", workerError);
  } else {
    console.warn(
      "[ASR Manager] Transcription requested, but worker is not ready for unknown reasons."
    );
  }
}

/** Checks if the ASR worker is ready for transcription tasks. */
export function isWorkerReady(): boolean {
  return !!worker && workerReady && !workerLoading && !workerError;
}

/** Gets the current worker error message, if any. */
export function getWorkerError(): string | null {
  return workerError;
}

/**
 * Sends a message to the worker to stop the current transcription.
 */
export function stopWorkerTranscription(): void {
  if (worker && workerReady) {
    console.log("[ASR Manager] Sending stop message to worker.");
    const stopMessage: WorkerMessage = { type: "stop" };
    worker.postMessage(stopMessage);
  } else {
    console.warn(
      "[ASR Manager] Cannot send stop message: Worker not ready or doesn't exist."
    );
  }
}
