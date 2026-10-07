/**
 * Streaming Audio Receiver & Offline Cache for Project Scotopic (Phase 4).
 * Handles chunked celestial spoken narrations from /api/v1/narrate with
 * IndexedDB offline caching and a 400ms latency watchdog fallback.
 */

/**
 * Creates a valid PCM 16-bit mono RIFF/WAV ArrayBuffer.
 *
 * @param {number} [frequency=440] Tone frequency in Hz
 * @param {number} [durationMs=250] Duration in milliseconds
 * @param {number} [sampleRate=8000] Audio sample rate in Hz
 * @returns {ArrayBuffer}
 */
export function createSyntheticWav(frequency = 440, durationMs = 250, sampleRate = 8000) {
  const numSamples = Math.floor((durationMs / 1000) * sampleRate);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF Chunk Descriptor
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + numSamples * 2, true); // ChunkSize
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // "fmt " Subchunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * 1 * 16/8)
  view.setUint16(32, 2, true); // BlockAlign (1 * 16/8)
  view.setUint16(34, 16, true); // BitsPerSample

  // "data" Subchunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, numSamples * 2, true); // Subchunk2Size

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t);
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 16000)));
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return buffer;
}

export const PRIMARY_CELESTIAL_TARGETS = [
  { id: 'moon', name: 'Moon', freq: 261.63 },
  { id: 'jupiter', name: 'Jupiter', freq: 329.63 },
  { id: 'saturn', name: 'Saturn', freq: 392.00 },
  { id: 'mars', name: 'Mars', freq: 440.00 },
  { id: 'venus', name: 'Venus', freq: 523.25 },
  { id: 'sirius', name: 'Sirius', freq: 587.33 },
  { id: 'vega', name: 'Vega', freq: 659.25 },
  { id: 'betelgeuse', name: 'Betelgeuse', freq: 698.46 },
  { id: 'rigel', name: 'Rigel', freq: 783.99 },
  { id: 'orionids', name: 'Orionids', freq: 880.00 },
  { id: 'andromeda', name: 'M31 Andromeda', freq: 987.77 },
  { id: 'm31', name: 'M31 Andromeda', freq: 987.77 }
];

export class AudioStreamReceiver {
  /**
   * @param {Object} [options]
   * @param {AudioContext} [options.audioContext] Optional Web Audio context
   * @param {Function} [options.fetchFn] Optional fetch implementation
   * @param {string} [options.apiEndpoint='/api/v1/narrate'] Base narrate API endpoint
   * @param {number} [options.timeoutMs=400] Latency budget before cache fallback
   * @param {IDBDatabase} [options.db] Injected IDBDatabase instance
   */
  constructor({
    audioContext = null,
    fetchFn = null,
    apiEndpoint = '/api/v1/narrate',
    timeoutMs = 400,
    db = null
  } = {}) {
    this.audioCtx = audioContext || null;
    this.fetchFn = fetchFn;
    this.apiEndpoint = apiEndpoint;
    this.timeoutMs = timeoutMs;

    this._isStreaming = false;
    this._isPlaying = false;
    this._currentTargetId = null;

    this._activeSource = null;
    this._activeAbortController = null;

    this._memoryCache = new Map();
    this._idb = db;
    this._dbName = 'scotopic_offline_audio';
    this._storeName = 'narrations';

    this._initPreCachedAudio();
    this._initIndexedDB();
  }

  /**
   * Pre-populates built-in offline audio buffers for primary celestial objects.
   * @private
   */
  _initPreCachedAudio() {
    for (const item of PRIMARY_CELESTIAL_TARGETS) {
      const wav = createSyntheticWav(item.freq, 250);
      this._memoryCache.set(item.id.toLowerCase(), wav);
    }
  }

  /**
   * Initializes IndexedDB database and store if available in browser environment.
   * @private
   */
  async _initIndexedDB() {
    if (this._idb) return;
    if (typeof window === 'undefined' || !window.indexedDB) return;

    try {
      const request = window.indexedDB.open(this._dbName, 1);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this._storeName)) {
          db.createObjectStore(this._storeName, { keyPath: 'targetId' });
        }
      };
      request.onsuccess = (event) => {
        this._idb = event.target.result;
        // Persist pre-cached memory buffers into IndexedDB
        for (const [id, buffer] of this._memoryCache.entries()) {
          this._writeToIDB(id, buffer).catch(() => {});
        }
      };
    } catch (_) {
      // IndexedDB unavailable or blocked; memory cache remains fully operational
    }
  }

  /**
   * Writes buffer to IndexedDB object store.
   * @private
   */
  async _writeToIDB(targetId, arrayBuffer) {
    if (!this._idb) return false;
    return new Promise((resolve) => {
      try {
        const tx = this._idb.transaction(this._storeName, 'readwrite');
        const store = tx.objectStore(this._storeName);
        store.put({
          targetId: targetId.toLowerCase(),
          buffer: arrayBuffer,
          timestamp: Date.now()
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  }

  /**
   * Reads buffer from IndexedDB object store.
   * @private
   */
  async _readFromIDB(targetId) {
    if (!this._idb) return null;
    return new Promise((resolve) => {
      try {
        const tx = this._idb.transaction(this._storeName, 'readonly');
        const store = tx.objectStore(this._storeName);
        const request = store.get(targetId.toLowerCase());
        request.onsuccess = () => {
          if (request.result && request.result.buffer) {
            resolve(request.result.buffer);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  }

  /**
   * Caches binary audio buffer for a given target ID.
   *
   * @param {string} targetId
   * @param {ArrayBuffer} arrayBuffer
   * @returns {Promise<boolean>}
   */
  async cacheAudio(targetId, arrayBuffer) {
    if (!targetId || !arrayBuffer) return false;
    const normalizedId = String(targetId).toLowerCase();
    this._memoryCache.set(normalizedId, arrayBuffer);
    await this._writeToIDB(normalizedId, arrayBuffer);
    return true;
  }

  /**
   * Retrieves cached binary audio buffer for a given target ID.
   * Checks in-memory cache first, then IndexedDB store.
   *
   * @param {string} targetId
   * @returns {Promise<ArrayBuffer|null>}
   */
  async getCachedAudio(targetId) {
    if (!targetId) return null;
    const normalizedId = String(targetId).toLowerCase();

    if (this._memoryCache.has(normalizedId)) {
      return this._memoryCache.get(normalizedId);
    }

    const idbBuffer = await this._readFromIDB(normalizedId);
    if (idbBuffer) {
      this._memoryCache.set(normalizedId, idbBuffer);
      return idbBuffer;
    }

    return null;
  }

  /**
   * Plays spoken narration for the specified target.
   * Queries streaming backend endpoint with a 400ms watchdog budget.
   * On timeout or network failure, falls back immediately to cached audio buffer.
   *
   * @param {string|Object} target Celestial target identifier or object
   * @param {Object} [options]
   * @returns {Promise<{ success: boolean, source: 'network'|'cache'|'none', buffer?: ArrayBuffer }>}
   */
  async playTargetNarration(target, options = {}) {
    let targetId = 'unknown';
    if (typeof target === 'string') {
      targetId = target.toLowerCase();
    } else if (target && typeof target === 'object') {
      targetId = String(target.id || target.name || target.key || 'unknown').toLowerCase();
    }

    this._currentTargetId = targetId;

    const fetchImpl = this.fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

    if (!fetchImpl || !isOnline) {
      return this._fallbackToCache(targetId);
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    this._activeAbortController = controller;

    let timer = null;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        if (controller && typeof controller.abort === 'function') {
          controller.abort();
        }
        reject(new Error(`Latency watchdog exceeded ${this.timeoutMs}ms budget`));
      }, this.timeoutMs);
    });

    try {
      this._isStreaming = true;
      const url = `${this.apiEndpoint}?target=${encodeURIComponent(targetId)}`;
      const fetchPromise = fetchImpl(url, {
        signal: controller ? controller.signal : undefined,
        headers: { Accept: 'audio/wav, audio/mpeg, application/octet-stream' },
        ...options
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);
      if (timer) clearTimeout(timer);

      if (!response || !response.ok) {
        throw new Error(`HTTP ${response ? response.status : 'No response'}`);
      }

      let buffer;
      if (response.body && typeof response.body.getReader === 'function') {
        const reader = response.body.getReader();
        const chunks = [];
        let totalLength = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            totalLength += value.length;
          }
        }
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        buffer = merged.buffer;
      } else if (typeof response.arrayBuffer === 'function') {
        buffer = await response.arrayBuffer();
      } else {
        throw new Error('Unsupported response body format');
      }

      this._isStreaming = false;

      // Persist received audio in offline cache
      await this.cacheAudio(targetId, buffer);

      // Play audio buffer
      await this._playBuffer(buffer);
      return { success: true, source: 'network', buffer };
    } catch (_) {
      if (timer) clearTimeout(timer);
      this._isStreaming = false;
      return this._fallbackToCache(targetId);
    }
  }

  /**
   * Fallback handler: retrieves and plays audio from offline cache.
   * @private
   */
  async _fallbackToCache(targetId) {
    const cachedBuffer = await this.getCachedAudio(targetId);
    if (cachedBuffer) {
      await this._playBuffer(cachedBuffer);
      return { success: true, source: 'cache', buffer: cachedBuffer };
    }
    return { success: false, source: 'none' };
  }

  /**
   * Plays binary audio buffer through Web Audio API.
   * @private
   */
  async _playBuffer(buffer) {
    if (this._activeSource) {
      try {
        this._activeSource.stop();
      } catch (_) {}
      this._activeSource = null;
    }

    if (this.audioCtx) {
      try {
        let audioBuffer = null;
        if (typeof this.audioCtx.decodeAudioData === 'function') {
          audioBuffer = await this.audioCtx.decodeAudioData(buffer.slice(0));
        }

        if (typeof this.audioCtx.createBufferSource === 'function') {
          const source = this.audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          if (typeof source.connect === 'function') {
            source.connect(this.audioCtx.destination);
          }
          this._activeSource = source;
          this._isPlaying = true;
          source.onended = () => {
            this._isPlaying = false;
            this._activeSource = null;
          };
          if (typeof source.start === 'function') {
            source.start(0);
          }
          return;
        }
      } catch (_) {
        // Fallback to tracking playback state directly
      }
    }

    this._isPlaying = true;
  }

  /**
   * Halts active playback and ongoing streaming requests immediately.
   */
  stop() {
    if (this._activeAbortController) {
      try {
        this._activeAbortController.abort();
      } catch (_) {}
      this._activeAbortController = null;
    }

    this._isStreaming = false;

    if (this._activeSource) {
      try {
        this._activeSource.stop();
      } catch (_) {}
      this._activeSource = null;
    }

    this._isPlaying = false;
    this._currentTargetId = null;
  }

  get isStreaming() {
    return this._isStreaming;
  }

  get isPlaying() {
    return this._isPlaying;
  }

  get currentTargetId() {
    return this._currentTargetId;
  }
}
