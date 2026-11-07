export const initialState = {
  runtime: {
    enabled: true,
    bpm: 120,
    cross: 0.5,
    frame: 0,
    now: 0,
    dt: 0
  },
  render: {
    width: 0,
    height: 0,
    mode: 'auto',
    gpuReady: false
  },
  mapping: {
    outputs: []
  },
  output: {
    mode: 'preview',
    enabled: false,
    queueDepth: 0,
    dropped: 0,
    lastLatencyMs: 0,
    lastSendMs: 0
  },
  ui: {
    screen: 'performance',
    previewMode: 'pixel',
    previewFps: 20,
    debugOpen: false
  }
};
