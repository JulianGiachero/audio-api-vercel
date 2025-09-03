import type { EngineStatus, ProcessParams } from '../types';

export class ControlsUI {
  private statusEl = document.getElementById('status') as HTMLSpanElement;
  private queueCountEl = document.getElementById('queueCount') as HTMLSpanElement;
  private queueViewEl = document.getElementById('queueView') as HTMLDivElement;

  private btnStart = document.getElementById('btnStart') as HTMLButtonElement;
  private btnStop = document.getElementById('btnStop') as HTMLButtonElement;

  private speedInput = document.getElementById('speed') as HTMLInputElement;
  private speedVal = document.getElementById('speedVal') as HTMLSpanElement;

  private volumeInput = document.getElementById('volume') as HTMLInputElement;
  private volumeVal = document.getElementById('volumeVal') as HTMLSpanElement;

  private blockSelect = document.getElementById('block') as HTMLSelectElement;

  constructor() {}

  bindStart(handler: (blockSeconds: number) => void): void {
    this.btnStart.onclick = () => {
      const blockSeconds = parseInt(this.blockSelect.value, 10) || 5;
      handler(blockSeconds);
      this.btnStart.disabled = true;
      this.btnStop.disabled = false;
    };
  }

  bindStop(handler: () => void): void {
    this.btnStop.onclick = () => {
      handler();
      this.btnStart.disabled = false;
      this.btnStop.disabled = true;
    };
  }

  getParams(): ProcessParams {
    const speed = parseFloat(this.speedInput.value);
    const gain = parseFloat(this.volumeInput.value);
    const blockSizeSeconds = parseInt(this.blockSelect.value, 10) || 5;
    return { speed, gain, blockSizeSeconds };
  }

  onSpeedChange(cb: (v: number) => void): void {
    const update = () => {
      const v = parseFloat(this.speedInput.value);
      this.speedVal.textContent = `${v.toFixed(2)}×`;
      cb(v);
    };
    this.speedInput.addEventListener('input', update);
    update();
  }

  onVolumeChange(cb: (v: number) => void): void {
    const update = () => {
      const v = parseFloat(this.volumeInput.value);
      this.volumeVal.textContent = `${v.toFixed(2)}×`;
      cb(v);
    };
    this.volumeInput.addEventListener('input', update);
    update();
  }

  onBlockChange(cb: (seconds: number) => void): void {
    const update = () => {
      const s = parseInt(this.blockSelect.value, 10) || 5;
      cb(s);
    };
    this.blockSelect.addEventListener('change', update);
  }

  setStatus(s: EngineStatus): void {
    if (s.message) this.statusEl.textContent = s.message;
  }

  setQueueLength(n: number): void {
    this.queueCountEl.textContent = `${n}`;
    this.queueViewEl.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = `${12 + ((i % 3) * 6)}px`;
      this.queueViewEl.appendChild(bar);
    }
  }
}

