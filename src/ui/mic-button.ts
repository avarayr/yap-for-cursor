import {
  globalAsrMessage as currentAsrMessage,
  globalAsrStatus as currentAsrStatus,
  getOrCreateWorker,
  getWorkerError,
  isWorkerReady,
} from "../asr/manager";
import { processAudioBlob } from "../audio/processing";
import * as CONFIG from "../config";
import type { MicButtonElement, MicButtonState, WorkerMessage } from "../types";
import { setCurrentAsrInstance } from "../asr/instance";
import { DOM_SELECTORS } from "./dom-selectors";

// --- Shared CSS Injection ---
const styleId = "fadein-width-bar-wave-styles";
function injectGlobalStyles(): void {
  if (!document.getElementById(styleId)) {
    const s = document.createElement("style");
    s.id = styleId;
    // Keep styles collapsed for brevity, ensure all necessary styles are included
    s.textContent = `
      .sv-wrap { width: 0; height: 24px; opacity: 0; overflow: hidden; transition: width 0.3s ease, opacity 0.3s ease; margin-right: 2px; background: rgba(200,200,200,0.08); border-radius: 4px; vertical-align: middle; display: inline-block; }
      .mic-btn { cursor: pointer; padding: 4px; border-radius: 50%; transition: background 0.2s, color 0.2s; display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; position: relative; color: #888; }
      .mic-btn:hover { background: rgba(0,0,0,0.05); color: #555; }
      .mic-btn.active { color: #e66; background: rgba(255, 100, 100, 0.1); }
      .mic-btn.transcribing { color: #0cf; background: rgba(0, 200, 255, 0.1); }
      .mic-btn.disabled { cursor: not-allowed; color: #bbb; background: transparent !important; }
      @keyframes sv-spin { from {transform:rotate(0);} to {transform:rotate(360deg);} }
      .mic-spinner { width: 12px; height: 12px; border: 2px solid rgba(0,0,0,0.2); border-top-color: #0cf; border-radius: 50%; animation: sv-spin 1s linear infinite; }
      .mic-btn.disabled .mic-spinner { border-top-color: #ccc; }
      .mic-btn.transcribing .mic-spinner { border-top-color: #0cf; }
      .mic-btn .status-tooltip { visibility: hidden; width: 120px; background-color: #555; color: #fff; text-align: center; border-radius: 6px; padding: 5px 0; position: absolute; z-index: 1; bottom: 125%; left: 50%; margin-left: -60px; opacity: 0; transition: opacity 0.3s; font-size: 10px; }
      .mic-btn .status-tooltip::after { content: ""; position: absolute; top: 100%; left: 50%; margin-left: -5px; border-width: 5px; border-style: solid; border-color: #555 transparent transparent transparent; }
      .mic-btn:hover .status-tooltip, .mic-btn.disabled .status-tooltip { visibility: visible; opacity: 1; }
    `;
    document.head.appendChild(s);
  }
}

// --- Mic Button State Update ---
export function updateMicButtonState(
  button: MicButtonElement | null,
  newState: MicButtonState,
  message: string = ""
): void {
  if (!button) return;

  button.asrState = newState;
  button.classList.remove("active", "transcribing", "disabled");

  const tooltip = button.querySelector<HTMLSpanElement>(".status-tooltip");
  button.innerHTML = ""; // Clear previous content
  if (tooltip) {
    button.appendChild(tooltip);
  } else {
    const newTooltip = document.createElement("span");
    newTooltip.className = "status-tooltip";
    button.appendChild(newTooltip);
  }

  let iconClass = "codicon-mic";
  let defaultTitle = "Hold to Record, Release to Transcribe";
  let currentMessage = message;
  let finalState = newState;

  // Use imported global status variables
  if (currentAsrStatus === "initializing" || currentAsrStatus === "loading") {
    finalState = "disabled";
    currentMessage = currentAsrMessage;
  } else if (currentAsrStatus === "error") {
    finalState = "disabled";
    currentMessage = `ASR Error: ${currentAsrMessage}`;
  } else if (currentAsrStatus !== "ready") {
    finalState = "disabled";
    currentMessage = "ASR not ready";
  }

  switch (finalState) {
    case "recording":
      button.classList.add("active");
      iconClass = "codicon-primitive-square";
      defaultTitle = "Release to Stop Recording & Transcribe";
      break;
    case "transcribing":
      button.classList.add("transcribing");
      const spinnerT = document.createElement("div");
      spinnerT.className = "mic-spinner";
      button.appendChild(spinnerT);
      defaultTitle = "Transcribing...";
      iconClass = "";
      break;
    case "disabled":
      button.classList.add("disabled");
      if (
        currentAsrStatus === "loading" ||
        currentAsrStatus === "initializing"
      ) {
        const spinnerD = document.createElement("div");
        spinnerD.className = "mic-spinner";
        button.appendChild(spinnerD);
        iconClass = "";
      } else if (currentAsrStatus === "error") {
        iconClass = "codicon-error";
      } else {
        iconClass = "codicon-mic-off";
      }
      defaultTitle = currentMessage || "ASR not available";
      break;
    case "idle":
    default:
      iconClass = "codicon-mic";
      defaultTitle = "Hold to Record, Release to Transcribe";
      break;
  }

  if (iconClass) {
    const icon = document.createElement("span");
    icon.className = `codicon ${iconClass} !text-[12px]`;
    button.appendChild(icon);
  }

  const tooltipElem = button.querySelector<HTMLSpanElement>(".status-tooltip");
  if (tooltipElem) {
    tooltipElem.textContent = currentMessage || defaultTitle;
  }
  button.setAttribute("title", currentMessage || defaultTitle);
}

// --- Initialization for each Mic Instance ---
export function initWave(box: HTMLElement): void {
  if (box.dataset.waveInit) return;
  box.dataset.waveInit = "1";

  const area = box.querySelector<HTMLDivElement>(DOM_SELECTORS.buttonContainer);
  const chatInputContentEditable = box.querySelector<HTMLDivElement>(
    DOM_SELECTORS.chatInputContentEditable
  );

  if (!area || !chatInputContentEditable) {
    console.warn(
      "Could not find button area or chatInputContentEditable for",
      box
    );
    return;
  }

  // Build DOM
  const wrap = document.createElement("div");
  wrap.className = "sv-wrap";
  wrap.style.opacity = "0";
  const canvas = document.createElement("canvas");
  canvas.width = 120;
  canvas.height = 24;
  wrap.appendChild(canvas);

  const mic = document.createElement("div") as MicButtonElement;
  mic.className = "mic-btn";
  mic.dataset.asrInit = "1";
  mic.asrState = "idle";
  mic.setAttribute("title", "Hold to Record, Release to Transcribe");

  const statusTooltip = document.createElement("span");
  statusTooltip.className = "status-tooltip";
  mic.appendChild(statusTooltip);

  area.prepend(mic);
  area.prepend(wrap);

  // Visualization params
  const ctx = canvas.getContext("2d");
  const W = canvas.width,
    H = canvas.height;
  const BAR_WIDTH = 2,
    BAR_GAP = 1,
    STEP = BAR_WIDTH + BAR_GAP;
  const SLOTS = Math.floor(W / STEP);
  const MIN_H = 1,
    MAX_H = H - 2,
    SENS = 3.5,
    SCROLL = 0.5;
  let amps = new Array(SLOTS).fill(MIN_H);
  let alphas = new Array(SLOTS).fill(1);
  let offset = 0;

  // Audio state variables
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let dataArr: Uint8Array | null = null;
  let stream: MediaStream | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let raf: number | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let isCancelled = false;
  let mouseDownTime = 0;

  // Initial button state
  updateMicButtonState(mic, "idle");

  // --- Internal Helper Functions ---
  function draw() {
    if (!analyser || !dataArr || !ctx) return;
    analyser.getByteTimeDomainData(dataArr);
    let peak = 0;
    for (const v of dataArr) peak = Math.max(peak, Math.abs(v - 128) / 128);
    peak = Math.min(1, peak * SENS);
    const h = MIN_H + peak * (MAX_H - MIN_H);

    offset += SCROLL;
    if (offset >= STEP) {
      offset -= STEP;
      amps.shift();
      alphas.shift();
      amps.push(h);
      alphas.push(0);
    }

    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = BAR_WIDTH;
    ctx.lineCap = "round";

    for (let i = 0; i < SLOTS; i++) {
      const barH = amps[i];
      if (alphas[i] < 1) alphas[i] = Math.min(1, alphas[i] + 0.1);
      const x = i * STEP - offset + BAR_WIDTH / 2;
      const y1 = (H - barH) / 2,
        y2 = y1 + barH;
      ctx.strokeStyle = "#0cf";
      ctx.globalAlpha = alphas[i];
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(draw);
  }

  function stopVisualization() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    wrap.style.opacity = "0";
    wrap.style.width = "0";
    setTimeout(() => {
      if (mic?.asrState !== "recording" && ctx) {
        ctx.clearRect(0, 0, W, H);
      }
    }, 300);
    amps.fill(MIN_H);
    alphas.fill(1);
    offset = 0;
    sourceNode?.disconnect();
    analyser = null;
    sourceNode = null;
  }

  function stopRecording(forceStop: boolean = false) {
    if (!forceStop && mic.asrState !== "recording") return;
    console.log("Stopping recording...");
    stopVisualization();

    if (mediaRecorder && mediaRecorder.state === "recording") {
      try {
        mediaRecorder.stop();
      } catch (e) {
        console.warn("Error stopping MediaRecorder:", e);
      }
    }
    mediaRecorder = null;

    stream?.getTracks().forEach((track) => track.stop());
    stream = null;

    audioCtx
      ?.close()
      .catch((e) => console.warn("Error closing AudioContext:", e));
    audioCtx = null;

    if (forceStop && !isCancelled) {
      updateMicButtonState(mic, "idle", "Recording stopped forcefully");
    }
  }

  function startRecording() {
    if (mic.asrState !== "idle" || !isWorkerReady()) {
      console.log(
        "Cannot start recording. State:",
        mic.asrState,
        "Worker Ready:",
        isWorkerReady(),
        "Error:",
        getWorkerError()
      );
      updateMicButtonState(mic, mic.asrState || "idle");
      return;
    }
    updateMicButtonState(mic, "recording");
    audioChunks = [];
    isCancelled = false;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((ms) => {
        stream = ms;
        const AudioContext = window.AudioContext;
        if (!AudioContext) throw new Error("AudioContext not supported");
        audioCtx = new AudioContext();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.6;
        dataArr = new Uint8Array(analyser.frequencyBinCount);
        sourceNode = audioCtx.createMediaStreamSource(stream);
        sourceNode.connect(analyser);

        wrap.style.width = `${SLOTS * STEP}px`;
        wrap.style.opacity = "1";
        raf = requestAnimationFrame(draw);

        try {
          const mimeTypes = [
            "audio/webm;codecs=opus",
            "audio/ogg;codecs=opus",
            "audio/wav",
            "audio/mp4",
            "audio/webm",
          ];
          let selectedMimeType: string | undefined = undefined;
          for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
              selectedMimeType = mimeType;
              break;
            }
          }
          if (!selectedMimeType)
            console.warn("Using browser default MIME type.");
          mediaRecorder = new MediaRecorder(stream, {
            mimeType: selectedMimeType,
          });

          mediaRecorder.ondataavailable = (event: BlobEvent) => {
            if (event.data.size > 0) audioChunks.push(event.data);
          };

          mediaRecorder.onstop = async () => {
            console.log("Recording stopped, processing...");
            if (isCancelled) {
              updateMicButtonState(mic, "idle", "Recording cancelled");
              return;
            }
            updateMicButtonState(mic, "transcribing", "Processing audio...");
            if (audioChunks.length === 0) {
              updateMicButtonState(mic, "idle", "No audio recorded");
              return;
            }
            const audioBlob = new Blob(audioChunks, {
              type: mediaRecorder?.mimeType || "audio/webm",
            });
            audioChunks = [];

            try {
              const float32Array = await processAudioBlob(audioBlob);
              const worker = getOrCreateWorker();
              if (float32Array && worker) {
                updateMicButtonState(mic, "transcribing", "Transcribing...");
                const message: WorkerMessage = {
                  type: "generate",
                  data: {
                    audio: float32Array,
                    language: CONFIG.ASR_LANGUAGE,
                  },
                };
                worker.postMessage(message);
              } else if (!float32Array) {
                updateMicButtonState(mic, "idle", "Audio processing failed");
              } else {
                updateMicButtonState(mic, "idle", "ASR worker not ready");
              }
            } catch (procError) {
              console.error("Error processing audio blob:", procError);
              updateMicButtonState(mic, "idle", "Error processing audio");
            }
          };

          mediaRecorder.onerror = (event: Event) => {
            console.error("MediaRecorder Error:", (event as ErrorEvent).error);
            updateMicButtonState(mic, "idle", "Recording error");
            stopRecording(true);
          };

          mediaRecorder.start();
        } catch (e: unknown) {
          console.error("Failed to create MediaRecorder:", e);
          updateMicButtonState(mic, "idle", "Recorder init failed");
          stopRecording(true);
        }
      })
      .catch((err: Error) => {
        console.error("Mic access denied or getUserMedia failed:", err);
        updateMicButtonState(mic, "idle", "Mic access denied");
        stopRecording(true);
      });
  }

  // --- Event Listeners ---
  mic.addEventListener("mousedown", (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (mic.asrState === "idle" && isWorkerReady()) {
      mouseDownTime = Date.now();
      startRecording();
    }
  });

  mic.addEventListener("mouseup", (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (mic.asrState === "recording") {
      stopRecording();
    }
  });

  mic.addEventListener("mouseleave", (e: MouseEvent) => {
    if (mic.asrState === "recording" && e.buttons === 1) {
      console.log("Mouse left while recording, cancelling.");
      isCancelled = true;
      stopRecording(true);
      updateMicButtonState(mic, "idle", "Recording cancelled");
    }
  });

  mic.addEventListener("click", (e: MouseEvent) => {
    if (mic.asrState === "idle" && !isWorkerReady()) {
      updateMicButtonState(mic, "disabled");
    }
    // Set the current ASR instance to this mic and its chatInputContentEditable
    const chatInputContentEditable = box.querySelector<HTMLDivElement>(
      DOM_SELECTORS.chatInputContentEditable
    );
    if (chatInputContentEditable) {
      setCurrentAsrInstance({ mic, chatInputContentEditable });
    }
  });
}

// --- DOM Observer Setup ---
export function setupMicButtonObserver(): void {
  const obs = new MutationObserver((records) => {
    records.forEach((r) => {
      r.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement) {
          if (n.matches(DOM_SELECTORS.fullInputBox)) {
            initWave(n);
          }
          n.querySelectorAll<HTMLElement>(DOM_SELECTORS.fullInputBox).forEach(
            (el) => {
              initWave(el);
            }
          );
        }
      });
    });
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  // Initialize existing elements
  document
    .querySelectorAll<HTMLElement>(DOM_SELECTORS.fullInputBox)
    .forEach((el) => {
      initWave(el);
    });

  // Inject styles once
  injectGlobalStyles();
}
