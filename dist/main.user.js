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

  // inline-worker:/var/folders/wt/r3jjdtb90sl84637qrrd32s00000gn/T/epiw-mIDX4Z/worker_XRNhi.ts
  var worker_XRNhi_default = `var F=Object.defineProperty,x=Object.defineProperties;var C=Object.getOwnPropertyDescriptors;var T=Object.getOwnPropertySymbols;var G=Object.prototype.hasOwnProperty,E=Object.prototype.propertyIsEnumerable;var m=(e,o,r)=>o in e?F(e,o,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[o]=r,W=(e,o)=>{for(var r in o||(o={}))G.call(o,r)&&m(e,r,o[r]);if(T)for(var r of T(o))E.call(o,r)&&m(e,r,o[r]);return e},h=(e,o)=>x(e,C(o));var i=(e,o,r)=>m(e,typeof o!="symbol"?o+"":o,r);console.log("[Worker] Code execution started.");var d=!1,f,y,w,P,v,p;async function A(){console.log("[Worker] Initializing Transformers library...");try{let e=await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.0");console.log("[Worker] Transformers library imported successfully."),f=e.AutoTokenizer,y=e.AutoProcessor,w=e.WhisperForConditionalGeneration,P=e.TextStreamer,v=e.full,p=e.env,p.allowLocalModels=!1,p.backends.onnx.logLevel="info"}catch(e){throw console.error("[Worker] Failed to import Transformers library:",e),e}}var L=128,t=class{static async getInstance(o){if(f||await A(),this.model_id="onnx-community/whisper-base",!this.modelPromise){let s=[f.from_pretrained(this.model_id,{progress_callback:o}),y.from_pretrained(this.model_id,{progress_callback:o}),w.from_pretrained(this.model_id,{dtype:{encoder_model:"fp32",decoder_model_merged:"q4"},device:"webgpu",progress_callback:o})];this.modelPromise=Promise.all(s).then(async a=>{this.tokenizer=a[0],this.processor=a[1],this.model=a[2];try{await this.model.generate({input_features:v([1,80,3e3],0),max_new_tokens:1})}catch(n){return console.warn("[Worker] Model warmup failed:",n),Promise.resolve()}return Promise.resolve()}).then(()=>{if(!this.tokenizer||!this.processor||!this.model)throw new Error("[Worker] Model components not initialized correctly after load.");return[this.tokenizer,this.processor,this.model]}).catch(a=>{throw console.error("[Worker] Model loading failed:",a),this.modelPromise=null,a})}return await this.modelPromise}};i(t,"model_id",null),i(t,"tokenizer",null),i(t,"processor",null),i(t,"model",null),i(t,"modelPromise",null);var k=!1;async function R({audio:e,language:o}){if(k){console.warn("[Worker] Already processing audio."),self.postMessage({status:"error",data:"Already processing audio."});return}if(!e){console.warn("[Worker] No audio data received."),self.postMessage({status:"error",data:"No audio data received."});return}k=!0,d=!1,console.log("[Worker] Transcribing audio..."),self.postMessage({status:"transcribing_start"});try{console.log("[Worker] Getting model instance...");let[r,s,a]=await t.getInstance(l=>{console.log("[Worker] AutomaticSpeechRecognitionPipeline Progress callback:",l)});console.log("[Worker] Model instance retrieved.");let n=null,c=0,u="",M=l=>{if(d){console.log("[Worker] Streamer callback cancelled.");return}n!=null||(n=performance.now()),u=l;let g=0;c++>0&&n&&(g=c/(performance.now()-n)*1e3);let b={status:"update",output:u,tps:g?parseFloat(g.toFixed(1)):0,numTokens:c};self.postMessage(b)};console.log("[Worker] Creating text streamer...");let _=new P(r,{skip_prompt:!0,skip_special_tokens:!0,callback_function:M});console.log("[Worker] Text streamer created.");let z=await s(e);if(console.log("[Worker] Processor inputs created."),await a.generate(h(W({},z),{max_new_tokens:L,language:o,streamer:_})),console.log("[Worker] Model generate completed."),d)console.log("[Worker] Transcription cancelled post-generation. Discarding result.");else{let l={status:"complete",output:u};console.log("[Worker] Sending complete message.",l),self.postMessage(l)}}catch(r){console.error("[Worker] Transcription failed:",r),self.postMessage({status:"error",data:\`Transcription failed: \${Error.isError(r)?r.message:"unknown error"}\`})}finally{k=!1}}console.log("[Worker] Setting up message listener.");self.addEventListener("message",async e=>{if(console.log("[Worker] Received message:",e.data),!e.data||typeof e.data!="object"||!("type"in e.data)){console.warn("[Worker] Received invalid message format:",e.data);return}let{type:o,data:r}=e.data;switch(o){case"load":console.log("[Worker] Handling 'load' message.");try{console.log("[Worker] Attempting to get/load model instance..."),await t.getInstance(s=>{s.status==="progress"?self.postMessage({status:"loading",data:\`Loading model: \${s.progress.toFixed(0)}%\`}):(s.status==="done"||s.status==="ready")&&self.postMessage({status:"ready"})}),console.log("[Worker] Model instance loaded/retrieved successfully.")}catch(s){console.error("[Worker] Error during model loading on 'load' message:",s)}break;case"generate":r?(console.log("[Worker] Received 'generate' message with data:",r),await R(r)):console.warn("[Worker] 'generate' message received without data.");break;case"stop":console.log("[Worker] Received stop message."),d=!0;break;default:console.warn("[Worker] Received unknown message type:",o);break}});console.log("[Worker] Message listener set up. Initial script execution complete.");
//# sourceMappingURL=worker_XRNhi.ts.map
`;

  // src/asr/manager.ts
  var globalAsrStatus = "initializing";
  var globalAsrMessage = "Initializing ASR...";
  var worker = null;
  var workerReady = false;
  var workerLoading = false;
  var workerError = null;
  var currentWorkerUrl = null;
  function dispatchStatusUpdate(status, message) {
    globalAsrStatus = status;
    globalAsrMessage = message || (status === "ready" ? "ASR Ready" : status === "error" ? `ASR Error: ${workerError || "Unknown"}` : "Loading ASR...");
    console.log(`ASR Status: ${status}`, message ? `(${message})` : "");
    document.dispatchEvent(
      new CustomEvent("asrStatusUpdate", {
        detail: { status, message: globalAsrMessage }
      })
    );
  }
  function getOrCreateWorker() {
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
      worker = fromScriptText(worker_XRNhi_default, {});
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
      console.error(
        "[ASR Manager] Failed to instantiate worker from Blob URL:",
        error
      );
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
  function isWorkerReady() {
    return workerReady && !workerLoading && !workerError;
  }
  function getWorkerError() {
    return workerError;
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
  function initializeASRSystem(transformersLibLoaded) {
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
      if (!window._asrInitListenerAttached) {
        document.addEventListener("transformersLoaded", initialize, {
          once: true
        });
        window._asrInitListenerAttached = true;
      }
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

  // src/ui/mic-button.ts
  var styleId = "fadein-width-bar-wave-styles";
  function injectGlobalStyles() {
    if (!document.getElementById(styleId)) {
      const s = document.createElement("style");
      s.id = styleId;
      s.textContent = `
      .sv-wrap { width: 0; height: 24px; opacity: 0; overflow: hidden; transition: width 0.3s ease, opacity 0.3s ease; margin-right: 2px; /*background: rgba(200,200,200,0.08);*/ border-radius: 4px; vertical-align: middle; display: inline-block; position: relative; mask-image: linear-gradient(to right, transparent 0, black 10px, black calc(100% - 10px), transparent 100%); }
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
      /* Styles for the cancel button - mimicking mic-btn but red */
      .sv-cancel-btn { cursor: pointer; padding: 4px; border-radius: 50%; transition: background 0.2s, color 0.2s; display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; color: #e66; margin-right: 2px; }
      .sv-cancel-btn:hover { background: rgba(255, 100, 100, 0.1); color: #c33; /* Darker red on hover */ }
    `;
      document.head.appendChild(s);
    }
    if (!document.getElementById("codicon-stylesheet")) {
      const link = document.createElement("link");
      link.id = "codicon-stylesheet";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/@vscode/codicons/dist/codicon.css";
      document.head.appendChild(link);
    }
  }
  function updateMicButtonState(button, newState, message = "") {
    if (!button) return;
    button.asrState = newState;
    button.classList.remove("active", "transcribing", "disabled");
    const tooltip = button.querySelector(".status-tooltip");
    button.innerHTML = "";
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
    if (globalAsrStatus === "initializing" || globalAsrStatus === "loading") {
      finalState = "disabled";
      currentMessage = globalAsrMessage;
    } else if (globalAsrStatus === "error") {
      finalState = "disabled";
      currentMessage = `ASR Error: ${globalAsrMessage}`;
    } else if (globalAsrStatus !== "ready") {
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
        const transcribeControlContainer = document.createElement("div");
        transcribeControlContainer.style.display = "inline-flex";
        transcribeControlContainer.style.alignItems = "center";
        transcribeControlContainer.style.justifyContent = "center";
        transcribeControlContainer.style.gap = "4px";
        const spinnerT = document.createElement("div");
        spinnerT.className = "mic-spinner";
        transcribeControlContainer.appendChild(spinnerT);
        const stopBtn = document.createElement("span");
        stopBtn.className = "codicon codicon-x stop-transcription-btn";
        stopBtn.style.color = "#e66";
        stopBtn.style.cursor = "pointer";
        stopBtn.style.fontSize = "10px";
        stopBtn.setAttribute("title", "Stop Transcription");
        transcribeControlContainer.appendChild(stopBtn);
        button.appendChild(transcribeControlContainer);
        defaultTitle = "Transcribing...";
        iconClass = "";
        break;
      case "disabled":
        button.classList.add("disabled");
        if (globalAsrStatus === "loading" || globalAsrStatus === "initializing") {
          const spinnerD = document.createElement("div");
          spinnerD.className = "mic-spinner";
          button.appendChild(spinnerD);
          iconClass = "";
        } else if (globalAsrStatus === "error") {
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
    const tooltipElem = button.querySelector(".status-tooltip");
    if (tooltipElem) {
      tooltipElem.textContent = currentMessage || defaultTitle;
    }
    button.setAttribute("title", currentMessage || defaultTitle);
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
    mic.asrState = "idle";
    mic.setAttribute("title", "Hold to Record, Release to Transcribe");
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
    let mouseDownTime = 0;
    updateMicButtonState(mic, "idle");
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
    function stopRecording(forceStop = false) {
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
      audioCtx?.close().catch((e) => console.warn("Error closing AudioContext:", e));
      audioCtx = null;
      cancelBtn.style.display = "none";
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
      navigator.mediaDevices.getUserMedia({ audio: true }).then((ms) => {
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
            console.log("Recording stopped, processing...");
            cancelBtn.style.display = "none";
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
              type: mediaRecorder?.mimeType || "audio/webm"
            });
            audioChunks = [];
            try {
              const float32Array = await processAudioBlob(audioBlob);
              const worker2 = getOrCreateWorker();
              if (float32Array && worker2) {
                updateMicButtonState(mic, "transcribing", "Transcribing...");
                const message = {
                  type: "generate",
                  data: {
                    audio: float32Array,
                    language: ASR_LANGUAGE
                  }
                };
                worker2.postMessage(message);
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
          mediaRecorder.onerror = (event) => {
            console.error("MediaRecorder Error:", event.error);
            updateMicButtonState(mic, "idle", "Recording error");
            stopRecording(true);
          };
          mediaRecorder.start();
        } catch (e) {
          console.error("Failed to create MediaRecorder:", e);
          updateMicButtonState(mic, "idle", "Recorder init failed");
          stopRecording(true);
        }
      }).catch((err) => {
        console.error("Mic access denied or getUserMedia failed:", err);
        updateMicButtonState(mic, "idle", "Mic access denied");
        stopRecording(true);
      });
    }
    mic.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (mic.asrState === "idle" && isWorkerReady()) {
        mouseDownTime = Date.now();
        startRecording();
      }
    });
    mic.addEventListener("mouseup", (e) => {
      if (e.button !== 0) return;
      if (mic.asrState === "recording") {
        stopRecording();
      }
    });
    mic.addEventListener("mouseleave", (e) => {
      if (mic.asrState === "recording" && e.buttons === 1) {
        console.log("Mouse left while recording, cancelling.");
        isCancelled = true;
        stopRecording(true);
        updateMicButtonState(mic, "idle", "Recording cancelled");
      }
    });
    mic.addEventListener("click", (e) => {
      if (mic.asrState === "idle" && !isWorkerReady()) {
        updateMicButtonState(mic, "disabled");
      }
      const chatInputContentEditable2 = box.querySelector(
        DOM_SELECTORS.chatInputContentEditable
      );
      if (chatInputContentEditable2) {
        setCurrentAsrInstance({ mic, chatInputContentEditable: chatInputContentEditable2 });
      }
      if (e.target?.classList.contains("stop-transcription-btn")) {
        e.stopPropagation();
        console.log("Stop transcription requested.");
        stopWorkerTranscription();
        updateMicButtonState(mic, "idle", "Transcription stopped");
      }
    });
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      isCancelled = true;
      stopRecording(true);
      updateMicButtonState(mic, "idle", "Recording cancelled");
      audioChunks = [];
      amps.fill(MIN_H);
      alphas.fill(1);
      offset = 0;
      if (ctx) ctx.clearRect(0, 0, W, H);
    });
  }
  function setupMicButtonObserver() {
    const obs = new MutationObserver((records) => {
      records.forEach((r) => {
        r.addedNodes.forEach((n) => {
          if (n instanceof HTMLElement) {
            if (n.matches(DOM_SELECTORS.fullInputBox)) {
              initWave(n);
            }
            n.querySelectorAll(DOM_SELECTORS.fullInputBox).forEach(
              (el) => {
                initWave(el);
              }
            );
          }
        });
      });
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    document.querySelectorAll(DOM_SELECTORS.fullInputBox).forEach((el) => {
      initWave(el);
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
    initializeASRSystem(transformersLibLoaded);
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
            console.warn(
              "Transcription complete:",
              output,
              chatInputContentEditable2
            );
            updateReactInput(chatInputContentEditable2, output, false);
            updateMicButtonState(mic2, "idle", "Transcription complete");
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
