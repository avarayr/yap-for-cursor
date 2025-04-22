import type {
  AutoTokenizer as TAutoTokenizer,
  AutoProcessor as TAutoProcessor,
  WhisperForConditionalGeneration as TWhisperForConditionalGeneration,
  TextStreamer as TTextStreamer,
  full as TFull,
  env as TEnv,
  PreTrainedTokenizer,
  Processor,
  ProgressCallback,
} from "@huggingface/transformers";
import type { WorkerMessage, WorkerResponse } from "./../types";
// --- Worker Code Start ---
console.log("[Voice Worker] Code execution started.");
// This code runs in a separate worker thread.

let cancelRequested = false; // Restore global flag

// declare self.postMessage
declare const self: {
  postMessage: (message: WorkerResponse) => void;
  addEventListener: (
    event: string,
    callback: (e: MessageEvent) => void
  ) => void;
};

// --- Module-level Model/Tokenizer/Processor Management ---
let modelId: string = "onnx-community/whisper-base"; // TODO: Make configurable
let tokenizer: PreTrainedTokenizer | null = null;
let processor: Processor | null = null;
let model: TWhisperForConditionalGeneration | null = null;
let modelPromise: Promise<void> | null = null; // Promise resolves when loading/warmup is done
let isModelReady: boolean = false;
let isWarmedUp: boolean = false;

// Dynamically import transformers library within the worker
let AutoTokenizer: typeof TAutoTokenizer,
  AutoProcessor: typeof TAutoProcessor,
  WhisperForConditionalGeneration: typeof TWhisperForConditionalGeneration,
  TextStreamer: typeof TTextStreamer,
  full: typeof TFull,
  env: typeof TEnv;

async function initializeTransformers() {
  console.log("[Voice Worker][Init] Initializing Transformers library...");
  // Use the version from config
  try {
    // TODO: Use config version instead of hardcoding
    const module = await import(
      // @ts-ignore we are using a CDN
      "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.0"
    );
    console.log(
      "[Voice Worker][Init] Transformers library imported successfully."
    );
    ({
      AutoTokenizer,
      AutoProcessor,
      WhisperForConditionalGeneration,
      TextStreamer,
      full,
      env,
    } = module);
    // Worker environment settings
    env.allowLocalModels = false;
    env.backends.onnx.logLevel = "info";
  } catch (error) {
    console.error(
      "[Voice Worker][Init] Failed to import Transformers library:",
      error
    );
    throw error; // Re-throw error to ensure it propagates
  }
}

type GenerateParams = {
  audio: Float32Array;
  language: string;
};

// Define a minimal type for the warmup input - Simplified
interface WarmupParams {
  input_features: any; // Use any for the dummy input features type
  max_new_tokens: number;
  generation_config?: any; // Add generation_config as optional any
}

/**
 * Loads the model, tokenizer, and processor.
 */
async function loadModel(progress_callback: ProgressCallback): Promise<void> {
  console.log("[Voice Worker][Load] Loading model components...");
  if (!AutoTokenizer) await initializeTransformers();

  isModelReady = false;
  isWarmedUp = false;

  try {
    const loadTasks = [
      AutoTokenizer.from_pretrained(modelId, { progress_callback }),
      AutoProcessor.from_pretrained(modelId, { progress_callback }),
      WhisperForConditionalGeneration.from_pretrained(modelId, {
        dtype: { encoder_model: "fp32", decoder_model_merged: "q4" },
        device: "webgpu",
        progress_callback,
      }),
    ];
    const results = await Promise.all(loadTasks);
    console.log("[Voice Worker][Load] All model components loaded.");

    tokenizer = results[0] as PreTrainedTokenizer;
    processor = results[1] as Processor;
    model = results[2] as TWhisperForConditionalGeneration;

    if (!tokenizer || !processor || !model) {
      throw new Error(
        "[Voice Worker][Load] Model components not assigned correctly after load."
      );
    }

    // Model components are loaded, now warmup
    await warmupModel();

    isModelReady = true; // Set ready flag *after* successful warmup
    console.log("[Voice Worker][Load] Model is loaded and warmed up.");
  } catch (error) {
    console.error(
      "[Voice Worker][Load] Model loading or warmup failed:",
      error
    );
    // Reset state
    tokenizer = null;
    processor = null;
    model = null;
    isModelReady = false;
    isWarmedUp = false;
    modelPromise = null; // Allow retry
    throw error; // Re-throw to be caught by the message handler
  }
}

/**
 * Warms up the loaded model.
 */
async function warmupModel(): Promise<void> {
  if (!model || !full) {
    console.warn("[Voice Worker][Warmup] Cannot warmup model: Not loaded yet.");
    return;
  }
  if (isWarmedUp) {
    console.log("[Voice Worker][Warmup] Model already warmed up.");
    return;
  }

  console.log("[Voice Worker][Warmup] Warming up model...");
  try {
    // Create a dummy input for warmup
    const dummyInputFeatures = full([1, 80, 3000], 0.0); // Omit TFull type annotation
    // Create minimal generation config for warmup
    const dummyGenerationConfig = {
      // Add any minimally required fields if known, otherwise empty or default
    };

    const warmupParams: WarmupParams = {
      input_features: dummyInputFeatures,
      max_new_tokens: 1,
      generation_config: dummyGenerationConfig, // Pass the config
    };
    // @ts-ignore - Still might need ignore if exact type matching is difficult for warmup
    await model.generate(warmupParams);
    isWarmedUp = true;
    console.log("[Voice Worker][Warmup] Model warmup successful.");
  } catch (warmupError) {
    console.warn("[Voice Worker][Warmup] Model warmup failed:", warmupError);
    isWarmedUp = false;
  }
}

let processing = false;
async function generate({ audio, language }: GenerateParams) {
  // --- GUARD CLAUSES --- (Immediate checks)
  if (processing) {
    console.warn("[Voice Worker][Generate] Already processing audio.");
    self.postMessage({ status: "error", data: "Already processing audio." });
    return;
  }
  if (!audio || audio.length === 0) {
    console.warn("[Voice Worker][Generate] No audio data received.");
    self.postMessage({ status: "error", data: "No audio data received." });
    return;
  }
  if (!isModelReady || !tokenizer || !processor || !model) {
    console.error(
      "[Voice Worker][Generate] Model not ready for transcription."
    );
    self.postMessage({ status: "error", data: "Model not ready." });
    return;
  }

  // --- START PROCESSING --- (Set flags and notify UI immediately)
  processing = true;
  cancelRequested = false; // Reset cancellation flag for this run
  console.log("[Voice Worker][Generate] Starting transcription process...");
  self.postMessage({ status: "transcribing_start" }); // <<< MOVED HERE

  try {
    // --- PROCESS AUDIO --- (Potentially time-consuming)
    console.log("[Voice Worker][Generate] Processing audio input...");
    const inputs = await processor(audio);
    console.log("[Voice Worker][Generate] Audio processed.");

    // --- SETUP STREAMER --- (Quick)
    let startTime: number | null = null;
    let numTokens = 0;
    let fullOutput = "";
    const callback_function = (output: string) => {
      if (cancelRequested) {
        console.log("[Voice Worker][Generate] Streamer callback cancelled.");
        // How to stop the streamer itself? Requires AbortSignal support.
        return;
      }
      startTime ??= performance.now();
      fullOutput = output;
      let tps = 0;
      if (numTokens++ > 0 && startTime) {
        tps = (numTokens / (performance.now() - startTime)) * 1000;
      }
      self.postMessage({
        status: "update",
        output: fullOutput,
        tps: tps ? parseFloat(tps.toFixed(1)) : 0,
        numTokens,
      });
    };
    console.log("[Voice Worker][Generate] Creating text streamer...");
    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function,
    });
    console.log("[Voice Worker][Generate] Text streamer created.");

    // --- GENERATE TRANSCRIPTION --- (The core work)
    console.log("[Voice Worker][Generate] Starting model generation...");
    await model.generate({
      ...inputs,
      language: language,
      streamer,
      // TODO: Add abortSignal when available in transformers.js
      // signal: abortController.signal // Example
    });
    console.log("[Voice Worker][Generate] Model generation finished.");

    // --- HANDLE COMPLETION/CANCELLATION --- (Final checks)
    if (cancelRequested) {
      console.log(
        "[Voice Worker][Generate] Transcription cancelled post-generation. Discarding result."
      );
      // No 'complete' message needed if cancelled
    } else {
      console.log(
        "[Voice Worker][Generate] Transcription complete. Sending final message."
      );
      self.postMessage({
        status: "complete",
        output: fullOutput, // Send the final accumulated output
      });
    }
  } catch (error: unknown) {
    console.error("[Voice Worker][Generate] Transcription failed:", error);
    self.postMessage({
      status: "error",
      // Improve error reporting
      data: `Transcription failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  } finally {
    console.log("[Voice Worker][Generate] Cleaning up transcription process.");
    processing = false; // Ensure processing flag is always reset
  }
}

console.log("[Voice Worker] Setting up message listener.");
self.addEventListener("message", async (e: MessageEvent) => {
  console.log("[Voice Worker][Handler] Received message:", e.data);
  if (!e.data || typeof e.data !== "object" || !("type" in e.data)) {
    console.warn(
      "[Voice Worker][Handler] Received invalid message format:",
      e.data
    );
    return;
  }

  const { type, data } = e.data as WorkerMessage;

  switch (type) {
    case "load":
      console.log("[Voice Worker][Handler] Handling 'load' message.");
      if (modelPromise) {
        console.log(
          "[Voice Worker][Handler] Model loading already in progress or completed."
        );
        // Optionally re-send ready if already loaded? For now, just await.
        try {
          await modelPromise;
          // If it resolves successfully and wasn't already ready, send ready
          if (isModelReady) {
            self.postMessage({ status: "ready" });
          }
        } catch (error) {
          // Error handled within loadModel, state should be reset
          console.error(
            "[Voice Worker][Handler] Previous load attempt failed."
          );
          // Error message already sent by loadModel's catch block?
          // Let's ensure an error state is sent back if we reach here after failure
          if (!isModelReady) {
            self.postMessage({
              status: "error",
              data: `Model initialization failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            });
          }
        }
        return; // Prevent starting a new load if one is/was active
      }

      // Start the loading process
      modelPromise = loadModel((progressInfo) => {
        // Send progress updates back to the main thread
        if (progressInfo.status === "progress") {
          self.postMessage({
            status: "loading",
            data: `Loading: ${
              progressInfo.file
            } (${progressInfo.progress.toFixed(0)}%)`,
          });
        } else {
          // console.debug("[Voice Worker][Handler] Load progress:", progressInfo.status);
        }
      });

      try {
        await modelPromise; // Await the completion of loading and warmup
        // loadModel sets isModelReady and sends console logs
        self.postMessage({ status: "ready" }); // Signal ready *after* promise resolves successfully
      } catch (error) {
        console.error(
          "[Voice Worker][Handler] loadModel promise rejected:",
          error
        );
        // Error should have been posted by loadModel's catch block
        // Ensure modelPromise is cleared so retry is possible
        modelPromise = null;
        if (!isModelReady) {
          // Double-check if error was already sent
          self.postMessage({
            status: "error",
            data: `Model initialization failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
        }
      }
      break;

    case "generate":
      if (data) {
        console.log("[Voice Worker][Handler] Handling 'generate' message.");
        // Don't await here, let it run in the background
        generate(data);
      } else {
        console.warn(
          "[Voice Worker][Handler] 'generate' message received without data."
        );
        self.postMessage({
          status: "error",
          data: "Generate request missing audio data.",
        });
      }
      break;

    case "stop":
      console.log("[Voice Worker][Handler] Handling 'stop' message.");
      cancelRequested = true;
      // TODO: If using AbortController, call abort() here.
      // abortController?.abort();
      console.log("[Voice Worker][Handler] Cancellation requested flag set.");
      // Note: This stops *sending* updates but doesn't necessarily stop the underlying model.generate()
      break;

    default:
      console.warn(
        "[Voice Worker][Handler] Received unknown message type:",
        type
      );
      break;
  }
});

console.log(
  "[Voice Worker] Message listener set up. Initial script execution complete."
);
// --- Worker Code End ---
