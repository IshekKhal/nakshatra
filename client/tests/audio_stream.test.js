import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AudioStreamReceiver, createSyntheticWav } from '../src/audio_stream.js';

describe('AudioStreamReceiver', () => {
  it('Test 1: AudioStreamReceiver initializes in idle state with disconnected streaming flag', () => {
    const receiver = new AudioStreamReceiver();

    assert.strictEqual(receiver.isStreaming, false);
    assert.strictEqual(receiver.isPlaying, false);
    assert.strictEqual(receiver.currentTargetId, null);
  });

  it('Test 2: cacheAudio stores binary buffer and getCachedAudio retrieves exact binary contents', async () => {
    const receiver = new AudioStreamReceiver();

    const testPayload = new Uint8Array([10, 20, 30, 40, 50, 60, 255]);
    const testBuffer = testPayload.buffer;

    const stored = await receiver.cacheAudio('custom_quasar', testBuffer);
    assert.strictEqual(stored, true);

    const retrieved = await receiver.getCachedAudio('custom_quasar');
    assert.ok(retrieved instanceof ArrayBuffer);

    const retrievedView = new Uint8Array(retrieved);
    assert.deepStrictEqual(retrievedView, testPayload);

    // Verify case-insensitivity
    const retrievedUpper = await receiver.getCachedAudio('CUSTOM_QUASAR');
    assert.deepStrictEqual(new Uint8Array(retrievedUpper), testPayload);
  });

  it('Test 3: Streaming request receives and buffers chunked audio', async () => {
    const chunk1 = new Uint8Array([1, 2, 3, 4]);
    const chunk2 = new Uint8Array([5, 6, 7, 8]);
    let chunksRead = 0;

    // ReadableStream test double delivering chunked audio stream
    const mockBody = {
      getReader() {
        return {
          async read() {
            if (chunksRead === 0) {
              chunksRead++;
              return { done: false, value: chunk1 };
            }
            if (chunksRead === 1) {
              chunksRead++;
              return { done: false, value: chunk2 };
            }
            return { done: true, value: undefined };
          }
        };
      }
    };

    const mockFetch = async (url) => {
      assert.ok(url.includes('target=vega'));
      return {
        ok: true,
        status: 200,
        body: mockBody
      };
    };

    const receiver = new AudioStreamReceiver({
      fetchFn: mockFetch,
      timeoutMs: 400
    });

    const result = await receiver.playTargetNarration('vega');

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.source, 'network');
    assert.strictEqual(receiver.isStreaming, false);
    assert.strictEqual(receiver.isPlaying, true);
    assert.strictEqual(receiver.currentTargetId, 'vega');

    // Verify all chunks were concatenated and persisted in cache
    const cached = await receiver.getCachedAudio('vega');
    assert.ok(cached);
    const cachedBytes = new Uint8Array(cached);
    assert.deepStrictEqual(cachedBytes, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
  });

  it('Test 4: Network failure or timeout past 400ms triggers offline cache fallback immediately', async () => {
    // 4a. Network failure triggers immediate fallback to pre-cached offline audio
    const failingFetch = async () => {
      throw new Error('503 Service Unavailable');
    };

    const receiverFail = new AudioStreamReceiver({
      fetchFn: failingFetch,
      timeoutMs: 400
    });

    const failResult = await receiverFail.playTargetNarration('jupiter');
    assert.strictEqual(failResult.success, true);
    assert.strictEqual(failResult.source, 'cache');
    assert.strictEqual(receiverFail.isPlaying, true);
    assert.strictEqual(receiverFail.isStreaming, false);
    assert.ok(failResult.buffer instanceof ArrayBuffer);
    assert.ok(failResult.buffer.byteLength > 44); // Contains valid WAV

    // 4b. Timeout past budget triggers abort and offline cache fallback
    let wasAborted = false;
    const slowFetch = async (_url, options) => {
      return new Promise((resolve, reject) => {
        if (options && options.signal) {
          options.signal.addEventListener('abort', () => {
            wasAborted = true;
            reject(new Error('AbortError'));
          });
        }
        setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            async arrayBuffer() {
              return new ArrayBuffer(10);
            }
          });
        }, 300);
      });
    };

    const receiverTimeout = new AudioStreamReceiver({
      fetchFn: slowFetch,
      timeoutMs: 50 // Short budget to trigger watchdog
    });

    const timeoutResult = await receiverTimeout.playTargetNarration('moon');
    assert.strictEqual(timeoutResult.success, true);
    assert.strictEqual(timeoutResult.source, 'cache');
    assert.strictEqual(wasAborted, true);
    assert.strictEqual(receiverTimeout.isPlaying, true);
    assert.strictEqual(receiverTimeout.isStreaming, false);
    assert.ok(timeoutResult.buffer instanceof ArrayBuffer);
  });
});
