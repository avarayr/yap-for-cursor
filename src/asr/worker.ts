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
console.log("[Worker] Code execution started.");
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

// Dynamically import transformers library within the worker
let AutoTokenizer: typeof TAutoTokenizer,
  AutoProcessor: typeof TAutoProcessor,
  WhisperForConditionalGeneration: typeof TWhisperForConditionalGeneration,
  TextStreamer: typeof TTextStreamer,
  full: typeof TFull,
  env: typeof TEnv;

async function initializeTransformers() {
  console.log("[Worker] Initializing Transformers library...");
  // Use the version from config
  try {
    const module = await import(
      // @ts-ignore we are using a CDN
      "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.0"
    );
    console.log("[Worker] Transformers library imported successfully.");
    AutoTokenizer = module.AutoTokenizer;
    AutoProcessor = module.AutoProcessor;
    WhisperForConditionalGeneration = module.WhisperForConditionalGeneration;
    TextStreamer = module.TextStreamer;
    full = module.full;
    env = module.env;
    // Worker environment settings
    env.allowLocalModels = false;
    env.backends.onnx.logLevel = "info";
  } catch (error) {
    console.error("[Worker] Failed to import Transformers library:", error);
    throw error; // Re-throw error to ensure it propagates
  }
}

const MAX_NEW_TOKENS = 128;

type GenerateParams = {
  audio: Float32Array;
  language: string;
};

class AutomaticSpeechRecognitionPipeline {
  static model_id: string | null = null;
  static tokenizer: PreTrainedTokenizer | null = null;
  static processor: Processor | null = null;
  static model: TWhisperForConditionalGeneration | null = null;
  static modelPromise: Promise<
    [PreTrainedTokenizer, Processor, TWhisperForConditionalGeneration]
  > | null = null;

  static async getInstance(
    progress_callback: ProgressCallback
  ): Promise<
    [PreTrainedTokenizer, Processor, TWhisperForConditionalGeneration]
  > {
    if (!AutoTokenizer) await initializeTransformers();
    this.model_id = "onnx-community/whisper-base";
    if (!this.modelPromise) {
      const modelLoadTasks = [
        AutoTokenizer.from_pretrained(this.model_id, { progress_callback }),
        AutoProcessor.from_pretrained(this.model_id, { progress_callback }),
        WhisperForConditionalGeneration.from_pretrained(this.model_id, {
          dtype: { encoder_model: "fp32", decoder_model_merged: "q4" },
          device: "webgpu",
          progress_callback,
        }) as Promise<TWhisperForConditionalGeneration>,
      ];
      this.modelPromise = Promise.all(modelLoadTasks)
        .then(async (results) => {
          this.tokenizer = results[0] as PreTrainedTokenizer;
          this.processor = results[1] as Processor;
          this.model = results[2] as TWhisperForConditionalGeneration;

          try {
            await this.model.generate({
              // @ts-ignore
              input_features: full([1, 80, 3000], 0.0),
              max_new_tokens: 1,
            });
          } catch (warmupError) {
            console.warn("[Worker] Model warmup failed:", warmupError);
            return Promise.resolve();
          }
          return Promise.resolve();
        })
        .then(() => {
          if (!this.tokenizer || !this.processor || !this.model) {
            throw new Error(
              "[Worker] Model components not initialized correctly after load."
            );
          }
          return [this.tokenizer, this.processor, this.model] as [
            PreTrainedTokenizer,
            Processor,
            TWhisperForConditionalGeneration
          ];
        })
        .catch((error) => {
          console.error("[Worker] Model loading failed:", error);
          this.modelPromise = null;
          throw error;
        });
    }

    const result = await this.modelPromise;
    return result;
  }
}

let processing = false;
async function generate({ audio, language }: GenerateParams) {
  if (processing) {
    console.warn("[Worker] Already processing audio.");
    self.postMessage({
      status: "error",
      data: "Already processing audio.",
    });
    return;
  }
  if (!audio) {
    console.warn("[Worker] No audio data received.");
    self.postMessage({
      status: "error",
      data: "No audio data received.",
    });
    return;
  }
  processing = true;
  cancelRequested = false; // Reset flag for this run

  console.log("[Worker] Transcribing audio...");
  self.postMessage({ status: "transcribing_start" });
  try {
    console.log("[Worker] Getting model instance...");
    const [tokenizer, processor, model] =
      await AutomaticSpeechRecognitionPipeline.getInstance((progressInfo) => {
        console.log(
          "[Worker] AutomaticSpeechRecognitionPipeline Progress callback:",
          progressInfo
        );
        /* ignore for now because model should already be loaded */
      });
    console.log("[Worker] Model instance retrieved.");
    let startTime: number | null = null;
    let numTokens = 0;
    let fullOutput = "";
    const callback_function = (output: string) => {
      // Check flag inside the streamer callback
      if (cancelRequested) {
        console.log("[Worker] Streamer callback cancelled.");
        return; // Prevent further updates from streamer
      }
      startTime ??= performance.now();
      fullOutput = output;
      let tps = 0;
      if (numTokens++ > 0 && startTime) {
        tps = (numTokens / (performance.now() - startTime)) * 1000;
      }
      const updateMessage: WorkerResponse = {
        status: "update",
        output: fullOutput,
        tps: tps ? parseFloat(tps.toFixed(1)) : 0,
        numTokens,
      };
      self.postMessage(updateMessage);
    };
    console.log("[Worker] Creating text streamer...");
    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function,
    });
    console.log("[Worker] Text streamer created.");
    const inputs = await processor(audio);
    console.log("[Worker] Processor inputs created.");

    await model.generate({
      ...inputs,
      max_new_tokens: MAX_NEW_TOKENS, // Put back directly
      language: language, // Put back directly
      streamer,
    });
    console.log("[Worker] Model generate completed."); // Revert log message too

    // TRACK THIS ISSUE TO IMPLEMENT ABORTSIGNAL - https://github.com/huggingface/transformers.js/pull/1193

    // Check if cancellation was requested before sending the final result (Keep this check)
    if (cancelRequested) {
      console.log(
        "[Worker] Transcription cancelled post-generation. Discarding result."
      );
      // Resetting flags is handled in finally
    } else {
      const completeMessage: WorkerResponse = {
        status: "complete",
        output: fullOutput,
      };
      console.log("[Worker] Sending complete message.", completeMessage);
      self.postMessage(completeMessage);
    }
  } catch (error: unknown) {
    console.error("[Worker] Transcription failed:", error);

    self.postMessage({
      status: "error",
      data: `Transcription failed: ${
        Error.isError(error) ? error.message : "unknown error"
      }`,
    });
  } finally {
    processing = false;
  }
}
console.log("[Worker] Setting up message listener.");
self.addEventListener("message", async (e: MessageEvent) => {
  console.log("[Worker] Received message:", e.data);
  if (!e.data || typeof e.data !== "object" || !("type" in e.data)) {
    console.warn("[Worker] Received invalid message format:", e.data);
    return;
  }
  const { type, data } = e.data as WorkerMessage;
  switch (type) {
    case "load":
      console.log("[Worker] Handling 'load' message.");
      try {
        console.log("[Worker] Attempting to get/load model instance...");
        await AutomaticSpeechRecognitionPipeline.getInstance((progressInfo) => {
          if (progressInfo.status === "progress") {
            self.postMessage({
              status: "loading",
              data: `Loading model: ${progressInfo.progress.toFixed(0)}%`,
            });
          } else if (
            progressInfo.status === "done" ||
            progressInfo.status === "ready"
          ) {
            self.postMessage({ status: "ready" });
          }
        });
        console.log("[Worker] Model instance loaded/retrieved successfully.");
      } catch (error) {
        console.error(
          "[Worker] Error during model loading on 'load' message:",
          error
        );
      }
      break;
    case "generate":
      if (data) {
        console.log("[Worker] Received 'generate' message with data:", data);
        await generate(data);
      } else {
        console.warn("[Worker] 'generate' message received without data.");
      }
      break;
    case "stop":
      console.log("[Worker] Received stop message.");
      cancelRequested = true; // Set the global flag
      break;
    default:
      console.warn("[Worker] Received unknown message type:", type);
      break;
  }
});

console.log(
  "[Worker] Message listener set up. Initial script execution complete."
);
// --- Worker Code End ---
