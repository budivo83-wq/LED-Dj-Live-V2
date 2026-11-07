import { createLiveTransportBoundary } from "./live_transport_boundary.js";
import { createLiveEmergencyInterlock } from "./live_emergency_interlock.js";
import { createLiveSerialWriter } from "./live_serial_writer.js";
import { createLiveUdpWriter } from "./live_udp_writer.js";
import { createLiveHardwareTestMode } from "./live_hardware_test_mode.js";
import { createLiveFullEnableTokenGate } from "./live_full_enable_token.js";
import { createLiveReadinessSummary } from "./live_readiness_summary.js";
import { createLiveAuditLog } from "./live_audit_log.js";
import { createLivePhysicalReleasePreflight } from "./live_physical_release_preflight.js";
import { createLiveRuntimeSync } from "./live_runtime_sync.js";
import { createLiveGuardedHardwareTestOutput } from "./live_guarded_hardware_test_output.js";
import { createSerialArtnetProbe } from "./live_serial_artnet_probe.js";
import { createLiveOutputDriverBridge } from "./live_output_driver_bridge.js";
import { createLiveOutputSmokeTest } from "./live_output_smoke_test.js";
import { createLiveOutputTargetConfig } from "./live_output_target_config.js";
import { createLiveOutputSendHistory } from "./live_output_send_history.js";
import { createLiveOutputPhysicalArmGate } from "./live_output_physical_arm_gate.js";
import { createLiveOutputTestRunFlow } from "./live_output_test_run_flow.js";
import { createLiveOutputVerification } from "./live_output_verification.js";
import { createLiveOutputMinimalFrame12X } from "./live_output_minimal_frame_12x.js";
import { createLiveOutputMultiFrameStream12Y } from "./live_output_multiframe_stream_12y.js";
import { createLiveOutputStreamTelemetry12Z } from "./live_output_stream_telemetry_12z.js";
import { createLiveOutputReliabilityGate13A } from "./live_output_reliability_gate_13a.js";
import { createLiveSerialPortDiagnostics13C } from "./live_serial_port_diagnostics_13c.js";
import { createLiveArtnetTargetDiagnostics13D } from "./live_artnet_target_diagnostics_13d.js";
import { createLiveOutputCoreDiagnostics } from "./live_output_core_diagnostics.js";
import { createLiveSerialDirectTest13F } from "./live_serial_direct_test_13f.js";

export function createLiveServices({
  env = process.env,
  liveStateStore,
  liveStateFile,
  liveAuditFile,
  runtimeProfile
}) {
  const liveFullEnableTokenGate = createLiveFullEnableTokenGate({ liveStateStore });
  const liveAuditLog = createLiveAuditLog({ auditFile: liveAuditFile, maxEntries: runtimeProfile.auditLimit });
  const physicalOutputEnabled = String(env.LED_PHYSICAL_OUTPUT_ENABLE || "").trim() === "1";

  const liveTransportBoundary = createLiveTransportBoundary({
    liveStateStore,
    liveFullEnableTokenGate,
    allowPhysicalWrite: physicalOutputEnabled
  });
  const liveEmergencyInterlock = createLiveEmergencyInterlock({ liveStateStore, liveTransportBoundary });
  const liveSerialWriter = createLiveSerialWriter({
    enabled: String(env.LED_SERIAL_LIVE_WRITER_ENABLE || "").trim() === "1",
    liveTransportBoundary,
    liveEmergencyInterlock
  });
  const liveUdpWriter = createLiveUdpWriter({
    enabled: String(env.LED_ARTNET_LIVE_WRITER_ENABLE || "").trim() === "1",
    liveTransportBoundary,
    liveEmergencyInterlock
  });
  const liveHardwareTestMode = createLiveHardwareTestMode({ liveEmergencyInterlock, liveTransportBoundary });
  const liveGuardedHardwareTestOutput = createLiveGuardedHardwareTestOutput({
    liveHardwareTestMode,
    liveSerialWriter,
    liveUdpWriter,
    liveEmergencyInterlock
  });
  const liveSerialArtnetProbe = createSerialArtnetProbe({ liveSerialWriter, liveUdpWriter });
  const liveOutputDriverBridge = createLiveOutputDriverBridge({
    liveSerialWriter,
    liveUdpWriter,
    physicalWriteEnabled: physicalOutputEnabled
  });
  const liveOutputSmokeTest = createLiveOutputSmokeTest({
    liveOutputDriverBridge,
    physicalWriteEnabled: physicalOutputEnabled
  });
  const liveOutputTargetConfig = createLiveOutputTargetConfig({ env });
  const liveOutputSendHistory = createLiveOutputSendHistory({ limit: 24 });
  const liveOutputPhysicalArmGate = createLiveOutputPhysicalArmGate({
    physicalWriteEnabled: physicalOutputEnabled,
    ttlMs: Number(env.LED_PHYSICAL_OUTPUT_ARM_TTL_MS || 90000)
  });
  const liveOutputTestRunFlow = createLiveOutputTestRunFlow({
    liveOutputTargetConfig,
    liveOutputSmokeTest,
    liveOutputPhysicalArmGate,
    liveOutputSendHistory,
    liveAuditLog
  });
  const liveOutputVerification = createLiveOutputVerification({ liveOutputSendHistory });
  const liveOutputMinimalFrame12X = createLiveOutputMinimalFrame12X({
    liveOutputTargetConfig,
    liveOutputSmokeTest,
    liveOutputPhysicalArmGate,
    liveOutputSendHistory,
    liveAuditLog
  });
  const liveOutputMultiFrameStream12Y = createLiveOutputMultiFrameStream12Y({
    liveOutputMinimalFrame12X,
    liveOutputSendHistory,
    liveAuditLog
  });
  const liveOutputStreamTelemetry12Z = createLiveOutputStreamTelemetry12Z({
    liveOutputMultiFrameStream12Y,
    liveOutputSendHistory,
    liveAuditLog
  });
  const liveOutputReliabilityGate13A = createLiveOutputReliabilityGate13A({
    liveOutputStreamTelemetry12Z,
    liveOutputSendHistory,
    liveAuditLog
  });
  const liveSerialPortDiagnostics13C = createLiveSerialPortDiagnostics13C({ env });
  const liveArtnetTargetDiagnostics13D = createLiveArtnetTargetDiagnostics13D({ env });
  const liveOutputCoreDiagnostics = createLiveOutputCoreDiagnostics({ env });
  const liveSerialDirectTest13F = createLiveSerialDirectTest13F({ env });
  const liveReadinessSummary = createLiveReadinessSummary({
    liveStateStore,
    liveTransportBoundary,
    liveEmergencyInterlock,
    liveSerialWriter,
    liveUdpWriter,
    liveHardwareTestMode,
    liveFullEnableTokenGate
  });
  const livePhysicalReleasePreflight = createLivePhysicalReleasePreflight({
    enabled: String(env.LED_PHYSICAL_RELEASE_ENABLE || "").trim() === "1",
    liveStateStore,
    liveFullEnableTokenGate,
    liveEmergencyInterlock,
    liveReadinessSummary
  });
  const liveRuntimeSync = createLiveRuntimeSync({
    liveStateStore,
    liveReadinessSummary,
    liveFullEnableTokenGate,
    liveAuditLog
  });

  return {
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
  };
}
