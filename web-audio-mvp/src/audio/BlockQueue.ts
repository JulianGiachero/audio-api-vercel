import type { AudioBlock } from '../types';

export class BlockQueue {
  private queue: AudioBlock[] = [];

  enqueue(block: AudioBlock): void {
    this.queue.push(block);
  }

  dequeue(): AudioBlock | undefined {
    return this.queue.shift();
  }

  peek(): AudioBlock | undefined {
    return this.queue[0];
  }

  clear(): void {
    this.queue.length = 0;
  }

  get length(): number {
    return this.queue.length;
  }

  toArray(): AudioBlock[] {
    return [...this.queue];
  }
}

