/**
 * Dedicated Web Worker for On-Device Google Gemma WebGPU Inference.
 * Runs model weight downloads, IndexedDB caching, ONNX graph compilation,
 * and autoregressive token generation off the main JavaScript UI thread.
 * Guarantees that the main thread maintains 60 FPS for screen rendering,
 * audio synthesizers, and touch event processing on mobile browsers.
 */

let generator = null;
let currentModelId = null;

self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;

  if (type === 'init') {
    const modelId = payload?.modelId || 'onnx-community/gemma-3-270m-it-ONNX';
    let targetDevice = payload?.device || 'webgpu';
    let dtype = payload?.dtype || (targetDevice === 'wasm' ? 'q4' : 'q4f16');

    try {
      // Dynamic import of Transformers.js within the worker context
      const { pipeline, env, AutoModelForCausalLM } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3');
      env.allowLocalModels = false;
      env.useBrowserCache = true; // Enables IndexedDB caching across browser sessions

      // Configure WASM paths and threads if running on CPU/WASM
      if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
        env.backends.onnx.wasm.numThreads = 2;
      }

      // Map gemma3_text architecture into AutoModelForCausalLM
      if (AutoModelForCausalLM && AutoModelForCausalLM.MODEL_CLASS_MAPPINGS && AutoModelForCausalLM.MODEL_CLASS_MAPPINGS[0]) {
        const map = AutoModelForCausalLM.MODEL_CLASS_MAPPINGS[0];
        const gemma2Cls = map.get('gemma2') || map.get('gemma');
        if (gemma2Cls) {
          map.set('gemma3_text', gemma2Cls);
        }
      }

      let maxWeightPct = 0;
      let hasWeightStarted = false;

      const createPipeline = async (dev, dt) => {
        return await pipeline('text-generation', modelId, {
          device: dev,
          dtype: dt,
          progress_callback: (progressInfo) => {
            if (progressInfo) {
              const fileName = String(progressInfo.file || '');
              const totalBytes = typeof progressInfo.total === 'number' ? progressInfo.total : 0;
              const loadedBytes = typeof progressInfo.loaded === 'number' ? progressInfo.loaded : 0;
              const progressPct = typeof progressInfo.progress === 'number' ? Math.round(progressInfo.progress) : 0;
              const isWeightDataFile = fileName.endsWith('.onnx_data') || (fileName.endsWith('.bin') && totalBytes > 20 * 1024 * 1024);

              if (isWeightDataFile) {
                hasWeightStarted = true;
                if (progressPct >= maxWeightPct) {
                  maxWeightPct = progressPct;
                  self.postMessage({
                    type: 'progress',
                    progress: progressPct,
                    file: progressInfo.file,
                    loaded: loadedBytes,
                    total: totalBytes,
                    loadedMB: (loadedBytes / (1024 * 1024)).toFixed(1),
                    totalMB: totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : '260.0',
                    isWeightFile: true,
                    status: progressInfo.status || 'downloading'
                  });
                }
              } else if (!hasWeightStarted) {
                self.postMessage({
                  type: 'progress',
                  progress: 0,
                  file: progressInfo.file,
                  loaded: loadedBytes,
                  total: totalBytes,
                  loadedMB: (loadedBytes / (1024 * 1024)).toFixed(1),
                  totalMB: totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : null,
                  isWeightFile: false,
                  status: 'connecting'
                });
              }
            }
          }
        });
      };

      try {
        generator = await createPipeline(targetDevice, dtype);
      } catch (gpuErr) {
        throw new Error(`WebGPU acceleration unavailable or device allocation error (${gpuErr.message || gpuErr}).`);
      }

      currentModelId = modelId;
      self.postMessage({ type: 'ready', modelId, device: targetDevice });
    } catch (err) {
      self.postMessage({
        type: 'error',
        error: err && err.message ? err.message : String(err)
      });
    }
  }

  if (type === 'generate') {
    const { id, prompt, maxTokens = 64, temperature = 0.3 } = payload;

    if (!generator) {
      self.postMessage({
        type: 'generate_error',
        id,
        error: 'Gemma WebGPU model is not loaded yet.'
      });
      return;
    }

    try {
      const output = await generator(prompt, {
        max_new_tokens: maxTokens,
        temperature,
        do_sample: temperature > 0.0,
        return_full_text: false
      });

      const generatedText = Array.isArray(output) && output[0]?.generated_text
        ? output[0].generated_text.trim()
        : '';

      self.postMessage({
        type: 'generate_success',
        id,
        text: generatedText
      });
    } catch (err) {
      self.postMessage({
        type: 'generate_error',
        id,
        error: err && err.message ? err.message : String(err)
      });
    }
  }
});
