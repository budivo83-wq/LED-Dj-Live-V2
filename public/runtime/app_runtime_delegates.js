export function createSerialRowDelegates({ setSerialRows, getSerialRows }) {
  return {
    setSerialReversedRows: (rows) => setSerialRows("reversed", rows),
    setSerialEnabledRows: (rows) => setSerialRows("enabled", rows),
    setSerialBrightnessRows: (rows) => setSerialRows("brightness", rows),
    setSerialPixelLimitRows: (rows) => setSerialRows("pixelLimit", rows),
    setSerialOutputRouteRows: (rows) => setSerialRows("outputRoute", rows),
    setSerialColorOrderRows: (rows) => setSerialRows("colorOrder", rows),
    getSerialReversedRows: () => getSerialRows("reversed"),
    getSerialEnabledRows: () => getSerialRows("enabled"),
    getSerialBrightnessRows: () => getSerialRows("brightness"),
    getSerialPixelLimitRows: () => getSerialRows("pixelLimit"),
    getSerialOutputRouteRows: () => getSerialRows("outputRoute"),
    getSerialColorOrderRows: () => getSerialRows("colorOrder")
  };
}

export function createRuntimeTimingDelegates({
  getBeatStartedAt,
  setBeatStartedAt,
  getLastTap,
  setLastTap,
  getSerialFrameBusy,
  setSerialFrameBusy,
  getLastSerialFrameAt,
  setLastSerialFrameAt,
  getSerialPauseUntil,
  setSerialPauseUntil,
  getSerialConflictCount,
  setSerialConflictCount
}) {
  return {
    getBeatStartedAt,
    setBeatStartedAt,
    getLastTap,
    setLastTap,
    getSerialFrameBusy,
    setSerialFrameBusy,
    getLastSerialFrameAt,
    setLastSerialFrameAt,
    getSerialPauseUntil,
    setSerialPauseUntil,
    getSerialConflictCount,
    setSerialConflictCount
  };
}

export function createViewportDelegates({ setViewportSize, getWidth, getHeight }) {
  return {
    setViewportSize,
    getWidth,
    getHeight
  };
}

export function createOutputModeDelegates({ getOutputMode }) {
  return {
    getOutputMode
  };
}
