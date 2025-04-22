import { setCurrentAsrInstance } from "../asr/instance";
import {
  globalAsrMessage as currentAsrMessage,
  globalAsrStatus as currentAsrStatus,
  isWorkerReady,
  requestTranscription,
  stopWorkerTranscription,
  triggerASRInitialization,
} from "../asr/manager";
import { processAudioBlob } from "../audio/processing";
import * as CONFIG from "../config";
import type {
  AsrStatusUpdateDetail,
  MicButtonElement,
  MicButtonState,
} from "../types";
import { DOM_SELECTORS } from "./dom-selectors";
import styles from "inline:../styles/styles.css";

// --- Shared CSS Injection ---
const styleId = "fadein-width-bar-wave-styles";
function injectGlobalStyles(): void {
  if (!document.getElementById(styleId)) {
    const s = document.createElement("style");
    s.id = styleId;
    s.textContent = styles;
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

  // Read the *global* ASR status from the manager
  const actualAsrStatus = currentAsrStatus;
  const actualAsrMessage = currentAsrMessage;

  // Determine the effective state for the UI based on global status
  let effectiveState: MicButtonState | "loading" | "uninitialized" = newState; // Allow internal state but override based on global
  let displayMessage = message; // Message specifically passed to this function

  if (actualAsrStatus === "uninitialized") {
    effectiveState = "uninitialized";
    displayMessage = actualAsrMessage || "Click to load ASR";
  } else if (
    actualAsrStatus === "initializing" ||
    actualAsrStatus === "loading"
  ) {
    effectiveState = "loading"; // Treat both as a visual loading state
    displayMessage = actualAsrMessage;
  } else if (actualAsrStatus === "error") {
    effectiveState = "disabled";
    displayMessage = `ASR Error: ${actualAsrMessage}`;
  } else if (actualAsrStatus !== "ready" && newState !== "transcribing") {
    // If global status isn't ready, but we aren't actively transcribing, treat as disabled
    // This handles edge cases where internal state might be 'idle' but manager isn't 'ready'
    effectiveState = "disabled";
    displayMessage = actualAsrMessage || "ASR not ready";
  } else if (newState === "transcribing") {
    // If the requested state is transcribing, keep it, assuming manager is ready or will be soon
    effectiveState = "transcribing";
    displayMessage = message || "Transcribing...";
  } else if (newState === "recording") {
    // If requesting recording, ensure manager is ready
    if (actualAsrStatus === "ready") {
      effectiveState = "recording";
      displayMessage = message || "Recording...";
    } else {
      // Cannot record if manager isn't ready
      effectiveState = "disabled";
      displayMessage = actualAsrMessage || "ASR not ready";
    }
  } else {
    // Default to idle if manager is ready and no other state applies
    effectiveState = "idle";
    displayMessage = message || "Hold to Record, Release to Transcribe";
  }

  // Update button's internal state marker if needed (optional)
  button.asrState =
    effectiveState === "uninitialized" || effectiveState === "loading"
      ? "idle"
      : (effectiveState as MicButtonState); // Cast 'idle'|'recording'|'transcribing'|'disabled'

  button.classList.remove("active", "transcribing", "disabled");
  button.innerHTML = ""; // Clear previous content

  // Ensure tooltip exists
  let tooltip = button.querySelector<HTMLSpanElement>(".status-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("span");
    tooltip.className = "status-tooltip";
    button.appendChild(tooltip);
  }

  let iconClass = "";
  let defaultTitle = "";

  switch (effectiveState) {
    case "recording":
      button.classList.add("active");
      iconClass = "codicon-primitive-square";
      defaultTitle = displayMessage;
      break;
    case "transcribing":
      button.classList.add("transcribing");
      // Container for spinner and stop button
      const transcribeControlContainer = document.createElement("div");
      transcribeControlContainer.className = "transcribe-controls"; // Apply class

      const spinnerT = document.createElement("div");
      spinnerT.className = "mic-spinner";
      transcribeControlContainer.appendChild(spinnerT);

      // Add Stop button (X icon)
      const stopBtn = document.createElement("span");
      // Apply style class along with codicon classes
      stopBtn.className =
        "codicon codicon-x stop-transcription-btn stop-btn-style"; // Added stop-btn-style class
      stopBtn.setAttribute("title", "Stop Transcription");
      transcribeControlContainer.appendChild(stopBtn);

      button.appendChild(transcribeControlContainer);
      defaultTitle = displayMessage;
      iconClass = ""; // No main icon when spinner/stop are shown
      break;
    case "loading": // New visual state for loading/initializing
      button.classList.add("disabled"); // Treat visually as disabled during load
      const spinnerL = document.createElement("div");
      spinnerL.className = "mic-spinner";
      button.appendChild(spinnerL);
      defaultTitle = displayMessage;
      iconClass = "";
      break;
    case "disabled":
      button.classList.add("disabled");
      // Keep spinner if the *reason* for disabled is loading/init (handled by 'loading' case now)
      if (actualAsrStatus === "error") {
        iconClass = "codicon-error";
      } else {
        // Default disabled icon if not error or loading
        iconClass = "codicon-mic-off";
      }
      defaultTitle = displayMessage;
      break;
    case "uninitialized": // New visual state for uninitialized
      // Visually similar to idle, but different tooltip
      iconClass = "codicon-mic";
      defaultTitle = displayMessage;
      break;
    case "idle":
    default:
      iconClass = "codicon-mic";
      defaultTitle = displayMessage;
      break;
  }

  if (iconClass) {
    const icon = document.createElement("span");
    icon.className = `codicon ${iconClass} !text-[12px]`;
    // Ensure icon is added before the tooltip if tooltip was recreated
    if (tooltip && tooltip.parentNode !== button) {
      button.appendChild(icon);
      button.appendChild(tooltip);
    } else if (tooltip) {
      button.insertBefore(icon, tooltip);
    } else {
      button.appendChild(icon);
    }
  }

  // Update tooltip content and button title attribute
  if (tooltip) {
    tooltip.textContent = defaultTitle;
  }
  button.setAttribute("title", defaultTitle);

  // Re-append tooltip if it wasn't already there (might have been cleared)
  if (!button.querySelector(".status-tooltip") && tooltip) {
    button.appendChild(tooltip);
  }
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

  // --- Add cancel button (trash icon) ---
  const cancelBtn = document.createElement("div"); // Use div for easier styling
  cancelBtn.className = "sv-cancel-btn";
  cancelBtn.setAttribute("title", "Cancel and discard recording");
  cancelBtn.style.display = "none"; // Only show when recording
  const cancelIcon = document.createElement("span");
  cancelIcon.className = "codicon codicon-trash !text-[12px]";
  cancelBtn.appendChild(cancelIcon);
  // ---

  const mic = document.createElement("div") as MicButtonElement;
  mic.className = "mic-btn";
  mic.dataset.asrInit = "1";
  // Initial state is determined by the manager now, set via updateMicButtonState
  // mic.asrState = "idle"; // Remove this, rely on updateMicButtonState
  // mic.setAttribute("title", "Hold to Record, Release to Transcribe"); // Remove this

  const statusTooltip = document.createElement("span");
  statusTooltip.className = "status-tooltip";
  mic.appendChild(statusTooltip);

  // Prepend in order: cancel, wrap, mic
  area.prepend(mic);
  area.prepend(wrap);
  area.prepend(cancelBtn);

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

  // Set initial button state based on global status
  updateMicButtonState(mic, "idle"); // Initial call uses 'idle' as base, but will be overridden by global status check inside

  // Listen to global ASR status updates to keep the button current
  const handleAsrStatusUpdate = (event: Event) => {
    // Update the button state whenever the global status changes
    // Pass the current internal state ('idle' is safe default) so updateMicButtonState can decide
    updateMicButtonState(mic, mic.asrState || "idle");
    // We don't need event.detail here, just the notification that status changed
    const customEvent = event as CustomEvent<AsrStatusUpdateDetail>; // Cast if needed
    console.log("ASR Status Update Received by Mic:", customEvent.detail);
  };
  document.addEventListener(
    "asrStatusUpdate",
    handleAsrStatusUpdate as EventListener
  );
  // TODO: Consider adding cleanup for this listener if the element is removed

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
      // Use mic's internal state, not global status
      // Linter error fixed here
      const currentMicState = mic.asrState;
      if (currentMicState !== "recording" && ctx) {
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
    // Check the button's *current* visual/intended state, not just manager state
    const currentMicState = mic.asrState; // Read from the element attribute/property if you store it there
    if (!forceStop && currentMicState !== "recording") return; // Check button's state

    console.log("Stopping recording...");
    stopVisualization();

    if (mediaRecorder && mediaRecorder.state === "recording") {
      try {
        mediaRecorder.stop(); // This triggers the onstop handler
      } catch (e) {
        console.warn("Error stopping MediaRecorder:", e);
      }
    }
    mediaRecorder = null; // Clear recorder ref *after* stopping

    stream?.getTracks().forEach((track) => track.stop());
    stream = null;

    audioCtx
      ?.close()
      .catch((e) => console.warn("Error closing AudioContext:", e));
    audioCtx = null;

    cancelBtn.style.display = "none"; // Hide cancel when not recording

    // Only update state if forceStop happened without cancellation
    // The onstop handler will set transcribing/idle otherwise
    if (forceStop && !isCancelled) {
      updateMicButtonState(mic, "idle", "Recording stopped"); // Update state after forced stop
    }
    // Don't reset isCancelled here, let onstop handle it
  }

  // --- startRecording: Now only called when ASR is ready ---
  function startRecording() {
    // No need to check status here anymore, mousedown handler does it.
    // Assume we are in 'ready' state if this function is called.

    console.log("Attempting to start recording (ASR should be ready)...");
    updateMicButtonState(mic, "recording"); // Update UI to recording state
    audioChunks = [];
    isCancelled = false; // Reset cancel flag for new recording

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((ms) => {
        if (mic.asrState !== "recording") {
          console.warn(
            "Mic state changed away from recording during getUserMedia, aborting."
          );
          ms.getTracks().forEach((track) => track.stop());
          updateMicButtonState(mic, "idle", "Recording aborted");
          return;
        }
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

        cancelBtn.style.display = "inline-flex"; // Show cancel when recording

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

          // --- mediaRecorder.onstop ---
          mediaRecorder.onstop = async () => {
            console.log("MediaRecorder stopped. isCancelled:", isCancelled);
            cancelBtn.style.display = "none"; // Hide cancel button

            if (isCancelled) {
              console.log("Recording was cancelled. Discarding audio chunks.");
              audioChunks = []; // Clear chunks
              updateMicButtonState(mic, "idle", "Recording cancelled");
              isCancelled = false; // Reset flag
              return; // Don't process cancelled audio
            }

            // Proceed with processing if not cancelled
            if (audioChunks.length === 0) {
              console.log("No audio chunks recorded.");
              updateMicButtonState(mic, "idle", "No audio recorded");
              return;
            }

            console.log("Processing recorded audio chunks...");
            updateMicButtonState(mic, "transcribing", "Processing audio..."); // Set state to transcribing

            const audioBlob = new Blob(audioChunks, {
              type: mediaRecorder?.mimeType || "audio/webm",
            });
            audioChunks = []; // Clear chunks after creating blob

            try {
              const float32Array = await processAudioBlob(audioBlob);
              if (float32Array && isWorkerReady()) {
                updateMicButtonState(mic, "transcribing", "Transcribing..."); // Update message
                requestTranscription(float32Array, CONFIG.ASR_LANGUAGE);
              } else if (!float32Array) {
                console.error("Audio processing failed.");
                updateMicButtonState(mic, "idle", "Audio processing failed");
              } else {
                console.error("ASR worker not ready for transcription.");
                updateMicButtonState(mic, "idle", "ASR worker not ready");
              }
            } catch (procError) {
              console.error("Error processing audio blob:", procError);
              updateMicButtonState(mic, "idle", "Error processing audio");
            }
          }; // --- End of onstop ---

          mediaRecorder.onerror = (event: Event) => {
            console.error("MediaRecorder Error:", (event as ErrorEvent).error);
            updateMicButtonState(mic, "idle", "Recording error");
            stopRecording(true); // Force stop on error
          };

          mediaRecorder.start();
          console.log("MediaRecorder started.");
        } catch (e: unknown) {
          console.error("Failed to create MediaRecorder:", e);
          updateMicButtonState(mic, "idle", "Recorder init failed");
          stopRecording(true); // Force stop
        }
      })
      .catch((err: Error) => {
        console.error("getUserMedia failed:", err);
        let message = "Mic access denied or failed";
        if (err.name === "NotAllowedError")
          message = "Microphone access denied";
        else if (err.name === "NotFoundError") message = "No microphone found";
        updateMicButtonState(mic, "idle", message); // Update state to idle with error message
        stopRecording(true); // Ensure cleanup and hide cancel button
      });
  }

  // --- Event Listeners ---

  // Mousedown: Trigger initialization or start recording
  mic.addEventListener("mousedown", (e: MouseEvent) => {
    if (e.button !== 0) return; // Only left click

    // Set current instance context on any click/mousedown
    if (chatInputContentEditable) {
      setCurrentAsrInstance({ mic, chatInputContentEditable });
    }

    const status = currentAsrStatus; // Check global status from manager

    console.log("Mousedown detected. ASR Status:", status);

    if (status === "uninitialized") {
      console.log("ASR uninitialized, triggering initialization...");
      triggerASRInitialization(); // Request worker/model loading
      // Update button state immediately to show loading feedback
      updateMicButtonState(mic, "idle"); // Update state (will show loading based on global status)
    } else if (status === "ready") {
      console.log("ASR ready, starting recording...");
      startRecording(); // ASR is ready, proceed to record
    } else if (status === "loading" || status === "initializing") {
      console.log("ASR is currently loading/initializing. Please wait.");
      // Optionally provide feedback, though updateMicButtonState handles the visual
      updateMicButtonState(mic, "idle"); // Refresh state to ensure spinner shows
    } else if (status === "error") {
      console.warn("Cannot start recording, ASR is in error state.");
      updateMicButtonState(mic, "idle"); // Refresh state to ensure error icon shows
    } else {
      // Handle other states like 'transcribing' - perhaps do nothing on mousedown
      console.log("Mousedown ignored in current state:", status);
    }
  });

  // Mouseup: Stop recording if it was active
  mic.addEventListener("mouseup", (e: MouseEvent) => {
    if (e.button !== 0) return;
    // Check the button's state, not the global ASR status
    if (mic.asrState === "recording") {
      console.log("Mouseup detected while recording, stopping recording.");
      stopRecording(); // Stop normally, will trigger transcription
    } else {
      console.log("Mouseup detected, but not in recording state.");
    }
  });

  // Mouseleave: Cancel recording if mouse leaves while button is down
  mic.addEventListener("mouseleave", (e: MouseEvent) => {
    // Check if left button is still pressed and the button state is recording
    if (e.buttons === 1 && mic.asrState === "recording") {
      console.log("Mouse left while recording, cancelling.");
      isCancelled = true; // Set cancel flag
      stopRecording(true); // Force stop recording immediately
      // State will be updated in the stopRecording/onstop logic now
    }
  });

  // Click: Handle stop transcription button click
  mic.addEventListener("click", (e: MouseEvent) => {
    // Stop transcription if the stop button is clicked
    if (
      (e.target as HTMLElement)?.classList.contains("stop-transcription-btn")
    ) {
      e.stopPropagation(); // Prevent other mic click handlers
      console.log("Stop transcription button clicked.");
      stopWorkerTranscription(); // Tell the worker to stop/discard
      updateMicButtonState(mic, "idle", "Transcription stopped");
      // Optionally clear the ASR target instance if needed
      // clearCurrentAsrInstanceTarget();
    }
    // Note: We no longer need the check for !isWorkerReady() here
    // because mousedown handles the initialization trigger.
  });

  // Cancel button event (Keep as is)
  cancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (mic.asrState === "recording") {
      // Only act if currently recording
      console.log("Cancel button clicked.");
      isCancelled = true;
      stopRecording(true); // Force stop recording immediately
      // State is updated within stopRecording/onstop now
    }
  });
}

// --- DOM Observer Setup ---
export function setupMicButtonObserver(): void {
  // Listen for global status updates once at setup, mainly for initial state
  const handleInitialStatus = (event: Event) => {
    // Cast to CustomEvent to access detail if needed (optional)
    const customEvent = event as CustomEvent<AsrStatusUpdateDetail>;
    console.log(
      "Observer setup: Received initial ASR status",
      customEvent.detail
    );
    // Potentially update any existing buttons if needed, though initWave handles new ones
    document
      .querySelectorAll<HTMLElement>(DOM_SELECTORS.fullInputBox)
      .forEach((el) => {
        const mic = el.querySelector<MicButtonElement>(".mic-btn");
        if (mic && mic.dataset.waveInit) {
          // Only update if already initialized by initWave
          updateMicButtonState(mic, mic.asrState || "idle");
        }
      });
  };
  document.addEventListener(
    "asrStatusUpdate",
    handleInitialStatus as EventListener,
    {
      once: true,
    }
  );

  const obs = new MutationObserver((records) => {
    records.forEach((r) => {
      r.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement) {
          if (n.matches(DOM_SELECTORS.fullInputBox)) {
            initWave(n);
          }
          n.querySelectorAll<HTMLElement>(DOM_SELECTORS.fullInputBox).forEach(
            (el) => {
              // Check if already initialized to prevent duplicate listeners/DOM elements
              if (!el.querySelector('.mic-btn[data-wave-init="1"]')) {
                initWave(el);
              }
            }
          );
        }
      });
      // Optional: Handle node removal for cleanup (remove event listeners)
      // r.removedNodes.forEach(n => { ... });
    });
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  // Initialize existing elements on load
  document
    .querySelectorAll<HTMLElement>(DOM_SELECTORS.fullInputBox)
    .forEach((el) => {
      if (!el.querySelector('.mic-btn[data-wave-init="1"]')) {
        initWave(el);
      }
    });

  // Inject styles once
  injectGlobalStyles();
}
