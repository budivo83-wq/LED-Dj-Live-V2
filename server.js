import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createShutdownController } from "./src/server/shutdown_controller.js";
import { createSerialController } from "./src/server/serial_controller.js";
import { createAuthController } from "./src/server/auth_controller.js";
import { attachWsController } from "./src/server/ws_controller.js";
import { createArtNetTransportScheduler22P } from "./src/output/artnet_transport_scheduler_22p.js";
import { createMultiTransportOutputManager22U } from "./src/output/multi_transport_output_manager_22u.js";
import { createOutputRouter22F } from "./src/output/output_router_22f.js";
import { createAuthGate } from "./src/server/auth_middleware.js";
import { createStateStore } from "./src/server/state_store.js";
import { createLiveStateStore } from "./src/server/live_state_store.js";
import { createLiveServices } from "./src/server/live_services_factory.js";
import { parseBlxPacket, runDevicePowerCommand, canUseDebugApi } from "./src/server/runtime_utils.js";
import { createHttpWsTransport, closeHttpServer, closeWebSocketServer } from "./src/server/transport_factory.js";
import { registerRuntimeHooks } from "./src/server/runtime_hooks.js";
import { startServerWithLogs } from "./src/server/startup_logger.js";
import { createBlxUdpSocket, closeUdpSocket } from "./src/server/udp_adapter.js";
import { registerStaticAssets } from "./src/server/static_assets.js";
import { registerMiscRoutes } from "./src/server/misc_routes.js";
import { loadLocalEnv } from "./src/server/env_loader.js";
import { registerMainRoutes } from "./src/server/main_routes_registry.js";
import { createBlxControlService } from "./src/server/blx_control_service.js";
import { createArtnetControlService } from "./src/server/artnet_control_service.js";
import {
  createArtNetSchedulerOptions22P,
  createArtnetControlOptions,
  createBlxControlOptions,
  createLiveSenderOptions22DQ,
  createMultiTransportOptions22U
} from "./src/server/output_runtime_options.js";
import { createStep22DqLiveSender } from "./src/output/artnet_sync_live_sender_22dq.js";
import { artnetMasterFrameStore22EJ } from "./src/output/artnet_master_frame_store_22ej.js";
import { serverOutputRegistry37BC } from "./src/server/server_output_registry_37bc.js";
import { createRuntimeModeController } from "./src/server/runtime_mode_controller.js";
import { createServerPaths, assetFolderAliases, publicPaths } from "./src/server/server_paths.js";
// STEP22MC: ArtNet live input disabled in single-writer build.
// It can receive our own outgoing UDP packets on :6454 and feed them back into MASTER.
// import { createArtNetLiveInput22GN } from "./src/output/artnet_live_input_22gn.js";
// import { registerArtNetLiveInputRoutes22GN } from "./src/server/artnet_live_input_routes_22gn.js";

const app = express();
app.use(express.json({ limit: "512kb" }));
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envLoadResult = loadLocalEnv({ rootDir: __dirname });
const {
  publicDir,
  stateFile,
  runtimePrefsFile,
  liveStateFile,
  liveAuditFile,
  authFile,
  animationLibraryFile
} = createServerPaths(__dirname);
const {
  persistedRuntimePrefs,
  runtimePrefsStore,
  runtimeProfile,
  getRuntimeProfileRevision,
  setRuntimeMode
} = createRuntimeModeController({ runtimePrefsFile });
console.log("[runtime]", runtimeProfile, Object.keys(persistedRuntimePrefs).length ? "[restored prefs]" : "");
if (envLoadResult.loaded.length) console.log(`[env] loaded ${envLoadResult.loaded.join(", ")}`);
const authController = createAuthController({ authFile });
const stateStore = createStateStore({ stateFile });
const liveStateStore = createLiveStateStore({ stateFile: liveStateFile });
const liveServices = createLiveServices({
  env: process.env,
  liveStateStore,
  liveStateFile,
  liveAuditFile,
  runtimeProfile
});
const {
  physicalOutputEnabled,
  liveFullEnableTokenGate,
  liveAuditLog,
  liveTransportBoundary,
  liveEmergencyInterlock,
  liveSerialWriter,
  liveUdpWriter,
  liveHardwareTestMode,
  liveGuardedHardwareTestOutput,
  liveSerialArtnetProbe,
  liveOutputDriverBridge,
  liveOutputSmokeTest,
  liveOutputTargetConfig,
  liveOutputSendHistory,
  liveOutputPhysicalArmGate,
  liveOutputTestRunFlow,
  liveOutputVerification,
  liveOutputMinimalFrame12X,
  liveOutputMultiFrameStream12Y,
  liveOutputStreamTelemetry12Z,
  liveOutputReliabilityGate13A,
  liveSerialPortDiagnostics13C,
  liveArtnetTargetDiagnostics13D,
  liveOutputCoreDiagnostics,
  liveSerialDirectTest13F,
  liveReadinessSummary,
  livePhysicalReleasePreflight,
  liveRuntimeSync
} = liveServices;
const blxControlService = createBlxControlService(createBlxControlOptions(process.env));

const artnetScheduler22P = createArtNetTransportScheduler22P(createArtNetSchedulerOptions22P(process.env));
const multiTransport22U = createMultiTransportOutputManager22U(createMultiTransportOptions22U(process.env, artnetScheduler22P));
const artnetControlService = createArtnetControlService(createArtnetControlOptions(process.env));
// STEP22MC HARD SINGLE WRITER:
// ArtNet input bridge is intentionally disabled. When enabled it opens UDP :6454
// and can ingest the app's own ArtNet output/broadcast, then publish it back to
// artnetMasterFrameStore22EJ. That creates a feedback loop/flicker when the
// Performance preview starts mirroring frames. Keep this null unless explicitly
// building an external ArtNet-input mode in a separate profile.
const liveInput22GN = null;

const liveSender22DQ = createStep22DqLiveSender(createLiveSenderOptions22DQ(process.env));

app.get("/api/output/server-route-registry", (req, res) => {
  res.json(serverOutputRegistry37BC.snapshot());
});

const DEBUG_API_ENABLED = String(process.env.LED_DEBUG_API || "").trim() === "1";
const LEGACY_OUTPUT_ENABLED = String(process.env.LED_LEGACY_OUTPUT_ENABLE || "").trim() === "1";
const isDebugApiAllowed = (req) => canUseDebugApi(req, DEBUG_API_ENABLED);

app.use(createAuthGate({
  authController,
  publicPaths,
  canUseDebugApi: isDebugApiAllowed
}));

registerStaticAssets(app, { publicDir, expressRef: express });
registerMiscRoutes(app);

const { server, wss } = createHttpWsTransport(app);

let state = stateStore.startupState(stateStore.load());
liveStateStore.startupState();
const serialController = createSerialController();
const outputRouter22F = createOutputRouter22F({
  profile: process.env.LED_OUTPUT_PROFILE || "ESP32_4x40_RAW_SERIAL",
  serialController
});
const blxUdp = createBlxUdpSocket();
const shutdownController = createShutdownController({
  closeClients: () => {
    wss?.clients?.forEach((client) => {
      try { client.close(1001, "server shutdown"); } catch {}
    });
  },
  closeResources: [
    { name: "wss", close: () => closeWebSocketServer(wss) },
    { name: "http", close: () => closeHttpServer(server) },
    { name: "udp", close: () => closeUdpSocket(blxUdp) },
    { name: "artnet-live-input", close: () => liveInput22GN?.stop?.() },
    { name: "serial", close: serialController.close }
  ]
});
const { shutdown } = shutdownController;

// STEP22MC: routes are registered as disabled stubs only, so old UI calls cannot start another source.
app.get('/api/artnet/live-input/status', (_req, res) => res.json({ ok: true, disabled: true, version: 'STEP22MC_ARTNET_INPUT_DISABLED_SINGLE_WRITER', reason: 'single-writer-output-only' }));
app.post('/api/artnet/live-input/start', (_req, res) => res.status(409).json({ ok: false, disabled: true, error: 'ARTNET_INPUT_DISABLED_SINGLE_WRITER' }));
app.post('/api/artnet/live-input/stop', (_req, res) => res.json({ ok: true, disabled: true }));

registerMainRoutes(app, {
  expressRef: express,
  runtimeProfile,
  getPersistedPrefs: runtimePrefsStore.read,
  getRuntimeProfileRevision,
  setRuntimeMode,
  serialController,
  legacyOutputEnabled: LEGACY_OUTPUT_ENABLED,
  outputRouter22F,
  artnetScheduler22P,
  liveSender22DQ,
  multiTransport22U,
  rootDir: __dirname,
  publicDir,
  animationLibraryFile,
  assetFolderAliases,
  authController,
  canUseDebugApi: isDebugApiAllowed,
  shutdownController,
  shutdown,
  runDevicePowerCommand,
  wss,
  liveServices,
  liveStateStore,
  blxControlService,
  artnetControlService
});

registerRuntimeHooks({ server, blxUdp, shutdown });

attachWsController({
  wss,
  isAuthenticated: (req) => authController.isAuthenticated(req),
  getState: () => state,
  setState: (nextState) => { state = nextState; },
  saveState: stateStore.save,
  parseBlxPacket,
  onBlxSerial: (msg) => {
    serialController.write(msg, "BLX serial write error");
  },
  onBlxNet: (packet, blx) => {
    blxUdp.send(packet, blx.port, blx.targetIp, (error) => {
      if (error) console.warn("BLX net send error", error.message);
    });
  },
  onSerial: (msg) => {
    serialController.write(msg, "Serial write error");
  },
  legacyOutputEnabled: LEGACY_OUTPUT_ENABLED,
  artnetMasterFrameStore: artnetMasterFrameStore22EJ,
  onMasterFrameWs: (detail) => liveSender22DQ.sendLatestMasterEvent?.(detail)
});

const PORT = Number(process.env.PORT || 3000);
startServerWithLogs(server, { port: PORT });
