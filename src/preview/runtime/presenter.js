export function createPreviewPresenter(adapter = null) {
  const sink = adapter || {
    draw(frame, mode) {
      void frame;
      void mode;
    }
  };

  return {
    present(frame, mode, meta = {}) {
      sink.draw(frame, mode, meta);
    }
  };
}
