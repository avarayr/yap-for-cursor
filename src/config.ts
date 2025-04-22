export const HUGGING_FACE_TRANSFORMERS_VERSION = "3.5.0"; // Or latest compatible
export const TARGET_SAMPLE_RATE = 16000; // Whisper expects 16kHz
export const MAX_NEW_TOKENS = 128; // Max tokens for ASR output
export const HOTKEYS = {
  TOGGLE_RECORDING: "cmd+shift+y",
} as const;
