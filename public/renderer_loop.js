export function createRendererLoopState() {
  let t = 0;
  return {
    getTime: () => t,
    setTime: (next) => { t = next; },
    stepTime: (delta) => { t += delta; return t; }
  };
}

