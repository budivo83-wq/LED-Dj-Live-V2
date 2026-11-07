export const RUNTIME_DEBUG_VERSION = "3A-runtime-debug-extracted";

export function installRuntimeDebugHook(options = {}) {
  const {
    windowRef = globalThis,
    getHeadless = () => false,
    getShellViewOnly = () => false,
    getEnabled = () => false,
    getStartupFrameGuard = () => false,
    getDimensions = () => ({ width: 0, height: 0 }),
    getPreviewMode = () => "pixel",
    isHeadlessLeaderActive = () => false,
    getModules = () => ({}),
    getState = () => ({}),
    renderPixelColor = () => [0, 0, 0]
  } = options;

  windowRef.__ledDebug = () => {
    const { width: W = 0, height: H = 0 } = getDimensions() || {};
    const state = getState() || {};
    const modules = getModules() || {};
    const points = [
      [0, 0],
      [Math.floor(W / 2), Math.floor(H / 2)],
      [Math.max(0, W - 1), Math.max(0, H - 1)],
      [Math.min(10, Math.max(0, W - 1)), Math.min(10, Math.max(0, H - 1))]
    ];

    return {
      headless: Boolean(getHeadless()),
      shellViewOnly: Boolean(getShellViewOnly()),
      enabled: Boolean(getEnabled()),
      startupFrameGuard: Boolean(getStartupFrameGuard()),
      dimensions: { width: W, height: H },
      previewMode: getPreviewMode(),
      headlessLeaderActive: Boolean(isHeadlessLeaderActive()),
      modules: {
        l1: {
          anim: Boolean(modules.l1?.anim?.render),
          palette: Boolean(modules.l1?.palette?.color),
          animFile: state.l1?.animFile,
          paletteFile: state.l1?.paletteFile,
          enabled: state.l1?.enabled,
          master: state.l1?.master,
          blackout: state.l1?.blackout
        },
        l2: {
          anim: Boolean(modules.l2?.anim?.render),
          palette: Boolean(modules.l2?.palette?.color),
          animFile: state.l2?.animFile,
          paletteFile: state.l2?.paletteFile,
          enabled: state.l2?.enabled,
          master: state.l2?.master,
          blackout: state.l2?.blackout
        }
      },
      cross: state.cross,
      master: state.master,
      samples: points.map(([x, y]) => ({
        x,
        y,
        l1: renderPixelColor("l1", x, y, 1),
        l2: renderPixelColor("l2", x, y, 1)
      }))
    };
  };

  return windowRef.__ledDebug;
}
