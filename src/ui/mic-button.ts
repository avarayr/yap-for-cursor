import {
  getManagerMessage,
  getManagerState,
  isWorkerReady,
  requestTranscription,
  stopWorkerTranscription,
  triggerASRInitialization,
} from "../asr/manager";
import { getCurrentAsrInstance, setCurrentAsrInstance } from "../asr/instance";
import { processAudioBlob } from "../audio/processing";
import * as CONFIG from "../config";
import type {
  AsrStatusUpdateDetail,
  MicButtonElement,
  MicButtonState,
  AsrManagerState,
} from "../types";
import {
  createLanguageContextMenu,
  getSelectedLanguage,
  setSelectedLanguage,
} from "./context-menu";
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

  // Read the *global* ASR state and message from the manager
  const actualAsrState = getManagerState();
  const actualAsrMessage = getManagerMessage();

  // Determine the effective state for the UI based on global state
  let effectiveState: MicButtonState | "loading" | "uninitialized" = newState;
  let displayMessage = message; // Message specifically passed to this function

  // --- State Overrides based on Manager State ---
  switch (actualAsrState) {
    case "uninitialized":
      effectiveState = "uninitialized";
      displayMessage = actualAsrMessage || "Click to initialize";
      break;
    case "initializing":
    case "loading_model":
    case "warming_up":
      effectiveState = "loading"; // Treat all loading stages as 'loading' visually
      displayMessage = actualAsrMessage;
      break;
    case "error":
      effectiveState = "disabled";
      displayMessage = `Error: ${actualAsrMessage}`;
      break;
    case "ready":
      // If manager is ready, allow the requested newState unless it forces disabled
      if (newState === "recording") {
        effectiveState = "recording";
        displayMessage = message || "Recording...";
      } else if (newState === "transcribing") {
        effectiveState = "transcribing";
        displayMessage = message || "Transcribing...";
      } else if (newState === "disabled") {
        effectiveState = "disabled";
        displayMessage = message || "Disabled";
      } else {
        // Default to idle if ready and no other active state requested
        effectiveState = "idle";
        displayMessage = message;
      }
      break;
    // If managerState is not one of the above, something is wrong, default to disabled?
    // Or let the initial newState pass through? Let's default to disabled for safety.
    default:
      console.warn(
        `[MicButton] Unexpected manager state: ${actualAsrState}, defaulting UI to disabled.`
      );
      effectiveState = "disabled";
      displayMessage = actualAsrMessage || "ASR not ready";
  }

  // Ensure consistency: If the effective state requires ASR readiness (recording, transcribing),
  // but the manager isn't actually ready (e.g., due to race condition), force disabled.
  if (
    (effectiveState === "recording" || effectiveState === "transcribing") &&
    actualAsrState !== "ready"
  ) {
    console.warn(
      `[MicButton] State mismatch: Requested ${effectiveState} but manager state is ${actualAsrState}. Forcing disabled.`
    );
    effectiveState = "disabled";
    displayMessage = actualAsrMessage || "ASR not ready";
  }

  // Update button's internal state marker (used for logic like mouseleave)
  button.asrState =
    effectiveState === "uninitialized" || effectiveState === "loading"
      ? "idle" // Treat loading/uninit as idle internally for logic purposes
      : (effectiveState as MicButtonState); // Cast: 'idle'|'recording'|'transcribing'|'disabled'

  // Check if we are staying in the loading state and a spinner already exists
  const alreadyHasSpinner = !!button.querySelector(".mic-spinner");
  const isStayingLoading = effectiveState === "loading" && alreadyHasSpinner;

  // Only clear and rebuild if not just updating the message for an existing loading state
  if (!isStayingLoading) {
    button.classList.remove("active", "transcribing", "disabled");
    button.innerHTML = ""; // Clear previous content

    // Create and append the tooltip span first
    const tooltip = document.createElement("span");
    tooltip.className = "status-tooltip";
    button.appendChild(tooltip);
  } else {
    // If staying loading, ensure tooltip exists
    let tooltip = button.querySelector<HTMLSpanElement>(".status-tooltip");
    if (!tooltip) {
      tooltip = document.createElement("span");
      tooltip.className = "status-tooltip";
      button.appendChild(tooltip); // Append if missing
    }
  }

  // Retrieve the potentially recreated/ensured tooltip reference
  const tooltip = button.querySelector<HTMLSpanElement>(".status-tooltip");
  let iconClass = "";
  let defaultTitle = displayMessage || ""; // Use determined display message

  // Handle tooltip visibility
  if (tooltip) {
    tooltip.style.display = defaultTitle ? "block" : "none";
  }

  // Only execute the switch if we are not just updating the message for loading state
  if (!isStayingLoading) {
    switch (effectiveState) {
      case "recording":
        button.classList.add("active");
        iconClass = "codicon-primitive-square";
        break;
      case "transcribing":
        button.classList.add("transcribing");
        const transcribeControlContainer = document.createElement("div");
        transcribeControlContainer.className = "transcribe-controls";
        const spinnerT = document.createElement("div");
        spinnerT.className = "mic-spinner";
        transcribeControlContainer.appendChild(spinnerT);
        const stopBtn = document.createElement("span");
        stopBtn.className =
          "codicon codicon-x stop-transcription-btn stop-btn-style";
        stopBtn.setAttribute("title", "Stop Transcription");
        transcribeControlContainer.appendChild(stopBtn);
        button.appendChild(transcribeControlContainer);
        iconClass = ""; // No main icon
        break;
      case "loading":
        button.classList.add("disabled");
        if (!button.querySelector(".mic-spinner")) {
          const spinnerL = document.createElement("div");
          spinnerL.className = "mic-spinner";
          button.appendChild(spinnerL);
        }
        iconClass = ""; // No main icon
        break;
      case "disabled":
        button.classList.add("disabled");
        if (actualAsrState === "error") {
          iconClass = "codicon-error";
        } else {
          iconClass = "codicon-mic-off"; // Default disabled icon
        }
        break;
      case "uninitialized":
        iconClass = "codicon-mic"; // Same as idle visually
        break;
      case "idle":
      default:
        iconClass = "codicon-mic";
        break;
    }

    if (iconClass) {
      const icon = document.createElement("span");
      icon.className = `codicon ${iconClass} !text-[12px]`;
      // Ensure icon is added correctly relative to the tooltip
      if (tooltip && tooltip.parentNode === button) {
        button.insertBefore(icon, tooltip);
      } else {
        // Append icon first, then tooltip if it exists
        button.appendChild(icon);
        if (tooltip && !button.contains(tooltip)) {
          button.appendChild(tooltip);
        }
      }
    }
  } else {
    // If staying loading, ensure disabled class and update title
    button.classList.add("disabled");
  }

  // Update tooltip content and button title attribute (always)
  if (tooltip) {
    tooltip.textContent = defaultTitle;
  }
  button.setAttribute("title", defaultTitle);
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

  // Set initial button state based on current global state
  updateMicButtonState(mic, "idle");

  // Listen to global ASR status updates (using AsrStatusUpdateDetail)
  const handleAsrStatusUpdate = (event: Event) => {
    const customEvent = event as CustomEvent<AsrStatusUpdateDetail>;
    console.log("[MicButton] ASR Status Update Received:", customEvent.detail);
    // Trigger a UI update based on the new global state
    // Pass the button's current internal state as the base for comparison/override
    updateMicButtonState(mic, mic.asrState || "idle");
  };
  document.addEventListener(
    "asrStatusUpdate",
    handleAsrStatusUpdate as EventListener
  );
  // TODO: Add cleanup for this listener if the element is removed

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
    // Assume we are in 'ready' state if this function is called.

    console.log(
      "Attempting to start recording (ASR should be ready)...",
      getManagerState()
    );
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
          updateMicButtonState(mic, "idle");
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
              updateMicButtonState(mic, "idle");
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
            updateMicButtonState(mic, "transcribing"); // Set state to transcribing

            const audioBlob = new Blob(audioChunks, {
              type: mediaRecorder?.mimeType || "audio/webm",
            });
            audioChunks = []; // Clear chunks after creating blob

            try {
              const float32Array = await processAudioBlob(audioBlob);
              // Get the currently selected language from localStorage
              const currentLanguage = getSelectedLanguage();
              console.log(`Requesting transcription in: ${currentLanguage}`);

              if (float32Array && isWorkerReady()) {
                updateMicButtonState(mic, "transcribing"); // Update message
                requestTranscription(float32Array, currentLanguage); // Use selected language
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
  mic.addEventListener("click", (e: MouseEvent) => {
    if (e.button !== 0) return; // Only left click

    // Set current instance context on any click/mousedown
    if (chatInputContentEditable) {
      setCurrentAsrInstance({ mic, chatInputContentEditable });
    }

    if (mic.asrState === "recording") {
      // If the mic is already recording, stop the recording
      stopRecording();
      return;
    }

    const managerState = getManagerState(); // Check global status from manager

    console.log("Mousedown detected. ASR State:", managerState);

    switch (managerState) {
      case "uninitialized":
        console.log("ASR uninitialized, triggering initialization...");
        triggerASRInitialization();
        updateMicButtonState(mic, "idle", "Initializing..."); // Update state (will show loading based on global status)
        break;
      case "ready":
        console.log("ASR ready, starting recording...");
        startRecording(); // ASR is ready, proceed to record
        break;
      case "initializing":
      case "loading_model":
      case "warming_up":
        console.log("ASR is currently loading/initializing. Please wait.");
        updateMicButtonState(mic, "idle"); // Refresh state to show loading/disabled
        break;
      case "error":
        console.warn("Cannot start recording, ASR is in error state.");
        updateMicButtonState(mic, "idle"); // Refresh state to show error
        break;
      default:
        // Handle other states like 'transcribing' - do nothing on mousedown?
        console.log("Mousedown ignored in current state:", managerState);
        break;
    }
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

  // --- Context Menu Listener ---
  mic.addEventListener("contextmenu", (e: MouseEvent) => {
    e.preventDefault(); // Prevent default browser menu
    console.log("Right-click detected on mic button.");

    // Set current instance context if needed (might already be set by mousedown)
    if (chatInputContentEditable && !getCurrentAsrInstance()) {
      setCurrentAsrInstance({ mic, chatInputContentEditable });
    }

    // Create and show the language menu, passing the mic element
    createLanguageContextMenu(mic, (selectedLang) => {
      // Pass `mic` element instead of coordinates
      // This callback runs when a language is selected from the menu
      setSelectedLanguage(selectedLang); // Persist the choice
      // Optional: Provide feedback to the user, e.g., update tooltip briefly
      // updateMicButtonState(mic, "idle", `Language set to ${selectedLang}`);
      // The actual language use happens during `requestTranscription`
    });
  });
  // --------------------------
}

// --- DOM Observer Setup ---
export function setupMicButtonObserver(): void {
  // Listen for global status updates once at setup, mainly for initial state
  const handleInitialStatus = (event: Event) => {
    // Cast to CustomEvent to access detail if needed (optional)
    const customEvent = event as CustomEvent<AsrStatusUpdateDetail>;
    const state = customEvent.detail.state; // Use the new state property
    console.log("Observer setup: Received initial ASR state", state);
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
