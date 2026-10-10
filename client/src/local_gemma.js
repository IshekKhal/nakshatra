/**
 * On-Device Gemma Body Grammar & Celestial Phrasing Engine for Project Scotopic V2.
 * Enforces the strict rule of natural human body phrasing.
 * Eliminates all mathematical and astronomical jargon: zero degrees, zero coordinates,
 * zero compass bearings, and zero hand-measurement rules.
 *
 * Architecture:
 * 1. Chrome Built-in AI (Prompt API): Zero-download native on-device Gemini Nano/Gemma.
 * 2. Dedicated Web Worker: Offloads Transformers.js WebGPU model downloading, IndexedDB
 *    caching, ONNX shader compilation, and autoregressive generation entirely off the
 *    main thread to eliminate UI freezes on mobile browsers.
 * 3. Resilient Lore Engine: Rich, warm, grandmotherly celestial lore covering every
 *    celestial body in the sky with body-relative physical descriptions.
 */

export const FORBIDDEN_JARGON_REGEX = /\b(azimuth|altitude|right\s+ascension|declination|degree[s]?|arcminute[s]?|arcsecond[s]?|bearing|southeast|northeast|southwest|northwest|fist[s]?|clenched)\b/i;

export const GEMMA_SYSTEM_PROMPT = `You are a gentle, warm stargazing companion standing beside someone on a quiet rooftop under the open night sky.
The person is holding their phone flat at their chest or against their chin.
Your job is to whisper soothing, poetic, body-relative celestial observations in 1 or 2 comforting sentences.

Rules:
1. Never use technical compass directions like 'southeast' or 'bearing 180'.
2. Never use angle numbers like '30 degrees' or hand-measurement rules like 'two fists'.
3. Never use repetitive robotic openings like 'Look straight out into the dark'.
4. Speak warmly and unhurriedly, like a wise grandmother sharing ancient sky lore under the stars.`;

/**
 * Rich, poetic observations for all navigation stars, planets, and deep-sky treasures.
 * Warm, comforting descriptions with zero technical jargon.
 */
export const CELESTIAL_OBSERVATIONS = {
  // --- Solar System Bodies ---
  moon: 'Right before you hangs the Moon, casting its ancient silver veil across the silent world.',
  saturn: 'Right ahead lies Saturn, glowing with a steady, quiet honey-gold light through the deep stillness of space.',
  jupiter: 'Right in front of you shines Jupiter, a commanding brilliant jewel watching peacefully over the night.',
  mars: 'Ahead in the dark burns Mars, like a gentle amber ember glowing in the hearth of the sky.',
  venus: 'Right before you blazes Venus, the dazzling evening beacon shining with pure, crisp white fire.',
  mercury: 'Low on the horizon sparkles Mercury, a delicate golden spark dancing close to the edge of the world.',

  // --- Prominent Navigation Stars ---
  sirius: 'Straight ahead sparkles Sirius, flashing like a brilliant diamond with sparks of blue and silver.',
  canopus: 'Right before you glimmers Canopus, a grand golden supergiant guiding travelers across the southern sky.',
  'rigil kentaurus': 'Right before you rests Rigil Kentaurus, our nearest starry neighbor, shining with a warm, comforting yellow light.',
  arcturus: 'Straight ahead glows Arcturus, a warm, golden-orange giant shining like a friendly lantern in the northern sky.',
  vega: 'Right above your gaze shines Vega, an icy blue-white sapphire star piercing the dark with pure clarity.',
  capella: 'Right before you shines Capella, twinkling merrily with rich yellow and amber light.',
  rigel: 'Straight ahead burns Rigel, a fierce blue supergiant star blazing like frozen lightning in Orion.',
  procyon: 'Right before you twinkles Procyon, a soft white star glowing gentle and clear in the quiet evening.',
  achernar: 'Right before you shines Achernar, a crisp blue jewel spinning gracefully in the deep south.',
  betelgeuse: 'Right before you rests Betelgeuse, warm and vast, glowing like an elder orange campfire in the sky.',
  hadar: 'Straight ahead shines Hadar, a brilliant blue-white star luminous and calm in the southern reaches.',
  altair: 'Right ahead sparkles Altair, the swift-spinning white eagle star flying high in the dark.',
  acrux: 'Straight ahead burns Acrux, an icy blue beacon cherished by navigators for centuries.',
  aldebaran: 'Right before you burns Aldebaran, glowing with a deep rose-orange warmth across the autumn sky.',
  antares: 'Straight ahead in the dark glows Antares, the ruby heart of the Scorpion, pulsing with ancient red fire.',
  spica: 'Straight ahead shines Spica, a pure diamond-white star held like a sheaf of wheat in the quiet sky.',
  pollux: 'Right before you rests Pollux, steady and loyal, glowing with a warm and friendly orange hue.',
  castor: 'Straight ahead sparkles Castor, a silver twin made of six delicate suns dancing as one.',
  fomalhaut: 'Straight ahead shines Fomalhaut, a peaceful solitary white star glowing in the autumn sky.',
  deneb: 'Right before you shines Deneb, an immense white supergiant star marking the tail of the celestial Swan.',
  mimosa: 'Straight ahead sparkles Mimosa, a bright blue-white gem lighting the Southern Cross.',
  regulus: 'Right before you sparkles Regulus, proud and luminous, shining with crisp blue-white brilliance in the Lion.',
  adhara: 'Straight ahead glimmers Adhara, an intense beacon veiled in delicate blue-white light.',
  gacrux: 'Right before you glows Gacrux, a gentle ruby-red giant marking the head of the Southern Cross.',
  shaula: 'Straight ahead flashes Shaula, an icy blue spark in the tail of the Scorpion.',
  bellatrix: 'Straight ahead shines Bellatrix, the courageous blue-white star lighting Orion\'s shoulder.',
  elnath: 'Right before you shines Elnath, clear and steady in the northern sky.',
  miaplacidus: 'Right before you rests Miaplacidus, tranquil and bright, meaning peaceful waters.',
  alnilam: 'Right before you shines Alnilam, an immense pearl of sapphire light at the center of Orion\'s belt.',
  polaris: 'Straight ahead rests Polaris, the North Star, the steadfast pivot around which our entire night quietly turns.',

  // --- Big Dipper / Ursa Major ---
  dubhe: 'Straight ahead glows Dubhe, the steadfast golden pointer star leading your eyes to Polaris.',
  merak: 'Right before you shines Merak, partnering with Dubhe to point straight toward true north.',
  phecda: 'Straight ahead glimmers Phecda, a tranquil white star marking the bowl of the Great Bear.',
  megrez: 'Right before you sparkles Megrez, a delicate spark joining the bowl to the handle of the celestial dipper.',
  alioth: 'Straight ahead blazes Alioth, the brightest star along the sweeping tail of the Great Bear.',
  mizar: 'Right before you twinkles Mizar, accompanied by its faithful little companion Alcor in the sky.',
  alkaid: 'Straight ahead shines Alkaid, an icy blue star standing watch at the very tip of the dipper handle.',

  // --- Cassiopeia & Perseus ---
  schedar: 'Straight ahead glows Schedar, a warm orange giant resting in the throne of Cassiopeia.',
  caph: 'Right before you shines Caph, a pure white star spinning swiftly on the western edge of the royal throne.',
  'gamma cassiopeiae': 'Right before you blazes Gamma Cassiopeiae, an energetic sapphire star in the center of the celestial crown.',
  ruchbah: 'Straight ahead glimmers Ruchbah, a serene blue-white star in the zigzag of Cassiopeia.',
  segin: 'Right before you sparkles Segin, an icy blue pearl marking the eastern point of the Queen\'s throne.',
  mirfak: 'Straight ahead shines Mirfak, a brilliant golden-yellow supergiant leading the hero Perseus.',
  algol: 'Right before you burns Algol, the famous pulsing demon star whose light rhythmically dips and returns.',

  // --- Pegasus & Great Square ---
  alpheratz: 'Straight ahead sparkles Alpheratz, connecting Pegasus the winged horse to Andromeda.',
  scheat: 'Right before you glows Scheat, a vast deep-orange star resting at the top of the Great Square.',
  markab: 'Straight ahead shines Markab, a steady white guide star in the shoulder of Pegasus.',
  algenib: 'Right before you shines Algenib, an energetic blue star lighting the southern corner of the Great Square.',
  enif: 'Straight ahead glows Enif, a golden supergiant star marking the gentle muzzle of Pegasus.',

  // --- Orion & Winter Stars ---
  saiph: 'Straight ahead burns Saiph, an immense luminous blue star anchoring Orion\'s eastern knee.',
  mintaka: 'Right before you sparkles Mintaka, the westernmost pearl in Orion\'s belt, resting right on the celestial equator.',
  alnitak: 'Right before you shines Alnitak, a fierce triple star blazing with ultraviolet blue fire at Orion\'s belt.',
  menkalinan: 'Right before you shines Menkalinan, an icy blue pair of suns dancing close to bright Capella.',
  alcyone: 'Right before you sparkles Alcyone, the brilliant centerpiece of the shimmering Pleiades cluster.',
  wezen: 'Straight ahead glows Wezen, a colossal golden supergiant star shining in the Great Dog.',
  murzim: 'Right before you glimmers Murzim, the herald star that rises just before brilliant Sirius.',

  // --- Scorpius & Southern Navigators ---
  dschubba: 'Straight ahead shines Dschubba, a crisp blue star standing in the forehead of the Scorpion.',
  sargas: 'Right before you glows Sargas, a luminous yellow-white star curving along the tail of the Scorpion.',
  menkent: 'Straight ahead shines Menkent, a warm orange giant guiding travelers in the southern constellations.',
  peacock: 'Straight ahead shines Peacock, an elegant blue-white beacon lighting the southern reaches.',
  alphard: 'Right before you rests Alphard, the solitary orange heart of the celestial water snake.',
  hamal: 'Straight ahead shines Hamal, an ancient guide star shining clear in the ram Aries.',
  diphda: 'Right before you glimmers Diphda, a steady orange giant glowing peacefully in the southern sky.',
  nunki: 'Straight ahead shines Nunki, one of the oldest named stars in human history, lighting Sagittarius.',
  kaus: 'Right before you shines Kaus Australis, a radiant blue-white gem in the archer\'s bow.',
  atria: 'Straight ahead burns Atria, the brilliant orange anchor of the Southern Triangle.',
  avior: 'Right before you glows Avior, a deep orange supergiant guiding sailors across southern waters.',

  // --- Deep Sky Treasures ---
  m31: 'Straight ahead rests the Andromeda Galaxy, a quiet spiral island of a trillion suns glowing across cosmic time.',
  andromeda: 'Straight ahead rests the Andromeda Galaxy, a quiet spiral island of a trillion suns glowing across cosmic time.',
  m42: 'Straight ahead lies the Orion Nebula, a luminous cosmic cradle where fresh suns are gently opening their eyes.',
  m45: 'Straight ahead sparkle the Pleiades, the Seven Sisters, clustered like diamonds on dark velvet.',
  pleiades: 'Straight ahead sparkle the Pleiades, the Seven Sisters, clustered like diamonds on dark velvet.',
  m44: 'Straight ahead rests the Beehive Cluster, an ancient cloud of glittering stars resting peacefully in Cancer.',
  beehive: 'Straight ahead rests the Beehive Cluster, an ancient cloud of glittering stars resting peacefully in Cancer.',

  // --- Seasonal Meteor Radiants ---
  orionids: 'Straight ahead lies the path of the Orionids, where tiny dust grains from Halley\'s Comet streak into fire across the sky.',
  perseids: 'Straight ahead lies the path of the Perseids, where swift summer shooting stars flash across the dark.',
  geminids: 'Straight ahead lies the radiant of the Geminids, showering the December night with colorful meteors.',
  lyrids: 'Straight ahead lies the path of the Lyrids, one of humanity\'s oldest recorded meteor showers.'
};

export const DEFAULT_GEMMA_MODEL_ID = 'onnx-community/gemma-3-270m-it-ONNX';
export const GEMMA_1B_MODEL_ID = 'onnx-community/gemma-3-1b-it-ONNX';

export class GemmaEngine {
  constructor(options = {}) {
    this.options = options;
    this.modelId = options.modelId || DEFAULT_GEMMA_MODEL_ID;
    this.webgpuSupported = typeof navigator !== 'undefined' && 'gpu' in navigator;
    this.isModelLoaded = false;
    this.isLoading = false;
    this.pipelineInstance = null;
    this.modelInstance = null;
    this.chromeAiSession = null;
    this.worker = null;
    this.workerPendingRequests = new Map();
    this.workerRequestId = 0;
    this.downloadProgress = 0;
    this.downloadStatus = 'idle'; // 'idle', 'downloading', 'ready', 'fallback'
    this.activeDevice = 'none'; // 'webgpu', 'wasm', 'chrome_ai', or 'none'
    this.downloadMeta = { loadedMB: '0.0', totalMB: null };
    this.lastError = null;
  }

  /**
   * Checks whether Gemma model files already exist in CacheStorage.
   * @returns {Promise<boolean>}
   */
  async isModelCached() {
    if (typeof window === 'undefined' || !('caches' in window)) return false;
    try {
      const cache = await window.caches.open('transformers-cache');
      const keys = await cache.keys();
      return keys.some(r => r.url.includes('model_q4f16.onnx_data') || r.url.includes('model_q4.onnx_data'));
    } catch (_) {
      return false;
    }
  }

  /**
   * Checks whether the current device hardware supports WebGPU acceleration.
   * @returns {boolean}
   */
  hasWebGPU() {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  }

  /**
   * Pre-checks whether WebGPU hardware can allocate the 260MB model buffer.
   * Budget mobile devices limit maxBufferSize to 256MB.
   * @returns {Promise<boolean>}
   */
  async checkWebGPUCapacity() {
    const res = await this.verifyHardwareSupport();
    return res.supported;
  }

  /**
   * Pre-flight hardware validation before initiating any downloads.
   * Detects whether device GPU and drivers support ONNX WebGPU execution.
   * Qualcomm Adreno 6xx drivers hit known Emscripten execution provider crash (11460544).
   * @returns {Promise<{ supported: boolean, reason: string, info: Object }>}
   */
  async verifyHardwareSupport() {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      return {
        supported: false,
        reason: 'WebGPU unavailable on this browser. 80+ Local Catalog active.',
        info: null
      };
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        return {
          supported: false,
          reason: 'No GPU adapter available. 80+ Local Catalog active.',
          info: null
        };
      }

      const info = adapter.info || {};
      const vendor = String(info.vendor || '').toLowerCase();
      const arch = String(info.architecture || '').toLowerCase();

      // Mobile Qualcomm Adreno 6xx series GPUs hit known ONNX Runtime Web WebGPU context crash (11460544)
      if (vendor.includes('qualcomm') || arch.includes('adreno-6') || arch.includes('adreno 6')) {
        return {
          supported: false,
          reason: 'Mobile GPU hardware limit (Adreno 6xx). 80+ Local Catalog active.',
          info: { vendor, arch }
        };
      }

      const maxBuf = adapter.limits?.maxBufferSize || 0;
      if (maxBuf < 280 * 1024 * 1024) {
        return {
          supported: false,
          reason: 'GPU buffer limit below 280 MB. 80+ Local Catalog active.',
          info: { vendor, arch, maxBuf }
        };
      }

      return {
        supported: true,
        reason: 'WebGPU acceleration supported.',
        info: { vendor, arch }
      };
    } catch (err) {
      return {
        supported: false,
        reason: `GPU probe error (${err.message || err}). 80+ Local Catalog active.`,
        info: null
      };
    }
  }

  /**
   * Purges cached Transformers.js model weights from both CacheStorage and IndexedDB.
   * Cleanses browser storage completely to enable clean-slate testing.
   * @returns {Promise<boolean>}
   */
  async clearModelCache() {
    if (typeof window === 'undefined') return false;
    try {
      // 1. Purge CacheStorage (where Transformers.js caches downloaded ONNX models and PWA app shells)
      if ('caches' in window) {
        try {
          const keys = await window.caches.keys();
          for (const k of keys) {
            if (k.includes('transformers') || k.includes('gemma') || k.includes('scotopic-shell')) {
              await window.caches.delete(k);
            }
          }
        } catch (_) {}
      }

      // 2. Unregister Service Workers to guarantee clean shell reload
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            await reg.unregister();
          }
        } catch (_) {}
      }

      // 3. Purge IndexedDB databases
      if (typeof window !== 'undefined' && window.indexedDB) {
        const dbs = ['transformers-cache', 'onnx', 'local-forage'];
        for (const db of dbs) {
          try { window.indexedDB.deleteDatabase(db); } catch (_) {}
        }
      }

      // 4. Clear localStorage & sessionStorage
      if (typeof window !== 'undefined') {
        try { window.localStorage.clear(); } catch (_) {}
        try { window.sessionStorage.clear(); } catch (_) {}
      }

      // 5. Terminate worker if active
      if (this.worker) {
        try { this.worker.terminate(); } catch (_) {}
        this.worker = null;
      }

      this.downloadProgress = 0;
      this.downloadStatus = 'idle';
      this.isModelLoaded = false;
      this.activeDevice = 'none';
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Initializes on-device Google Gemma LLM execution.
   * Dual-backend: uses Chrome Built-in AI if present, WebGPU if supported,
   * or gracefully falls back to CPU WebAssembly (WASM) multithreading.
   * Offloaded entirely to a dedicated Web Worker to maintain 60 FPS UI on mobile.
   * Caches weights in IndexedDB across browser sessions.
   * @param {Object} [config] Model initialization configuration
   * @param {string} [config.modelId] HuggingFace ONNX Gemma model ID
   * @param {Function} [config.onProgress] Download progress callback (progress: number, meta: Object)
   * @returns {Promise<boolean>} True if model loaded, false if falling back
   */
  async initGemma(config = {}) {
    // 0. Pre-flight hardware validation: do not attempt download if hardware is unsupported
    const hwSupport = await this.verifyHardwareSupport();
    if (!hwSupport.supported) {
      this.isLoading = false;
      this.downloadStatus = 'fallback';
      this.lastError = hwSupport.reason;
      return false;
    }

    const targetModelId = config.modelId || this.modelId || DEFAULT_GEMMA_MODEL_ID;
    this.isLoading = true;
    this.downloadStatus = 'downloading';

    try {
      // 1. Check for Chrome Built-in AI (Prompt API running on-device Gemma / Gemini Nano)
      if (typeof window !== 'undefined' && window.ai && window.ai.languageModel) {
        try {
          const capabilities = await window.ai.languageModel.capabilities();
          if (capabilities && capabilities.available !== 'no') {
            this.chromeAiSession = await window.ai.languageModel.create({
              systemPrompt: GEMMA_SYSTEM_PROMPT
            });
            this.isModelLoaded = true;
            this.isLoading = false;
            this.downloadStatus = 'ready';
            this.downloadProgress = 100;
            this.activeDevice = 'chrome_ai';
            return true;
          }
        } catch (_) {}
      }

      // 2. Offload Transformers.js execution to Dedicated Web Worker
      if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
        return new Promise((resolve) => {
          try {
            const workerUrl = new URL('./gemma_worker.js', import.meta.url);
            this.worker = new Worker(workerUrl, { type: 'module' });
            const preferredDevice = this.hasWebGPU() ? 'webgpu' : 'wasm';
            const preferredDtype = preferredDevice === 'webgpu' ? 'q4f16' : 'q4';

            this.worker.addEventListener('message', (e) => {
              const { type, progress, id, text, error, loadedMB, totalMB, isWeightFile, device } = e.data || {};

              if (type === 'progress') {
                this.downloadProgress = progress;
                this.downloadMeta = { loadedMB, totalMB, isWeightFile };
                if (typeof config.onProgress === 'function') {
                  config.onProgress(progress, e.data);
                }
              } else if (type === 'ready') {
                this.isModelLoaded = true;
                this.isLoading = false;
                this.downloadStatus = 'ready';
                this.downloadProgress = 100;
                this.activeDevice = device || preferredDevice;
                resolve(true);
              } else if (type === 'generate_success') {
                const pending = this.workerPendingRequests.get(id);
                if (pending) {
                  this.workerPendingRequests.delete(id);
                  pending.resolve(text);
                }
              } else if (type === 'generate_error') {
                const pending = this.workerPendingRequests.get(id);
                if (pending) {
                  this.workerPendingRequests.delete(id);
                  pending.reject(new Error(error));
                }
              } else if (type === 'error') {
                this.isModelLoaded = false;
                this.isLoading = false;
                this.downloadStatus = 'fallback';
                this.activeDevice = 'none';
                this.lastError = error || 'Worker initialization failed';
                resolve(false);
              }
            });

            this.worker.addEventListener('error', (errEvent) => {
              this.isModelLoaded = false;
              this.isLoading = false;
              this.downloadStatus = 'fallback';
              this.activeDevice = 'none';
              this.lastError = errEvent?.message || 'Worker thread execution error';
              resolve(false);
            });

            this.worker.postMessage({
              type: 'init',
              payload: {
                modelId: targetModelId,
                device: preferredDevice,
                dtype: preferredDtype
              }
            });
          } catch (_) {
            this.isModelLoaded = false;
            this.isLoading = false;
            this.downloadStatus = 'fallback';
            this.activeDevice = 'none';
            resolve(false);
          }
        });
      }

      this.isModelLoaded = false;
      this.isLoading = false;
      this.downloadStatus = 'fallback';
      this.activeDevice = 'none';
      return false;
    } catch (_) {
      this.isModelLoaded = false;
      this.isLoading = false;
      this.downloadStatus = 'fallback';
      this.activeDevice = 'none';
      return false;
    }
  }

  /**
   * Backward-compatible alias for initGemma.
   */
  async initWebGPU(config = {}) {
    return this.initGemma(config);
  }

  /**
   * Translates horizontal heading delta into relative body turning guidance.
   * @param {number} deltaAzimuth Signed difference in degrees (targetAzimuth - currentAzimuth) in [-180, 180]
   * @returns {string} Plain-English body direction
   */
  generateTurnGuidance(deltaAzimuth) {
    if (Math.abs(deltaAzimuth) <= 3.0) {
      return "Slow down, you're right on it.";
    }
    if (deltaAzimuth > 15.0) {
      return "Turn to your right.";
    }
    if (deltaAzimuth > 0) {
      return "Turn a little to your right.";
    }
    if (deltaAzimuth < -15.0) {
      return "Turn to your left.";
    }
    return "Turn a little to your left.";
  }

  /**
   * Translates vertical pitch delta into natural head/chin tilt guidance.
   * @param {number} currentPitch Current pitch angle of phone/head in degrees [0, 90]
   * @param {number} targetAltitude Target elevation in degrees [0, 90]
   * @returns {string} Plain-English chin/head movement cue
   */
  generateTiltGuidance(currentPitch, targetAltitude) {
    const diff = targetAltitude - currentPitch;

    if (Math.abs(diff) <= 3.0) {
      return "Stop right there.";
    }
    if (diff > 8.0) {
      return "Tilt your head up slowly.";
    }
    if (diff > 0) {
      return "A little more...";
    }
    if (diff < -8.0) {
      return "Lower your head down slowly.";
    }
    return "A little lower...";
  }

  /**
   * Returns a concise, warm observational whisper for a target in pure darkness.
   * Synchronous lore implementation covering all navigation targets.
   * @param {string} targetName Celestial target identifier or name
   * @param {Object} [targetData] Optional celestial metadata (constellation, color, distLy)
   * @returns {string} Observational whisper text
   */
  generateObservationalWhisper(targetName, targetData = null) {
    const key = String(targetName || '').trim().toLowerCase();

    for (const [targetKey, text] of Object.entries(CELESTIAL_OBSERVATIONS)) {
      if (key.includes(targetKey) || targetKey.includes(key)) {
        return text;
      }
    }

    const cleanName = targetName ? String(targetName).trim() : 'a distant star';
    const constellation = targetData?.constellation ? ` in ${targetData.constellation}` : '';
    const color = targetData?.color || 'warm starlight';
    const dist = targetData?.distLy ? ` from ${targetData.distLy} light-years away` : '';
    return `Right before you shines ${cleanName}${constellation}, steady and clear with ${color}${dist}.`;
  }

  /**
   * Asynchronously generates an observational whisper.
   * If on-device WebGPU Gemma is loaded, generates dynamic observational lore via WebGPU.
   * Otherwise, immediately returns the bespoke observational text without blocking.
   * @param {string} targetName Celestial target name
   * @param {Object} [targetData] Optional celestial metadata
   * @returns {Promise<string>} Plain-English observational whisper
   */
  async generateWhisperAsync(targetName, targetData = null) {
    // 1. Chrome Built-in Gemma execution if active
    if (this.isModelLoaded && this.chromeAiSession && typeof this.chromeAiSession.prompt === 'function') {
      try {
        const prompt = `${GEMMA_SYSTEM_PROMPT}\nTarget: ${targetName}\nGive 1 gentle whispered sentence describing what they see:`;
        const response = await this.chromeAiSession.prompt(prompt);
        const clean = String(response || '').trim();
        if (clean) {
          this.validateJargonFree(clean);
          return clean;
        }
      } catch (_) {}
    }

    // 2. Dedicated Web Worker execution if active
    if (this.isModelLoaded && this.worker) {
      try {
        const id = ++this.workerRequestId;
        const prompt = `<bos><start_of_turn>user\n${GEMMA_SYSTEM_PROMPT}\nTarget: ${targetName}\nGive 1 gentle whispered sentence describing what they see:<end_of_turn>\n<start_of_turn>model\n`;
        const text = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.workerPendingRequests.delete(id);
            reject(new Error('Gemma worker generation timed out'));
          }, 5000);

          this.workerPendingRequests.set(id, {
            resolve: (res) => {
              clearTimeout(timeout);
              resolve(res);
            },
            reject: (err) => {
              clearTimeout(timeout);
              reject(err);
            }
          });

          this.worker.postMessage({
            type: 'generate',
            payload: { id, prompt, maxTokens: 40, temperature: 0.3 }
          });
        });

        const clean = String(text || '').trim();
        if (clean) {
          this.validateJargonFree(clean);
          return clean;
        }
      } catch (_) {}
    }

    return this.generateObservationalWhisper(targetName, targetData);
  }

  /**
   * Validates that text strictly conforms to the zero-jargon rule.
   * Throws an Error if any forbidden astronomical or mathematical term is detected.
   * @param {string} text Text to check
   * @returns {boolean} True if clean
   */
  validateJargonFree(text) {
    if (!text || typeof text !== 'string') return true;
    const match = text.match(FORBIDDEN_JARGON_REGEX);
    if (match) {
      throw new Error(`Strict Gemma grammar violation: prohibited word "${match[0]}" found in "${text}"`);
    }
    return true;
  }
}
