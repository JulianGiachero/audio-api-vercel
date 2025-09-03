// Phase vocoder placeholder. For MVP, we won't do time-stretch here.
// This AudioWorkletProcessor can be extended in Iteration 2.

class PassthroughProcessor extends AudioWorkletProcessor {
  override process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !output) return true;
    const inputChannel = input[0];
    const outputChannel = output[0];
    if (!inputChannel || !outputChannel) return true;
    const in0 = inputChannel;
    const out0 = outputChannel;
    const frames = Math.min(in0.length, out0.length);
    for (let i = 0; i < frames; i++) {
      out0[i] = in0[i];
    }
    return true;
  }
}

registerProcessor('passthrough-processor', PassthroughProcessor);

