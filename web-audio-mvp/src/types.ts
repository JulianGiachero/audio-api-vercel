export interface AudioBlock {
  id: number;
  ts: number; // performance.now() when closed
  pcm: Float32Array; // mono PCM, Float32
  sampleRate: number;
}

export interface ProcessParams {
  speed: number; // 0.4–1.5 (fase 0 usa playbackRate)
  gain: number;  // 0.5–3.0
  blockSizeSeconds: number; // 2–10
}

export type EngineState =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'stopped'
  | 'error';

export interface EngineStatus {
  state: EngineState;
  message?: string;
  queueLength: number;
}

