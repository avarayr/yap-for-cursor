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

// --- Worker Code (Restored as template literal) ---

// --- Global ASR Status Management ---
export let globalAsrStatus: AsrStatusUpdateDetail["status"] = "initializing";
export let globalAsrMessage: string = "Initializing ASR...";

// --- Worker Instance Management ---
let worker: Worker | null = null;
let workerReady: boolean = false;
let workerLoading: boolean = false;
let workerError: string | null = null;
let currentWorkerUrl: string | null = null; // To manage blob URL cleanup (restored)

/**
 * Dispatches a global ASR status update event.
 * @param status The new status.
 * @param message Optional message associated with the status.
 */
function dispatchStatusUpdate(
  status: AsrStatusUpdateDetail["status"],
  message?: string
) {
  globalAsrStatus = status;
  globalAsrMessage =
    message ||
    (status === "ready"
      ? "ASR Ready"
      : status === "error"
      ? `ASR Error: ${workerError || "Unknown"}`
      : "Loading ASR...");
  console.log(`ASR Status: ${status}`, message ? `(${message})` : "");
  document.dispatchEvent(
    new CustomEvent<AsrStatusUpdateDetail>("asrStatusUpdate", {
      detail: { status, message: globalAsrMessage },
    })
  );
}

/**
 * Creates or returns the existing ASR worker instance.
 */
export function getOrCreateWorker(): Worker | null {
  console.log("[ASR Manager] getOrCreateWorker called.");
  if (worker) {
    console.log("[ASR Manager] Returning existing worker.");
    return worker;
  }
  if (workerLoading) return null;
  if (workerError) {
    dispatchStatusUpdate("error", workerError);
    return null;
  }
  if (!navigator.gpu) {
    console.warn("[ASR Manager] WebGPU not supported, cannot create worker.");
    workerError = "WebGPU not supported";
    dispatchStatusUpdate("error", workerError);
    return null;
  }

  workerLoading = true;
  console.log("[ASR Manager] Attempting to create worker...");
  dispatchStatusUpdate("loading", "Creating ASR Worker...");

  try {
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
            // Clean up Blob URL on error
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
        // Clean up Blob URL on error
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
    console.error(
      "[ASR Manager] Failed to instantiate worker from Blob URL:",
      error
    );
    workerError = `Failed to create worker: ${error.message || error}`;
    workerLoading = false;
    dispatchStatusUpdate("error", workerError);
    worker = null;
    if (currentWorkerUrl) {
      // Clean up Blob URL on creation error
      URL.revokeObjectURL(currentWorkerUrl);
      currentWorkerUrl = null;
    }
  }

  return worker;
}

/** Checks if the ASR worker is ready for transcription tasks. */
export function isWorkerReady(): boolean {
  return workerReady && !workerLoading && !workerError;
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

/**
 * Initializes the ASR worker if conditions are met (WebGPU support).
 * Listens for the transformers library to be loaded if necessary.
 */
export function initializeASRSystem(transformersLibLoaded: boolean): void {
  console.log(
    `[ASR Manager] initializeASRSystem called. transformersLibLoaded: ${transformersLibLoaded}`
  );
  const initialize = () => {
    console.log(
      "[ASR Manager] initialize function called (after transformers loaded or immediately)."
    );
    if (!navigator.gpu) {
      console.warn(
        "[ASR Manager] WebGPU not supported during init, dispatching error."
      );
      workerError = "WebGPU not supported";
      dispatchStatusUpdate("error", workerError);
      return;
    }
    console.log("[ASR Manager] WebGPU supported, calling getOrCreateWorker.");
    getOrCreateWorker();
  };
  if (transformersLibLoaded) {
    console.log(
      "[ASR Manager] Transformers library already loaded, initializing immediately."
    );
    initialize();
  } else {
    console.log(
      "[ASR Manager] Transformers library not loaded, attaching listener."
    );
    if (!(window as any)._asrInitListenerAttached) {
      document.addEventListener("transformersLoaded", initialize, {
        once: true,
      });
      (window as any)._asrInitListenerAttached = true;
    }
  }
}
