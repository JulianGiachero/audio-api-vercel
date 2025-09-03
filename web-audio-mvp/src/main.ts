import { AudioEngine } from './audio/AudioEngine';
import { ControlsUI } from './ui/controls';

const ui = new ControlsUI();

let engine: AudioEngine | null = null;

function ensureEngine(): AudioEngine {
  if (!engine) {
    engine = new AudioEngine({
      onStatus: (s) => ui.setStatus(s),
      onQueueUpdate: (n) => ui.setQueueLength(n),
      getParams: () => ui.getParams()
    });
  }
  return engine;
}

ui.onSpeedChange(() => {/* future: dynamic apply to next blocks only */});
ui.onVolumeChange(() => {/* handled when scheduling next block */});
ui.onBlockChange((s) => {
  if (engine) engine.setBlockSeconds(s);
});

ui.bindStart(async (blockSeconds) => {
  try {
    const eng = ensureEngine();
    await eng.start(blockSeconds);
  } catch (err) {
    console.error(err);
    ui.setStatus({ state: 'error', queueLength: 0, message: 'Error al iniciar: revisar permisos de micrófono' });
  }
});

ui.bindStop(() => {
  if (engine) engine.stop();
});

