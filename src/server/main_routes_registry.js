import { registerOpsRoutes } from "./ops_routes.js";
import { registerSerialRoutes } from "./serial_routes.js";
import { registerRawSerialRoutes } from "./raw_serial_routes.js";
import { registerOutputProfileRoutes22D } from "./output_profile_routes_22d.js";
import { registerOutputDiagnosticsRoutes22E } from "./output_diagnostics_routes_22e.js";
import { registerOutputRouterRoutes22F } from "./output_router_routes_22f.js";
import { registerArtNetSchedulerRoutes22P } from "./artnet_scheduler_routes_22p.js";
import { registerMultiTransportRoutes22U } from "./multi_transport_routes_22u.js";
import { registerMetaRoutes } from "./meta_routes.js";
import { registerAuthRoutes } from "./auth_routes.js";
import { registerAnimationLibraryRoutes } from "./animation_library_routes.js";
import { registerHardwareStatsRoutes } from "./hardware_stats_routes.js";
import { registerRuntimeProfileRoutes } from "./runtime_profile_routes.js";
import { registerLiveRoutes } from "./live_routes.js";
import { registerArtNetLiveTxRoutes22DO } from "./artnet_live_tx_routes_22do.js";
import { registerArtNetSyncLiveRoutes22DQ } from "./artnet_sync_live_routes_22dq.js";
import { registerArtNetOperatorRoutes22DR } from "./artnet_operator_routes_22dr.js";
import { registerArtNetNetworkRoutes22DV } from "./artnet_network_routes_22dv.js";
import { registerArtNetLiveConfigRoutes22DX } from "./artnet_live_config_routes_22dx.js";
import { registerArtNetMasterFrameRoutes22EJ } from "./artnet_master_frame_routes_22ej.js";
import { registerArtNetDebugRoutes22DZ } from "./artnet_debug_routes_22dz.js";

export function registerMainRoutes(app, deps) {
  const {
    expressRef,
    runtimeProfile,
    getPersistedPrefs,
    getRuntimeProfileRevision,
    setRuntimeMode,
    serialController,
    legacyOutputEnabled,
    outputRouter22F,
    artnetScheduler22P,
    liveSender22DQ,
    multiTransport22U,
    rootDir,
    publicDir,
    animationLibraryFile,
    assetFolderAliases,
    authController,
    canUseDebugApi,
    shutdownController,
    shutdown,
    runDevicePowerCommand,
    wss,
    liveServices,
    liveStateStore,
    blxControlService,
    artnetControlService
  } = deps;

  registerRuntimeProfileRoutes(app, {
    runtimeProfile,
    getPersistedPrefs,
    getRevision: getRuntimeProfileRevision,
    setRuntimeMode
  });
  registerHardwareStatsRoutes(app, { runtimeProfile });

  registerSerialRoutes(app, { serialController, expressRef, legacySerialFrameEnabled: legacyOutputEnabled });
  registerRawSerialRoutes(app, { serialController, expressRef });
  registerOutputProfileRoutes22D(app, { expressRef });
  registerOutputDiagnosticsRoutes22E(app, {
    expressRef,
    outputRouter22F,
    outputManager22C: outputRouter22F.getManager(),
    frameInspector22E: outputRouter22F.getInspector()
  });
  registerOutputRouterRoutes22F(app, { expressRef, outputRouter22F });
  registerArtNetSchedulerRoutes22P(app, { expressRef, artnetScheduler22P });
  registerArtNetLiveTxRoutes22DO(app, { expressRef });
  // Primary live ArtNet control surface for Settings and shell-owned output.
  registerArtNetSyncLiveRoutes22DQ(app, { expressRef, liveSender22DQ });
  registerArtNetMasterFrameRoutes22EJ(app, { expressRef, liveSender22DQ });
  registerArtNetOperatorRoutes22DR(app);
  registerArtNetNetworkRoutes22DV(app);
  registerArtNetDebugRoutes22DZ(app, { artnetControlService });
  registerArtNetLiveConfigRoutes22DX(app, { expressRef, rootDir, liveSender22DQ });
  registerMultiTransportRoutes22U(app, { expressRef, multiTransport22U, artnetScheduler22P });

  // Legacy/manual diagnostics surface. Keep registered for live_arm_panel and
  // operator/debug flows, but do not treat it as the primary ArtNet control path.
  registerLiveRoutes(app, {
    liveStateStore,
    ...liveServices,
    blxControlService
  });
  registerMetaRoutes(app, { publicDir, assetFolderAliases });
  registerAnimationLibraryRoutes(app, { publicDir, libraryFile: animationLibraryFile });
  registerAuthRoutes(app, { authController });
  registerOpsRoutes(app, {
    canUseDebugApi,
    shutdown,
    runDevicePowerCommand,
    getHealth: () => ({
      ok: true,
      shuttingDown: shutdownController.isShuttingDown(),
      pid: process.pid,
      uptimeSec: Math.round(process.uptime()),
      memory: process.memoryUsage(),
      wsClients: wss?.clients?.size ?? 0,
      serial: serialController.status()
    })
  });
}
