// Define a type for the transformers library object on the window
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformers?: any; // Use a more specific type if possible, like typeof HFTransformers
    _asrGlobalHandlerAttached?: boolean;
  }
}

// Define navigator with gpu property
export interface NavigatorWithGPU extends Navigator {
  gpu?: {
    requestAdapter: () => Promise<GPUAdapter | null>;
  };
}

export interface GPUAdapter {
  requestDevice: () => Promise<GPUDevice>;
}

export interface GPUDevice {
  createCommandEncoder: () => GPUCommandEncoder;
}

export interface GPUCommandEncoder {
  finish: () => GPUCommandBuffer;
}

interface GPUCommandBuffer {
  // Add any necessary properties/methods
}

// Custom event detail types
export interface AsrStatusUpdateDetail {
  status: "initializing" | "loading" | "ready" | "error";
  message?: string;
}

export interface AsrResultDetail {
  status: "update" | "complete" | "error" | "transcribing_start";
  output?: string;
  tps?: number;
  numTokens?: number;
  data?: string; // Primarily for error messages
}

// Type for the state of the mic button
export type MicButtonState = "idle" | "recording" | "transcribing" | "disabled";

// Extend HTMLElement to include custom properties used on the mic button
export interface MicButtonElement extends HTMLDivElement {
  asrState?: MicButtonState;
}

// Map of ASR instances
export interface AsrInstance {
  mic: MicButtonElement;
  chatInputContentEditable: HTMLDivElement; // contentEditable div
}

// Define a type for the message sent to the worker
export interface WorkerGenerateData {
  audio: Float32Array;
  language: string;
}

export interface WorkerMessage {
  type: "load" | "generate";
  data?: WorkerGenerateData; // Only present for 'generate' type
}

// Define a type for the message received from the worker
export interface WorkerResponse {
  status:
    | "loading"
    | "ready"
    | "error"
    | "update"
    | "complete"
    | "transcribing_start";
  data?: string; // Used for loading messages and error details
  output?: string; // Used for transcription updates and completion
  tps?: number;
  numTokens?: number;
}
