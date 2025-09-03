import { BlockQueue } from './BlockQueue';
import type { AudioBlock, EngineStatus, ProcessParams } from '../types';

export class AudioEngine {
  private context: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaNode: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  private blockQueue = new BlockQueue();

  private blockSeconds = 5;
  private sampleRate = 44100;
  private recording = false;
  private capturing = false;
  private captureBuffer: Float32Array | null = null;
  private captureOffset = 0;
  private scriptNode: ScriptProcessorNode | null = null; // For MVP capture simplicity

  private nextBlockId = 1;
  private lastScheduledEnd = 0;

  private onStatus: (s: EngineStatus) => void;
  private onQueueUpdate: (qLen: number) => void;
  private getParams: () => ProcessParams;

  constructor(opts: {
    onStatus: (s: EngineStatus) => void;
    onQueueUpdate: (qLen: number) => void;
    getParams: () => ProcessParams;
  }) {
    this.onStatus = opts.onStatus;
    this.onQueueUpdate = opts.onQueueUpdate;
    this.getParams = opts.getParams;
  }

  async init(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext({ sampleRate: this.sampleRate, latencyHint: 'interactive' });
      // Worklet is optional for MVP (phase 1 will use it). Ignore load errors.
      try {
        // Vite will transform URL at build time if referenced relatively from a module.
        // For MVP we do not rely on the processor, so failures are non-fatal.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const url = new URL('../audio/Processor.worklet.ts', import.meta.url);
        await this.context.audioWorklet.addModule(url as unknown as string);
      } catch (err) {
        console.warn('AudioWorklet no cargado (MVP continúa con ScriptProcessorNode):', err);
      }
    }
  }

  async start(blockSeconds: number): Promise<void> {
    this.blockSeconds = Math.max(2, Math.min(10, Math.floor(blockSeconds)));
    this.onStatus({ state: 'requesting-permission', queueLength: this.blockQueue.length, message: 'Solicitando permisos…' });

    await this.init();
    const ctx = this.context!;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
        sampleRate: this.sampleRate
      }
    });
    this.mediaStream = stream;

    this.mediaNode = ctx.createMediaStreamSource(stream);
    this.gainNode = ctx.createGain();
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -6;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    // Capture path using ScriptProcessorNode for simplicity of block buffering
    const bufferSize = 2048; // conservative
    this.scriptNode = ctx.createScriptProcessor(bufferSize, 1, 1);
    this.mediaNode.connect(this.scriptNode);
    this.scriptNode.connect(ctx.destination); // keep node alive (won't monitor output)

    const blockFrames = this.blockSeconds * this.sampleRate;
    this.captureBuffer = new Float32Array(blockFrames);
    this.captureOffset = 0;
    this.capturing = true;
    this.recording = true;

    this.scriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
      if (!this.capturing || !this.captureBuffer) return;
      const input = e.inputBuffer.getChannelData(0);
      let i = 0;
      while (i < input.length) {
        const remaining = this.captureBuffer.length - this.captureOffset;
        const toCopy = Math.min(remaining, input.length - i);
        this.captureBuffer.set(input.subarray(i, i + toCopy), this.captureOffset);
        this.captureOffset += toCopy;
        i += toCopy;
        if (this.captureOffset >= this.captureBuffer.length) {
          const block: AudioBlock = {
            id: this.nextBlockId++,
            ts: performance.now(),
            pcm: this.captureBuffer,
            sampleRate: this.sampleRate
          };
          this.blockQueue.enqueue(block);
          this.onQueueUpdate(this.blockQueue.length);
          // prepare next buffer
          this.captureBuffer = new Float32Array(this.blockSeconds * this.sampleRate);
          this.captureOffset = 0;
          // attempt to schedule playback for new block
          this.scheduleNextIfPossible();
        }
      }
    };

    this.onStatus({ state: 'recording', queueLength: this.blockQueue.length, message: `Grabación OK, encolando bloques… Bloque=${this.blockSeconds}s` });
  }

  stop(): void {
    this.recording = false;
    this.capturing = false;
    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode.onaudioprocess = null;
      this.scriptNode = null;
    }
    if (this.mediaNode) {
      this.mediaNode.disconnect();
      this.mediaNode = null;
    }
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) track.stop();
      this.mediaStream = null;
    }
    this.blockQueue.clear();
    this.onQueueUpdate(0);
    this.lastScheduledEnd = 0;
    this.onStatus({ state: 'stopped', queueLength: 0, message: 'Detenido' });
  }

  private scheduleNextIfPossible(): void {
    const ctx = this.context!;
    if (!ctx || !this.recording) return;
    // Schedule as many blocks as available to avoid gaps; keep a small lookahead
    const lookaheadSeconds = 0.2;
    let scheduledAny = false;
    while (this.blockQueue.length > 0 && (this.lastScheduledEnd === 0 || this.lastScheduledEnd < ctx.currentTime + lookaheadSeconds)) {
      const next = this.blockQueue.dequeue()!;
      this.onQueueUpdate(this.blockQueue.length);

      const { gain, speed } = this.getParams();

      const audioBuffer = ctx.createBuffer(1, next.pcm.length, next.sampleRate);
      const channel0 = audioBuffer.getChannelData(0);
      channel0.set(next.pcm);

      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.playbackRate.value = speed;

      const blockGain = ctx.createGain();
      blockGain.gain.value = Math.max(0.0, gain);

      const blockComp = ctx.createDynamicsCompressor();
      blockComp.threshold.value = -3;
      blockComp.knee.value = 18;
      blockComp.ratio.value = 2.5;
      blockComp.attack.value = 0.002;
      blockComp.release.value = 0.2;

      src.connect(blockGain).connect(blockComp).connect(ctx.destination);

      const now = ctx.currentTime;
      const blockDuration = audioBuffer.duration / speed;
      const startAt = Math.max(now + 0.05, this.lastScheduledEnd || now + 0.05);
      src.start(startAt);
      const endAt = startAt + blockDuration;
      this.lastScheduledEnd = endAt;

      src.onended = () => {
        // Attempt to extend schedule further when something finishes
        this.scheduleNextIfPossible();
      };
      scheduledAny = true;
      this.onStatus({ state: 'recording', queueLength: this.blockQueue.length, message: `Reproducción secuencial: programado bloque #${next.id}` });
    }
    if (!scheduledAny) {
      // nothing to schedule yet
    }
  }

  setBlockSeconds(seconds: number): void {
    const newSeconds = Math.max(2, Math.min(10, Math.floor(seconds)));
    this.blockSeconds = newSeconds;
  }
}

