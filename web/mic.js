const TARGET_SAMPLE_RATE = 24000

const WORKLET_CODE = `
class PCMDownsampler extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.targetRate = (options.processorOptions && options.processorOptions.targetRate) || 24000;
    this.ratio = sampleRate / this.targetRate;
    this.pos = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];
    const out = [];
    for (; this.pos < ch.length; this.pos += this.ratio) {
      const start = Math.floor(this.pos);
      const end = Math.min(ch.length, Math.ceil(this.pos + this.ratio));
      let sum = 0, count = 0;
      for (let index = start; index < end; index += 1) { sum += ch[index]; count += 1; }
      out.push(count ? sum / count : (ch[start] || 0));
    }
    this.pos -= ch.length;
    const pcm = new Int16Array(out.length);
    for (let index = 0; index < out.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, out[index]));
      pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    return true;
  }
}
registerProcessor('sales-avatar-pcm-downsampler', PCMDownsampler);
`

export async function startMicCapture(onAudio, onLevel = () => {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  })
  const context = new AudioContext()
  if (context.state === 'suspended') await context.resume()

  const moduleUrl = URL.createObjectURL(new Blob([WORKLET_CODE], { type: 'application/javascript' }))
  try {
    await context.audioWorklet.addModule(moduleUrl)
  } finally {
    URL.revokeObjectURL(moduleUrl)
  }

  const source = context.createMediaStreamSource(stream)
  const worklet = new AudioWorkletNode(context, 'sales-avatar-pcm-downsampler', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    processorOptions: { targetRate: TARGET_SAMPLE_RATE },
  })
  const analyser = context.createAnalyser()
  analyser.fftSize = 512
  source.connect(analyser)
  source.connect(worklet)

  const mute = context.createGain()
  mute.gain.value = 0
  worklet.connect(mute)
  mute.connect(context.destination)

  worklet.port.onmessage = event => {
    const buffer = event.data
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength === 0) return
    const samples = new Int16Array(buffer)
    let sum = 0
    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index] || 0
      sum += sample * sample
    }
    onLevel(Math.sqrt(sum / Math.max(1, samples.length)) / 0x8000)
    onAudio(buffer)
  }

  return {
    analyser,
    setMuted(muted) {
      for (const track of stream.getAudioTracks()) track.enabled = !muted
    },
    stop() {
      worklet.port.onmessage = null
      worklet.disconnect()
      mute.disconnect()
      analyser.disconnect()
      source.disconnect()
      stream.getTracks().forEach(track => track.stop())
      void context.close()
    },
  }
}
