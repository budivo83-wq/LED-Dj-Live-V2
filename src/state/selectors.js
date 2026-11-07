export const selectors = {
  runtime: (s) => s.runtime,
  render: (s) => s.render,
  mapping: (s) => s.mapping,
  output: (s) => s.output,
  ui: (s) => s.ui,
  pipelineSnapshot: (s) => ({
    state: {
      ...s.runtime,
      ...s.render,
      outputMode: s.output.mode,
      outputEnabled: s.output.enabled,
      previewMode: s.ui.previewMode
    },
    frame: {
      now: Number(s.runtime.now || 0),
      dt: Number(s.runtime.dt || 0),
      frame: Number(s.runtime.frame || 0)
    }
  })
};
