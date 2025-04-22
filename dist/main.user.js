"use strict";
(() => {
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });

  // src/asr/instance.ts
  function setCurrentAsrInstance(instance) {
    window._currentAsrInstance = instance;
  }
  function getCurrentAsrInstance() {
    return window._currentAsrInstance ?? null;
  }

  // node_modules/@aidenlx/esbuild-plugin-inline-worker/dist/utils.js
  var toObjectURL = (script) => {
    const blob = new Blob([script], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    return url;
  };
  var fromScriptText = (script, options) => {
    const url = toObjectURL(script);
    const worker2 = new Worker(url, options);
    URL.revokeObjectURL(url);
    return worker2;
  };

  // inline-worker:/var/folders/wt/r3jjdtb90sl84637qrrd32s00000gn/T/epiw-wfIie4/worker_uKiry.ts
  var worker_uKiry_default = `var F=Object.defineProperty,x=Object.defineProperties;var C=Object.getOwnPropertyDescriptors;var T=Object.getOwnPropertySymbols;var G=Object.prototype.hasOwnProperty,E=Object.prototype.propertyIsEnumerable;var m=(e,o,r)=>o in e?F(e,o,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[o]=r,W=(e,o)=>{for(var r in o||(o={}))G.call(o,r)&&m(e,r,o[r]);if(T)for(var r of T(o))E.call(o,r)&&m(e,r,o[r]);return e},h=(e,o)=>x(e,C(o));var i=(e,o,r)=>m(e,typeof o!="symbol"?o+"":o,r);console.log("[Worker] Code execution started.");var d=!1,f,y,w,P,v,p;async function A(){console.log("[Worker] Initializing Transformers library...");try{let e=await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.0");console.log("[Worker] Transformers library imported successfully."),f=e.AutoTokenizer,y=e.AutoProcessor,w=e.WhisperForConditionalGeneration,P=e.TextStreamer,v=e.full,p=e.env,p.allowLocalModels=!1,p.backends.onnx.logLevel="info"}catch(e){throw console.error("[Worker] Failed to import Transformers library:",e),e}}var L=128,t=class{static async getInstance(o){if(f||await A(),this.model_id="onnx-community/whisper-base",!this.modelPromise){let s=[f.from_pretrained(this.model_id,{progress_callback:o}),y.from_pretrained(this.model_id,{progress_callback:o}),w.from_pretrained(this.model_id,{dtype:{encoder_model:"fp32",decoder_model_merged:"q4"},device:"webgpu",progress_callback:o})];this.modelPromise=Promise.all(s).then(async a=>{this.tokenizer=a[0],this.processor=a[1],this.model=a[2];try{await this.model.generate({input_features:v([1,80,3e3],0),max_new_tokens:1})}catch(n){return console.warn("[Worker] Model warmup failed:",n),Promise.resolve()}return Promise.resolve()}).then(()=>{if(!this.tokenizer||!this.processor||!this.model)throw new Error("[Worker] Model components not initialized correctly after load.");return[this.tokenizer,this.processor,this.model]}).catch(a=>{throw console.error("[Worker] Model loading failed:",a),this.modelPromise=null,a})}return await this.modelPromise}};i(t,"model_id",null),i(t,"tokenizer",null),i(t,"processor",null),i(t,"model",null),i(t,"modelPromise",null);var k=!1;async function R({audio:e,language:o}){if(k){console.warn("[Worker] Already processing audio."),self.postMessage({status:"error",data:"Already processing audio."});return}if(!e){console.warn("[Worker] No audio data received."),self.postMessage({status:"error",data:"No audio data received."});return}k=!0,d=!1,console.log("[Worker] Transcribing audio..."),self.postMessage({status:"transcribing_start"});try{console.log("[Worker] Getting model instance...");let[r,s,a]=await t.getInstance(l=>{console.log("[Worker] AutomaticSpeechRecognitionPipeline Progress callback:",l)});console.log("[Worker] Model instance retrieved.");let n=null,c=0,u="",M=l=>{if(d){console.log("[Worker] Streamer callback cancelled.");return}n!=null||(n=performance.now()),u=l;let g=0;c++>0&&n&&(g=c/(performance.now()-n)*1e3);let b={status:"update",output:u,tps:g?parseFloat(g.toFixed(1)):0,numTokens:c};self.postMessage(b)};console.log("[Worker] Creating text streamer...");let _=new P(r,{skip_prompt:!0,skip_special_tokens:!0,callback_function:M});console.log("[Worker] Text streamer created.");let z=await s(e);if(console.log("[Worker] Processor inputs created."),await a.generate(h(W({},z),{max_new_tokens:L,language:o,streamer:_})),console.log("[Worker] Model generate completed."),d)console.log("[Worker] Transcription cancelled post-generation. Discarding result.");else{let l={status:"complete",output:u};console.log("[Worker] Sending complete message.",l),self.postMessage(l)}}catch(r){console.error("[Worker] Transcription failed:",r),self.postMessage({status:"error",data:\`Transcription failed: \${Error.isError(r)?r.message:"unknown error"}\`})}finally{k=!1}}console.log("[Worker] Setting up message listener.");self.addEventListener("message",async e=>{if(console.log("[Worker] Received message:",e.data),!e.data||typeof e.data!="object"||!("type"in e.data)){console.warn("[Worker] Received invalid message format:",e.data);return}let{type:o,data:r}=e.data;switch(o){case"load":console.log("[Worker] Handling 'load' message.");try{console.log("[Worker] Attempting to get/load model instance..."),await t.getInstance(s=>{s.status==="progress"?self.postMessage({status:"loading",data:\`Loading model: \${s.progress.toFixed(0)}%\`}):(s.status==="done"||s.status==="ready")&&self.postMessage({status:"ready"})}),console.log("[Worker] Model instance loaded/retrieved successfully.")}catch(s){console.error("[Worker] Error during model loading on 'load' message:",s)}break;case"generate":r?(console.log("[Worker] Received 'generate' message with data:",r),await R(r)):console.warn("[Worker] 'generate' message received without data.");break;case"stop":console.log("[Worker] Received stop message."),d=!0;break;default:console.warn("[Worker] Received unknown message type:",o);break}});console.log("[Worker] Message listener set up. Initial script execution complete.");
//# sourceMappingURL=worker_uKiry.ts.map
`;

  // src/asr/manager.ts
  var globalAsrStatus = "uninitialized";
  var globalAsrMessage = "Click to initialize";
  var worker = null;
  var workerReady = false;
  var workerLoading = false;
  var workerError = null;
  var currentWorkerUrl = null;
  function dispatchStatusUpdate(status, message) {
    globalAsrStatus = status;
    globalAsrMessage = message || (status === "ready" ? "ASR Ready" : status === "error" ? `ASR Error: ${workerError || "Unknown"}` : status === "loading" ? "Loading ASR model..." : status === "initializing" ? "Initializing ASR..." : status === "uninitialized" ? "Click mic to initialize" : "ASR status unknown");
    console.log(`ASR Status: ${status}`, message ? `(${message})` : "");
    const detail = {
      status: status === "uninitialized" ? "initializing" : status,
      message: globalAsrMessage
    };
    document.dispatchEvent(
      new CustomEvent("asrStatusUpdate", { detail })
    );
  }
  function getOrCreateWorker() {
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
      worker = fromScriptText(worker_uKiry_default, {});
      worker.onmessage = (e) => {
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
              new CustomEvent("asrResult", {
                detail: { status, ...rest, data }
              })
            );
            break;
        }
      };
      worker.onerror = (err) => {
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
      const initialMessage = { type: "load" };
      worker.postMessage(initialMessage);
    } catch (error) {
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
  function initializeASRSystem() {
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
  function triggerASRInitialization() {
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
  function requestTranscription(audioData, language) {
    console.log("[ASR Manager] requestTranscription called.");
    if (isWorkerReady() && worker) {
      console.log("[ASR Manager] Worker is ready, posting generate message.");
      const message = {
        type: "generate",
        data: {
          audio: audioData,
          language
        }
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
  function isWorkerReady() {
    return !!worker && workerReady && !workerLoading && !workerError;
  }
  function stopWorkerTranscription() {
    if (worker && workerReady) {
      console.log("[ASR Manager] Sending stop message to worker.");
      const stopMessage = { type: "stop" };
      worker.postMessage(stopMessage);
    } else {
      console.warn(
        "[ASR Manager] Cannot send stop message: Worker not ready or doesn't exist."
      );
    }
  }

  // src/config.ts
  var HUGGING_FACE_TRANSFORMERS_VERSION = "3.5.0";
  var TARGET_SAMPLE_RATE = 16e3;
  var ASR_LANGUAGE = "english";

  // src/ui/dom-selectors.ts
  var DOM_SELECTORS = {
    micButton: ".mic-btn[data-asr-init]",
    chatInputContentEditable: ".aislash-editor-input[contenteditable='true']",
    fullInputBox: ".full-input-box",
    buttonContainer: ".button-container.composer-button-area"
  };

  // src/audio/processing.ts
  async function processAudioBlob(blob, targetSr = TARGET_SAMPLE_RATE) {
    if (!blob || blob.size === 0) return null;
    const AudioContext = window.AudioContext;
    if (!AudioContext) {
      console.error("Browser does not support AudioContext.");
      return null;
    }
    const audioContext = new AudioContext();
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      if (audioBuffer.sampleRate === targetSr) {
        await audioContext.close();
        return audioBuffer.getChannelData(0);
      }
      console.log(`Resampling from ${audioBuffer.sampleRate}Hz to ${targetSr}Hz`);
      const duration = audioBuffer.duration;
      const offlineContext = new OfflineAudioContext(
        1,
        // Mono
        Math.ceil(duration * targetSr),
        // Calculate output buffer size correctly
        targetSr
      );
      const bufferSource = offlineContext.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.connect(offlineContext.destination);
      bufferSource.start();
      const resampledBuffer = await offlineContext.startRendering();
      await audioContext.close();
      return resampledBuffer.getChannelData(0);
    } catch (error) {
      console.error("Audio processing failed:", error);
      if (audioContext && audioContext.state !== "closed") {
        await audioContext.close();
      }
      return null;
    }
  }

  // _tpkppiz7t:/Users/mika/experiments/cursor-voice/src/styles/styles.css
  var styles_default = '.sv-wrap {\n  width: 0;\n  height: 24px;\n  opacity: 0;\n  overflow: hidden;\n  transition: width 0.3s ease, opacity 0.3s ease;\n  margin-right: 2px;\n  border-radius: 4px;\n  vertical-align: middle;\n  display: inline-block;\n  position: relative;\n  mask-image: linear-gradient(\n    to right,\n    transparent 0,\n    black 10px,\n    black calc(100% - 10px),\n    transparent 100%\n  );\n}\n.mic-btn {\n  cursor: pointer;\n  padding: 4px;\n  border-radius: 50%;\n  transition: background 0.2s, color 0.2s;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  vertical-align: middle;\n  position: relative;\n  color: #888;\n}\n.mic-btn:hover {\n  background: rgba(0, 0, 0, 0.05);\n  color: #555;\n}\n.mic-btn.active {\n  color: #e66;\n  background: rgba(255, 100, 100, 0.1);\n}\n.mic-btn.transcribing {\n  color: #0cf;\n  background: rgba(0, 200, 255, 0.1);\n}\n.mic-btn.disabled {\n  cursor: not-allowed;\n  color: #bbb;\n  background: transparent !important;\n}\n@keyframes sv-spin {\n  from {\n    transform: rotate(0);\n  }\n  to {\n    transform: rotate(360deg);\n  }\n}\n.mic-spinner {\n  width: 12px;\n  height: 12px;\n  border: 2px solid rgba(0, 0, 0, 0.2);\n  border-top-color: #0cf;\n  border-radius: 50%;\n  animation: sv-spin 1s linear infinite;\n}\n.mic-btn.disabled .mic-spinner {\n  border-top-color: #ccc;\n}\n.mic-btn.transcribing .mic-spinner {\n  border-top-color: #0cf;\n}\n.mic-btn .status-tooltip {\n  visibility: hidden;\n  width: 120px;\n  background-color: #555;\n  color: #fff;\n  text-align: center;\n  border-radius: 6px;\n  padding: 5px 3px;\n  position: absolute;\n  z-index: 1;\n  bottom: 125%;\n  left: 50%;\n  margin-left: -60px;\n  opacity: 0;\n  transition: opacity 0.3s;\n  font-size: 10px;\n}\n.mic-btn .status-tooltip::after {\n  content: "";\n  position: absolute;\n  top: 100%;\n  left: 50%;\n  margin-left: -5px;\n  border-width: 5px;\n  border-style: solid;\n  border-color: #555 transparent transparent transparent;\n}\n.mic-btn:hover .status-tooltip,\n.mic-btn.disabled .status-tooltip {\n  visibility: visible;\n  opacity: 1;\n}\n/* Styles for the cancel button - mimicking mic-btn but red */\n.sv-cancel-btn {\n  cursor: pointer;\n  padding: 4px;\n  border-radius: 50%;\n  transition: background 0.2s, color 0.2s;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  vertical-align: middle;\n  color: #e66;\n  margin-right: 2px;\n}\n.sv-cancel-btn:hover {\n  background: rgba(255, 100, 100, 0.1);\n  color: #c33; /* Darker red on hover */\n}\n/* Styles for transcribing state controls */\n.transcribe-controls {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 4px;\n}\n.stop-btn-style {\n  color: #e66;\n  cursor: pointer;\n  font-size: 10px;\n}\n';

  // src/ui/mic-button.ts
  var styleId = "fadein-width-bar-wave-styles";
  function injectGlobalStyles() {
    if (!document.getElementById(styleId)) {
      const s = document.createElement("style");
      s.id = styleId;
      s.textContent = styles_default;
      document.head.appendChild(s);
    }
  }
  function updateMicButtonState(button, newState, message = "") {
    if (!button) return;
    const actualAsrStatus = globalAsrStatus;
    const actualAsrMessage = globalAsrMessage;
    let effectiveState = newState;
    let displayMessage = message;
    if (actualAsrStatus === "uninitialized") {
      effectiveState = "uninitialized";
      displayMessage = actualAsrMessage || "Click to load ASR";
    } else if (actualAsrStatus === "initializing" || actualAsrStatus === "loading") {
      effectiveState = "loading";
      displayMessage = actualAsrMessage;
    } else if (actualAsrStatus === "error") {
      effectiveState = "disabled";
      displayMessage = `ASR Error: ${actualAsrMessage}`;
    } else if (actualAsrStatus !== "ready" && newState !== "transcribing") {
      effectiveState = "disabled";
      displayMessage = actualAsrMessage || "ASR not ready";
    } else if (newState === "transcribing") {
      effectiveState = "transcribing";
      displayMessage = message || "Transcribing...";
    } else if (newState === "recording") {
      if (actualAsrStatus === "ready") {
        effectiveState = "recording";
        displayMessage = message || "Recording...";
      } else {
        effectiveState = "disabled";
        displayMessage = actualAsrMessage || "ASR not ready";
      }
    } else {
      effectiveState = "idle";
      displayMessage = message || "Hold to Record, Release to Transcribe";
    }
    button.asrState = effectiveState === "uninitialized" || effectiveState === "loading" ? "idle" : effectiveState;
    button.classList.remove("active", "transcribing", "disabled");
    button.innerHTML = "";
    let tooltip = button.querySelector(".status-tooltip");
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
        const transcribeControlContainer = document.createElement("div");
        transcribeControlContainer.className = "transcribe-controls";
        const spinnerT = document.createElement("div");
        spinnerT.className = "mic-spinner";
        transcribeControlContainer.appendChild(spinnerT);
        const stopBtn = document.createElement("span");
        stopBtn.className = "codicon codicon-x stop-transcription-btn stop-btn-style";
        stopBtn.setAttribute("title", "Stop Transcription");
        transcribeControlContainer.appendChild(stopBtn);
        button.appendChild(transcribeControlContainer);
        defaultTitle = displayMessage;
        iconClass = "";
        break;
      case "loading":
        button.classList.add("disabled");
        const spinnerL = document.createElement("div");
        spinnerL.className = "mic-spinner";
        button.appendChild(spinnerL);
        defaultTitle = displayMessage;
        iconClass = "";
        break;
      case "disabled":
        button.classList.add("disabled");
        if (actualAsrStatus === "error") {
          iconClass = "codicon-error";
        } else {
          iconClass = "codicon-mic-off";
        }
        defaultTitle = displayMessage;
        break;
      case "uninitialized":
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
      if (tooltip && tooltip.parentNode !== button) {
        button.appendChild(icon);
        button.appendChild(tooltip);
      } else if (tooltip) {
        button.insertBefore(icon, tooltip);
      } else {
        button.appendChild(icon);
      }
    }
    if (tooltip) {
      tooltip.textContent = defaultTitle;
    }
    button.setAttribute("title", defaultTitle);
    if (!button.querySelector(".status-tooltip") && tooltip) {
      button.appendChild(tooltip);
    }
  }
  function initWave(box) {
    if (box.dataset.waveInit) return;
    box.dataset.waveInit = "1";
    const area = box.querySelector(DOM_SELECTORS.buttonContainer);
    const chatInputContentEditable = box.querySelector(
      DOM_SELECTORS.chatInputContentEditable
    );
    if (!area || !chatInputContentEditable) {
      console.warn(
        "Could not find button area or chatInputContentEditable for",
        box
      );
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "sv-wrap";
    wrap.style.opacity = "0";
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 24;
    wrap.appendChild(canvas);
    const cancelBtn = document.createElement("div");
    cancelBtn.className = "sv-cancel-btn";
    cancelBtn.setAttribute("title", "Cancel and discard recording");
    cancelBtn.style.display = "none";
    const cancelIcon = document.createElement("span");
    cancelIcon.className = "codicon codicon-trash !text-[12px]";
    cancelBtn.appendChild(cancelIcon);
    const mic = document.createElement("div");
    mic.className = "mic-btn";
    mic.dataset.asrInit = "1";
    const statusTooltip = document.createElement("span");
    statusTooltip.className = "status-tooltip";
    mic.appendChild(statusTooltip);
    area.prepend(mic);
    area.prepend(wrap);
    area.prepend(cancelBtn);
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const BAR_WIDTH = 2, BAR_GAP = 1, STEP = BAR_WIDTH + BAR_GAP;
    const SLOTS = Math.floor(W / STEP);
    const MIN_H = 1, MAX_H = H - 2, SENS = 3.5, SCROLL = 0.5;
    let amps = new Array(SLOTS).fill(MIN_H);
    let alphas = new Array(SLOTS).fill(1);
    let offset = 0;
    let audioCtx = null;
    let analyser = null;
    let dataArr = null;
    let stream = null;
    let sourceNode = null;
    let raf = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let isCancelled = false;
    updateMicButtonState(mic, "idle");
    const handleAsrStatusUpdate = (event) => {
      updateMicButtonState(mic, mic.asrState || "idle");
      const customEvent = event;
      console.log("ASR Status Update Received by Mic:", customEvent.detail);
    };
    document.addEventListener(
      "asrStatusUpdate",
      handleAsrStatusUpdate
    );
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
        const y1 = (H - barH) / 2, y2 = y1 + barH;
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
    function stopRecording(forceStop = false) {
      const currentMicState = mic.asrState;
      if (!forceStop && currentMicState !== "recording") return;
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
      audioCtx?.close().catch((e) => console.warn("Error closing AudioContext:", e));
      audioCtx = null;
      cancelBtn.style.display = "none";
      if (forceStop && !isCancelled) {
        updateMicButtonState(mic, "idle", "Recording stopped");
      }
    }
    function startRecording() {
      console.log("Attempting to start recording (ASR should be ready)...");
      updateMicButtonState(mic, "recording");
      audioChunks = [];
      isCancelled = false;
      navigator.mediaDevices.getUserMedia({ audio: true }).then((ms) => {
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
        cancelBtn.style.display = "inline-flex";
        try {
          const mimeTypes = [
            "audio/webm;codecs=opus",
            "audio/ogg;codecs=opus",
            "audio/wav",
            "audio/mp4",
            "audio/webm"
          ];
          let selectedMimeType = void 0;
          for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
              selectedMimeType = mimeType;
              break;
            }
          }
          if (!selectedMimeType)
            console.warn("Using browser default MIME type.");
          mediaRecorder = new MediaRecorder(stream, {
            mimeType: selectedMimeType
          });
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
          };
          mediaRecorder.onstop = async () => {
            console.log("MediaRecorder stopped. isCancelled:", isCancelled);
            cancelBtn.style.display = "none";
            if (isCancelled) {
              console.log("Recording was cancelled. Discarding audio chunks.");
              audioChunks = [];
              updateMicButtonState(mic, "idle", "Recording cancelled");
              isCancelled = false;
              return;
            }
            if (audioChunks.length === 0) {
              console.log("No audio chunks recorded.");
              updateMicButtonState(mic, "idle", "No audio recorded");
              return;
            }
            console.log("Processing recorded audio chunks...");
            updateMicButtonState(mic, "transcribing", "Processing audio...");
            const audioBlob = new Blob(audioChunks, {
              type: mediaRecorder?.mimeType || "audio/webm"
            });
            audioChunks = [];
            try {
              const float32Array = await processAudioBlob(audioBlob);
              if (float32Array && isWorkerReady()) {
                updateMicButtonState(mic, "transcribing", "Transcribing...");
                requestTranscription(float32Array, ASR_LANGUAGE);
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
          };
          mediaRecorder.onerror = (event) => {
            console.error("MediaRecorder Error:", event.error);
            updateMicButtonState(mic, "idle", "Recording error");
            stopRecording(true);
          };
          mediaRecorder.start();
          console.log("MediaRecorder started.");
        } catch (e) {
          console.error("Failed to create MediaRecorder:", e);
          updateMicButtonState(mic, "idle", "Recorder init failed");
          stopRecording(true);
        }
      }).catch((err) => {
        console.error("getUserMedia failed:", err);
        let message = "Mic access denied or failed";
        if (err.name === "NotAllowedError")
          message = "Microphone access denied";
        else if (err.name === "NotFoundError") message = "No microphone found";
        updateMicButtonState(mic, "idle", message);
        stopRecording(true);
      });
    }
    mic.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (chatInputContentEditable) {
        setCurrentAsrInstance({ mic, chatInputContentEditable });
      }
      const status = globalAsrStatus;
      console.log("Mousedown detected. ASR Status:", status);
      if (status === "uninitialized") {
        console.log("ASR uninitialized, triggering initialization...");
        triggerASRInitialization();
        updateMicButtonState(mic, "idle");
      } else if (status === "ready") {
        console.log("ASR ready, starting recording...");
        startRecording();
      } else if (status === "loading" || status === "initializing") {
        console.log("ASR is currently loading/initializing. Please wait.");
        updateMicButtonState(mic, "idle");
      } else if (status === "error") {
        console.warn("Cannot start recording, ASR is in error state.");
        updateMicButtonState(mic, "idle");
      } else {
        console.log("Mousedown ignored in current state:", status);
      }
    });
    mic.addEventListener("mouseup", (e) => {
      if (e.button !== 0) return;
      if (mic.asrState === "recording") {
        console.log("Mouseup detected while recording, stopping recording.");
        stopRecording();
      } else {
        console.log("Mouseup detected, but not in recording state.");
      }
    });
    mic.addEventListener("mouseleave", (e) => {
      if (e.buttons === 1 && mic.asrState === "recording") {
        console.log("Mouse left while recording, cancelling.");
        isCancelled = true;
        stopRecording(true);
      }
    });
    mic.addEventListener("click", (e) => {
      if (e.target?.classList.contains("stop-transcription-btn")) {
        e.stopPropagation();
        console.log("Stop transcription button clicked.");
        stopWorkerTranscription();
        updateMicButtonState(mic, "idle", "Transcription stopped");
      }
    });
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (mic.asrState === "recording") {
        console.log("Cancel button clicked.");
        isCancelled = true;
        stopRecording(true);
      }
    });
  }
  function setupMicButtonObserver() {
    const handleInitialStatus = (event) => {
      const customEvent = event;
      console.log(
        "Observer setup: Received initial ASR status",
        customEvent.detail
      );
      document.querySelectorAll(DOM_SELECTORS.fullInputBox).forEach((el) => {
        const mic = el.querySelector(".mic-btn");
        if (mic && mic.dataset.waveInit) {
          updateMicButtonState(mic, mic.asrState || "idle");
        }
      });
    };
    document.addEventListener(
      "asrStatusUpdate",
      handleInitialStatus,
      {
        once: true
      }
    );
    const obs = new MutationObserver((records) => {
      records.forEach((r) => {
        r.addedNodes.forEach((n) => {
          if (n instanceof HTMLElement) {
            if (n.matches(DOM_SELECTORS.fullInputBox)) {
              initWave(n);
            }
            n.querySelectorAll(DOM_SELECTORS.fullInputBox).forEach(
              (el) => {
                if (!el.querySelector('.mic-btn[data-wave-init="1"]')) {
                  initWave(el);
                }
              }
            );
          }
        });
      });
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    document.querySelectorAll(DOM_SELECTORS.fullInputBox).forEach((el) => {
      if (!el.querySelector('.mic-btn[data-wave-init="1"]')) {
        initWave(el);
      }
    });
    injectGlobalStyles();
  }

  // src/main.ts
  (function() {
    "use strict";
    setCurrentAsrInstance(null);
    if (!navigator.gpu) {
      console.warn("WebGPU not supported on this browser. ASR will not work.");
    }
    let transformersLibLoaded = typeof window.transformers !== "undefined";
    if (!transformersLibLoaded && typeof __require !== "undefined") {
      const scriptId = "hf-transformers-script";
      if (!document.getElementById(scriptId)) {
        console.log("Loading Hugging Face Transformers library...");
        const script = document.createElement("script");
        script.id = scriptId;
        script.type = "module";
        script.textContent = `
              console.log('[ASR] Injected script block executing...');
              console.log('[ASR] Attempting to load Transformers library...');
              try {
                  const { ${[
          "AutoTokenizer",
          "AutoProcessor",
          "WhisperForConditionalGeneration",
          "TextStreamer",
          "full",
          "env"
        ].join(
          ","
        )} } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@${HUGGING_FACE_TRANSFORMERS_VERSION}');
                  console.log('[ASR] Transformers library imported successfully.');
                  window.transformers = { AutoTokenizer, AutoProcessor, WhisperForConditionalGeneration, TextStreamer, full, env };
                  window.transformers.env.backends.onnx.logLevel = 'info';
                  console.log('[ASR] Transformers library loaded and configured.');
                  document.dispatchEvent(new CustomEvent('transformersLoaded'));
              } catch (error) {
                  console.error("[ASR] Failed to load Hugging Face Transformers library:", error);
              }
          `;
        document.head.appendChild(script);
      }
    } else if (transformersLibLoaded && window.transformers) {
      window.transformers.env.backends.onnx.logLevel = "info";
    }
    console.log("Initializing ASR system...");
    initializeASRSystem();
    console.log("ASR system initialized");
    document.addEventListener("asrStatusUpdate", (e) => {
      console.log(
        "[ASR] Received asrStatusUpdate event:",
        e.detail
      );
      const _event = e;
      document.querySelectorAll(".mic-btn[data-asr-init]").forEach((btn) => updateMicButtonState(btn, btn.asrState || "idle"));
    });
    if (!window._asrGlobalHandlerAttached) {
      let globalAsrResultHandler = function(e) {
        const event = e;
        const { status, output = "", data } = event.detail;
        console.warn("[ASR] Received asrResult event:", event.detail);
        const asrInstance = getCurrentAsrInstance();
        if (!asrInstance) return;
        const { mic: mic2, chatInputContentEditable: chatInputContentEditable2 } = asrInstance;
        const currentMicState = mic2.asrState;
        console.warn("Current mic state:", currentMicState);
        if (currentMicState === "transcribing") {
          if (status === "update") {
          } else if (status === "complete") {
            updateReactInput(chatInputContentEditable2, output, false);
            updateMicButtonState(mic2, "idle");
            chatInputContentEditable2.focus();
          } else if (status === "error") {
            console.error("Transcription error:", data);
            updateMicButtonState(
              mic2,
              "idle",
              `Error: ${data || "Unknown transcription error"}`
            );
          } else if (status === "transcribing_start") {
          }
        } else if (currentMicState === "idle" && status === "error") {
          updateMicButtonState(
            mic2,
            "disabled",
            `ASR Error: ${data || globalAsrMessage}`
            // Use specific error or global one
          );
        }
      };
      document.addEventListener("asrResult", globalAsrResultHandler);
      window._asrGlobalHandlerAttached = true;
    }
    setupMicButtonObserver();
    const mic = document.querySelector(DOM_SELECTORS.micButton);
    const chatInputContentEditable = document.querySelector(
      DOM_SELECTORS.fullInputBox
    );
    if (mic && chatInputContentEditable) {
      setCurrentAsrInstance({ mic, chatInputContentEditable });
    }
    function updateReactInput(element, text, shouldReplace = false) {
      if (text === "") {
        return;
      }
      element.focus();
      if (shouldReplace) {
        if (element.textContent === text) {
          return;
        }
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand("insertText", false, text);
      } else {
        const currentContent = element.textContent?.trim() || "";
        let textToAppend = text;
        if (currentContent.length > 0 && !text.startsWith(" ")) {
          textToAppend = " " + text;
        }
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand("insertText", false, textToAppend);
      }
      const inputEvent = new Event("input", { bubbles: true, cancelable: true });
      element.dispatchEvent(inputEvent);
    }
  })();
})();
//# sourceMappingURL=main.user.js.map
