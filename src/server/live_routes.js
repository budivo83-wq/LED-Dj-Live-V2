export function registerLiveRoutes(app, {
  liveStateStore,
  liveTransportBoundary = null,
  liveEmergencyInterlock = null,
  liveSerialWriter = null,
  liveUdpWriter = null,
  liveHardwareTestMode = null,
  liveFullEnableTokenGate = null,
  liveReadinessSummary = null,
  liveAuditLog = null,
  livePhysicalReleasePreflight = null,
  liveRuntimeSync = null,
  liveGuardedHardwareTestOutput = null,
  liveSerialArtnetProbe = null,
  liveOutputDriverBridge = null,
  liveOutputSmokeTest = null,
  liveOutputTargetConfig = null,
  liveOutputSendHistory = null,
  liveOutputPhysicalArmGate = null,
  liveOutputTestRunFlow = null,
  liveOutputVerification = null,
  liveOutputMinimalFrame12X = null,
  liveOutputMultiFrameStream12Y = null,
  liveOutputStreamTelemetry12Z = null,
  liveOutputReliabilityGate13A = null,
  liveSerialPortDiagnostics13C = null,
  liveArtnetTargetDiagnostics13D = null,
  liveSerialDirectTest13F = null,
  liveOutputCoreDiagnostics = null,
  blxControlService = null
} = {}) {
  if (!liveStateStore) throw new Error("registerLiveRoutes requires liveStateStore");

  app.get("/api/live/state", (req, res) => {
    const live = liveStateStore.read();
    liveAuditLog?.append?.("live.state.read", { live });
    res.json({ ok: true, live });
  });

  app.get("/api/live/sync", (req, res) => {
    if (!liveRuntimeSync) return res.status(503).json({ ok: false, error: "live runtime sync unavailable" });
    const sync = liveRuntimeSync.read();
    liveAuditLog?.append?.("live.sync.read", { sync });
    res.json({ ok: sync.ok, sync });
  });

  app.get("/api/live/readiness", (req, res) => {
    if (!liveReadinessSummary) return res.status(503).json({ ok: false, error: "live readiness summary unavailable" });
    const readiness = liveReadinessSummary.read();
    liveAuditLog?.append?.("live.readiness.read", { readiness });
    res.json({ ok: true, readiness });
  });

  app.post("/api/live/intent", (req, res) => {
    const live = liveStateStore.requestArmIntent(req.body || {});
    liveAuditLog?.append?.("live.intent", { live, request: req.body || {} });
    res.json({ ok: true, live });
  });

  app.post("/api/live/disarm", (req, res) => {
    liveFullEnableTokenGate?.revoke?.("operator_disarm");
    const live = liveStateStore.disarm(req.body?.reason || "operator_disarm");
    liveAuditLog?.append?.("live.disarm", { live, reason: req.body?.reason || "operator_disarm" });
    res.json({ ok: true, live });
  });

  app.post("/api/live/stop", (req, res) => {
    liveFullEnableTokenGate?.revoke?.("operator_emergency_stop");
    if (liveEmergencyInterlock) {
      const result = liveEmergencyInterlock.stop(req.body?.reason || "operator_emergency_stop");
      liveAuditLog?.append?.("live.stop", result);
      return res.json({ ok: true, ...result });
    }
    const live = liveStateStore.emergencyStop(req.body?.reason || "operator_emergency_stop");
    liveAuditLog?.append?.("live.stop", { live });
    return res.json({ ok: true, live });
  });

  app.post("/api/live/stop/clear", (req, res) => {
    if (liveEmergencyInterlock) {
      const result = liveEmergencyInterlock.clear(req.body?.reason || "operator_clear_emergency_stop");
      liveAuditLog?.append?.("live.stop.clear", result);
      return res.json({ ok: true, ...result });
    }
    const live = liveStateStore.clearEmergencyStop(req.body?.reason || "operator_clear_emergency_stop");
    liveAuditLog?.append?.("live.stop.clear", { live });
    return res.json({ ok: true, live });
  });

  app.post("/api/live/blackout/interlock", (req, res) => {
    if (!liveEmergencyInterlock) return res.status(503).json({ ok: false, error: "live emergency interlock unavailable" });
    const interlock = liveEmergencyInterlock.evaluate(req.body || {});
    liveAuditLog?.append?.("live.blackout.interlock", { interlock, request: req.body || {} });
    return res.json({ ok: true, interlock });
  });

  app.post("/api/live/transport/guard", (req, res) => {
    if (!liveTransportBoundary) return res.status(503).json({ ok: false, error: "live transport boundary unavailable" });
    const boundary = liveTransportBoundary.evaluate(req.body || {});
    liveAuditLog?.append?.("live.transport.guard", { boundary, request: req.body || {} });
    res.json({ ok: true, boundary });
  });

  app.post("/api/live/serial/write", (req, res) => {
    if (!liveSerialWriter) return res.status(503).json({ ok: false, error: "live serial writer unavailable" });
    const serialWriter = liveSerialWriter.evaluate(req.body || {});
    liveAuditLog?.append?.("live.serial.write.candidate", { serialWriter, request: req.body || {} });
    res.json({ ok: true, serialWriter });
  });

  app.post("/api/live/udp/write", (req, res) => {
    if (!liveUdpWriter) return res.status(503).json({ ok: false, error: "live udp writer unavailable" });
    const udpWriter = liveUdpWriter.evaluate(req.body || {});
    liveAuditLog?.append?.("live.udp.write.candidate", { udpWriter, request: req.body || {} });
    res.json({ ok: true, udpWriter });
  });

  app.post("/api/live/hardware-test", (req, res) => {
    if (!liveHardwareTestMode) return res.status(503).json({ ok: false, error: "live hardware test mode unavailable" });
    const hardwareTest = liveHardwareTestMode.evaluate(req.body || {});
    liveAuditLog?.append?.("live.hardware-test", { hardwareTest, request: req.body || {} });
    res.json({ ok: true, hardwareTest });
  });

  app.post("/api/live/hardware-test/output", (req, res) => {
    if (!liveGuardedHardwareTestOutput) return res.status(503).json({ ok: false, error: "live guarded hardware test output unavailable" });
    const hardwareTestOutput = liveGuardedHardwareTestOutput.evaluate(req.body || {});
    liveAuditLog?.append?.("live.hardware-test.output", { hardwareTestOutput, request: req.body || {} });
    res.json({ ok: hardwareTestOutput.ok, hardwareTestOutput });
  });

  app.post("/api/live/output/probe", (req, res) => {
    if (!liveSerialArtnetProbe) return res.status(503).json({ ok: false, error: "live serial/artnet probe unavailable" });
    const outputProbe = liveSerialArtnetProbe.evaluate(req.body || {});
    liveAuditLog?.append?.("live.output.probe", { outputProbe, request: req.body || {} });
    res.json({ ok: outputProbe.ok, outputProbe });
  });


  app.post("/api/live/output/target-config", (req, res) => {
    if (!liveOutputTargetConfig) return res.status(503).json({ ok: false, error: "live output target config unavailable" });
    const outputTargetConfig = liveOutputTargetConfig.evaluate(req.body || {});
    liveAuditLog?.append?.("live.output.target-config", { outputTargetConfig, request: req.body || {} });
    res.json({ ok: outputTargetConfig.ok, outputTargetConfig });
  });


  app.get("/api/live/output/serial-diagnostics", async (req, res) => {
    if (!liveSerialPortDiagnostics13C) return res.status(503).json({ ok: false, error: "live serial port diagnostics 13C unavailable" });
    try {
      const serialDiagnostics = await liveSerialPortDiagnostics13C.evaluate(req.query || {});
      liveAuditLog?.append?.("live.output.serial-diagnostics.read.13C", { serialDiagnostics });
      res.json({ ok: serialDiagnostics.ok, serialDiagnostics });
    } catch (error) {
      const serialDiagnostics = {
        version: "13C-serial-port-real-adapter-hardening",
        ok: false,
        status: "ERROR",
        decision: "SERIAL_PORT_DIAGNOSTICS_ERROR_13C",
        error: error?.message || String(error)
      };
      liveAuditLog?.append?.("live.output.serial-diagnostics.error.13C", { serialDiagnostics });
      res.status(500).json({ ok: false, serialDiagnostics });
    }
  });




  app.post("/api/live/output/serial-direct-test", async (req, res) => {
    if (!liveSerialDirectTest13F) return res.status(503).json({ ok: false, error: "live serial direct test 13F unavailable" });
    try {
      const serialDirectTest = await liveSerialDirectTest13F.run(req.body || {});
      liveOutputSendHistory?.append?.("serial-direct-test-13F", serialDirectTest);
      liveAuditLog?.append?.("live.output.serial-direct-test.13F", { serialDirectTest, request: req.body || {} });
      res.json({ ok: serialDirectTest.ok, serialDirectTest });
    } catch (error) {
      const serialDirectTest = {
        version: "13F-serial-direct-aa-diagnostic",
        ok: false,
        status: "ERROR",
        decision: "SERIAL_DIRECT_TEST_ROUTE_ERROR_13F",
        error: error?.message || String(error),
        outputTouched: true,
        serialTouched: true
      };
      liveOutputSendHistory?.append?.("serial-direct-test-error-13F", serialDirectTest);
      liveAuditLog?.append?.("live.output.serial-direct-test.error.13F", { serialDirectTest, request: req.body || {} });
      res.status(500).json({ ok: false, serialDirectTest });
    }
  });

  app.get("/api/live/output/artnet-diagnostics", (req, res) => {
    if (!liveArtnetTargetDiagnostics13D) return res.status(503).json({ ok: false, error: "live artnet target diagnostics 13D unavailable" });
    try {
      const artnetDiagnostics = liveArtnetTargetDiagnostics13D.evaluate(req.query || {});
      liveAuditLog?.append?.("live.output.artnet-diagnostics.read.13D", { artnetDiagnostics });
      res.json({ ok: artnetDiagnostics.ok, artnetDiagnostics });
    } catch (error) {
      const artnetDiagnostics = {
        version: "13D-artnet-target-diagnostics-hardening",
        ok: false,
        status: "ERROR",
        decision: "ARTNET_TARGET_DIAGNOSTICS_ERROR_13D",
        error: error?.message || String(error)
      };
      liveAuditLog?.append?.("live.output.artnet-diagnostics.error.13D", { artnetDiagnostics });
      res.status(500).json({ ok: false, artnetDiagnostics });
    }
  });

  app.get("/api/live/output/core-diagnostics", (req, res) => {
    if (!liveOutputCoreDiagnostics) return res.status(503).json({ ok: false, error: "live output core diagnostics unavailable" });
    const outputCoreDiagnostics = liveOutputCoreDiagnostics.evaluate(req.query || {});
    liveAuditLog?.append?.("live.output.core-diagnostics.read", { outputCoreDiagnostics });
    res.json({ ok: outputCoreDiagnostics.ok, outputCoreDiagnostics });
  });

  app.get("/api/live/output/send-history", (req, res) => {
    if (!liveOutputSendHistory) return res.status(503).json({ ok: false, error: "live output send history unavailable" });
    const outputSendHistory = liveOutputSendHistory.snapshot();
    liveAuditLog?.append?.("live.output.send-history.read", { count: outputSendHistory.count });
    res.json({ ok: true, outputSendHistory });
  });

  app.post("/api/live/output/send-history/clear", (req, res) => {
    if (!liveOutputSendHistory) return res.status(503).json({ ok: false, error: "live output send history unavailable" });
    const outputSendHistory = liveOutputSendHistory.clear();
    liveAuditLog?.append?.("live.output.send-history.clear", { request: req.body || {} });
    res.json({ ok: true, outputSendHistory });
  });


  app.get("/api/live/output/physical-arm", (req, res) => {
    if (!liveOutputPhysicalArmGate) return res.status(503).json({ ok: false, error: "live output physical arm gate unavailable" });
    const outputPhysicalArm = liveOutputPhysicalArmGate.snapshot();
    liveAuditLog?.append?.("live.output.physical-arm.read", { outputPhysicalArm });
    res.json({ ok: true, outputPhysicalArm });
  });

  app.post("/api/live/output/physical-arm", (req, res) => {
    if (!liveOutputPhysicalArmGate) return res.status(503).json({ ok: false, error: "live output physical arm gate unavailable" });
    const outputPhysicalArm = liveOutputPhysicalArmGate.arm(req.body || {});
    liveAuditLog?.append?.("live.output.physical-arm.arm", { outputPhysicalArm, request: req.body || {} });
    res.json({ ok: outputPhysicalArm.ok, outputPhysicalArm });
  });

  app.post("/api/live/output/physical-arm/disarm", (req, res) => {
    if (!liveOutputPhysicalArmGate) return res.status(503).json({ ok: false, error: "live output physical arm gate unavailable" });
    const outputPhysicalArm = liveOutputPhysicalArmGate.disarm(req.body || {});
    liveAuditLog?.append?.("live.output.physical-arm.disarm", { outputPhysicalArm, request: req.body || {} });
    res.json({ ok: true, outputPhysicalArm });
  });

  app.post("/api/live/output/smoke-test", async (req, res) => {
    if (!liveOutputSmokeTest) return res.status(503).json({ ok: false, error: "live output smoke test unavailable" });
    try {
      const physicalArm = liveOutputPhysicalArmGate?.evaluateSend?.(req.body || {}) || null;
      if (req.body?.dryRun === false && physicalArm && physicalArm.sendAllowed !== true) {
        const outputSmokeTest = {
          ok: false,
          decision: "OUTPUT_SMOKE_TEST_BLOCKED_BY_12U_PHYSICAL_ARM",
          status: "BLOCKED",
          request: req.body || {},
          physicalArm,
          blocked: physicalArm.blocked || ["PHYSICAL_OUTPUT_NOT_ARMED_12U"],
          outputTouched: false,
          dryRunOnly: true
        };
        liveOutputSendHistory?.append?.("smoke-test-arm-blocked", outputSmokeTest);
        liveAuditLog?.append?.("live.output.smoke-test.arm-blocked", { outputSmokeTest, request: req.body || {} });
        return res.json({ ok: false, outputSmokeTest });
      }
      const evaluatedOutputSmokeTest = req.body?.dryRun === false
        ? await liveOutputSmokeTest.execute(req.body || {})
        : liveOutputSmokeTest.evaluate(req.body || {});
      const outputSmokeTest = physicalArm ? { ...evaluatedOutputSmokeTest, physicalArm } : evaluatedOutputSmokeTest;
      liveOutputSendHistory?.append?.("smoke-test", outputSmokeTest);
      liveAuditLog?.append?.("live.output.smoke-test", { outputSmokeTest, request: req.body || {} });
      res.json({ ok: outputSmokeTest.ok, outputSmokeTest });
    } catch (error) {
      const outputSmokeTest = {
        ok: false,
        decision: "OUTPUT_SMOKE_TEST_SEND_ERROR",
        status: "ERROR",
        error: error?.message || String(error),
        outputTouched: true
      };
      liveOutputSendHistory?.append?.("smoke-test-error", outputSmokeTest);
      liveAuditLog?.append?.("live.output.smoke-test.error", { outputSmokeTest, request: req.body || {} });
      res.status(500).json({ ok: false, outputSmokeTest });
    }
  });

  app.post("/api/live/output/driver-bridge", async (req, res) => {
    if (!liveOutputDriverBridge) return res.status(503).json({ ok: false, error: "live output driver bridge unavailable" });
    try {
      const physicalArm = liveOutputPhysicalArmGate?.evaluateSend?.(req.body || {}) || null;
      if (req.body?.dryRun === false && physicalArm && physicalArm.sendAllowed !== true) {
        const outputDriverBridge = {
          ok: false,
          decision: "OUTPUT_DRIVER_BRIDGE_BLOCKED_BY_12U_PHYSICAL_ARM",
          status: "BLOCKED",
          request: req.body || {},
          physicalArm,
          blocked: physicalArm.blocked || ["PHYSICAL_OUTPUT_NOT_ARMED_12U"],
          outputTouched: false,
          dryRunOnly: true
        };
        liveOutputSendHistory?.append?.("driver-bridge-arm-blocked", outputDriverBridge);
        liveAuditLog?.append?.("live.output.driver-bridge.arm-blocked", { outputDriverBridge, request: req.body || {} });
        return res.json({ ok: false, outputDriverBridge });
      }
      const evaluatedOutputDriverBridge = req.body?.dryRun === false
        ? await liveOutputDriverBridge.execute(req.body || {})
        : liveOutputDriverBridge.evaluate(req.body || {});
      const outputDriverBridge = physicalArm ? { ...evaluatedOutputDriverBridge, physicalArm } : evaluatedOutputDriverBridge;
      liveOutputSendHistory?.append?.("driver-bridge", outputDriverBridge);
      liveAuditLog?.append?.("live.output.driver-bridge", { outputDriverBridge, request: req.body || {} });
      res.json({ ok: outputDriverBridge.ok, outputDriverBridge });
    } catch (error) {
      const outputDriverBridge = {
        ok: false,
        decision: "OUTPUT_DRIVER_BRIDGE_SEND_ERROR",
        status: "ERROR",
        error: error?.message || String(error),
        outputTouched: true
      };
      liveOutputSendHistory?.append?.("driver-bridge-error", outputDriverBridge);
      liveAuditLog?.append?.("live.output.driver-bridge.error", { outputDriverBridge, request: req.body || {} });
      res.status(500).json({ ok: false, outputDriverBridge });
    }
  });




  app.get("/api/live/output/verification", (req, res) => {
    if (!liveOutputVerification) return res.status(503).json({ ok: false, error: "live output verification unavailable" });
    const outputVerification = liveOutputVerification.evaluate();
    liveAuditLog?.append?.("live.output.verification.12W", { outputVerification });
    res.json({ ok: outputVerification.ok, outputVerification });
  });

  app.post("/api/live/output/test-run", async (req, res) => {
    if (!liveOutputTestRunFlow) return res.status(503).json({ ok: false, error: "live output test-run flow unavailable" });
    try {
      const outputTestRun = await liveOutputTestRunFlow.run(req.body || {});
      res.json({ ok: outputTestRun.ok, outputTestRun });
    } catch (error) {
      const outputTestRun = {
        ok: false,
        version: "12V-output-test-run-flow",
        decision: "OUTPUT_TEST_RUN_ERROR_12V",
        status: "ERROR",
        error: error?.message || String(error),
        outputTouched: true
      };
      liveOutputSendHistory?.append?.("test-run-flow-error-12V", outputTestRun);
      liveAuditLog?.append?.("live.output.test-run-flow.error.12V", { outputTestRun, request: req.body || {} });
      res.status(500).json({ ok: false, outputTestRun });
    }
  });



  app.post("/api/live/output/minimal-frame", async (req, res) => {
    if (!liveOutputMinimalFrame12X) return res.status(503).json({ ok: false, error: "live output minimal frame 12X unavailable" });
    try {
      const outputMinimalFrame = await liveOutputMinimalFrame12X.run(req.body || {});
      res.json({ ok: outputMinimalFrame.ok, outputMinimalFrame });
    } catch (error) {
      const outputMinimalFrame = {
        ok: false,
        version: "12X-minimal-live-frame-output-path",
        decision: "MINIMAL_FRAME_OUTPUT_ERROR_12X",
        status: "ERROR",
        error: error?.message || String(error),
        outputTouched: true
      };
      liveOutputSendHistory?.append?.("minimal-frame-error-12X", outputMinimalFrame);
      liveAuditLog?.append?.("live.output.minimal-frame.error.12X", { outputMinimalFrame, request: req.body || {} });
      res.status(500).json({ ok: false, outputMinimalFrame });
    }
  });


  app.post("/api/live/output/multiframe-stream", async (req, res) => {
    if (!liveOutputMultiFrameStream12Y) return res.status(503).json({ ok: false, error: "live output multiframe stream 12Y unavailable" });
    try {
      const outputMultiFrameStream = await liveOutputMultiFrameStream12Y.run(req.body || {});
      res.json({ ok: outputMultiFrameStream.ok, outputMultiFrameStream });
    } catch (error) {
      const outputMultiFrameStream = {
        ok: false,
        version: "12Y-multiframe-live-output-dry-run-stream",
        decision: "MULTIFRAME_STREAM_ERROR_12Y",
        status: "ERROR",
        error: error?.message || String(error),
        outputTouched: true
      };
      liveOutputSendHistory?.append?.("multiframe-stream-error-12Y", outputMultiFrameStream);
      liveAuditLog?.append?.("live.output.multiframe-stream.error.12Y", { outputMultiFrameStream, request: req.body || {} });
      res.status(500).json({ ok: false, outputMultiFrameStream });
    }
  });



  app.get("/api/live/output/stream-telemetry", (req, res) => {
    if (!liveOutputStreamTelemetry12Z) return res.status(503).json({ ok: false, error: "live output stream telemetry 12Z unavailable" });
    const outputStreamTelemetry = liveOutputStreamTelemetry12Z.snapshot();
    liveAuditLog?.append?.("live.output.stream-telemetry.read.12Z", { outputStreamTelemetry });
    res.json({ ok: true, outputStreamTelemetry });
  });

  app.post("/api/live/output/stream-telemetry/stop", (req, res) => {
    if (!liveOutputStreamTelemetry12Z) return res.status(503).json({ ok: false, error: "live output stream telemetry 12Z unavailable" });
    const outputStreamStop = liveOutputStreamTelemetry12Z.requestStop(req.body?.reason || "operator_stop_stream_12Z");
    res.json({ ok: outputStreamStop.ok, outputStreamStop });
  });

  app.post("/api/live/output/stream-telemetry/run", async (req, res) => {
    if (!liveOutputStreamTelemetry12Z) return res.status(503).json({ ok: false, error: "live output stream telemetry 12Z unavailable" });
    try {
      const outputStreamTelemetry = await liveOutputStreamTelemetry12Z.run(req.body || {});
      res.json({ ok: outputStreamTelemetry.ok, outputStreamTelemetry });
    } catch (error) {
      const outputStreamTelemetry = {
        ok: false,
        version: "12Z-stream-telemetry-stop-control",
        decision: "STREAM_TELEMETRY_ERROR_12Z",
        status: "ERROR",
        error: error?.message || String(error),
        outputTouched: true
      };
      liveOutputSendHistory?.append?.("stream-telemetry-error-12Z", outputStreamTelemetry);
      liveAuditLog?.append?.("live.output.stream-telemetry.error.12Z", { outputStreamTelemetry, request: req.body || {} });
      res.status(500).json({ ok: false, outputStreamTelemetry });
    }
  });



  app.get("/api/live/output/reliability-gate", (req, res) => {
    if (!liveOutputReliabilityGate13A) return res.status(503).json({ ok: false, error: "live output reliability gate 13A unavailable" });
    const outputReliabilityGate = liveOutputReliabilityGate13A.snapshot();
    liveAuditLog?.append?.("live.output.reliability-gate.read.13A", { outputReliabilityGate });
    res.json({ ok: true, outputReliabilityGate });
  });

  app.post("/api/live/output/reliability-gate/evaluate", (req, res) => {
    if (!liveOutputReliabilityGate13A) return res.status(503).json({ ok: false, error: "live output reliability gate 13A unavailable" });
    const outputReliabilityGate = liveOutputReliabilityGate13A.evaluate(req.body || {});
    liveAuditLog?.append?.("live.output.reliability-gate.evaluate.13A", { outputReliabilityGate, request: req.body || {} });
    res.json({ ok: outputReliabilityGate.ok, outputReliabilityGate });
  });

  app.get("/api/live/blx/status", (req, res) => {
    if (!blxControlService) return res.status(503).json({ ok: false, error: "blx control service unavailable" });
    return res.json(blxControlService.snapshot());
  });

  app.post("/api/live/blx/start", (req, res) => {
    if (!blxControlService) return res.status(503).json({ ok: false, error: "blx control service unavailable" });
    return res.json(blxControlService.start());
  });

  app.post("/api/live/blx/stop", (req, res) => {
    if (!blxControlService) return res.status(503).json({ ok: false, error: "blx control service unavailable" });
    return res.json(blxControlService.stop());
  });

  app.post("/api/live/blx/tick", (req, res) => {
    if (!blxControlService) return res.status(503).json({ ok: false, error: "blx control service unavailable" });
    const loops = blxControlService.step(req.body?.count || 1);
    return res.json({ ok: true, loops, snapshot: blxControlService.snapshot() });
  });

  app.post("/api/live/blx/discovery", (req, res) => {
    if (!blxControlService) return res.status(503).json({ ok: false, error: "blx control service unavailable" });
    const sent = blxControlService.broadcastDiscovery(req.body?.nodeName || "BLX_NODE");
    const nodes = blxControlService.getDiscoveredNodes(req.body?.maxAgeMs || 30000);
    return res.json({ ok: sent, sent, nodes, snapshot: blxControlService.snapshot() });
  });

  app.get("/api/live/blx/nodes", (req, res) => {
    if (!blxControlService) return res.status(503).json({ ok: false, error: "blx control service unavailable" });
    const nodes = blxControlService.getDiscoveredNodes(req.query?.maxAgeMs || 30000);
    return res.json({ ok: true, nodes });
  });

  app.post("/api/live/blx/capability/request", (req, res) => {
    if (!blxControlService) return res.status(503).json({ ok: false, error: "blx control service unavailable" });
    blxControlService.requestCapabilities();
    return res.json({ ok: true, snapshot: blxControlService.snapshot() });
  });

  app.post("/api/live/blx/config/read", (req, res) => {
    if (!blxControlService) return res.status(503).json({ ok: false, error: "blx control service unavailable" });
    blxControlService.requestConfig();
    return res.json({ ok: true, snapshot: blxControlService.snapshot() });
  });

  app.post("/api/live/blx/config/write", (req, res) => {
    if (!blxControlService) return res.status(503).json({ ok: false, error: "blx control service unavailable" });
    blxControlService.writeConfig(req.body || {});
    return res.json({ ok: true, snapshot: blxControlService.snapshot() });
  });

  app.post("/api/live/blx/clock/master", (req, res) => {
    if (!blxControlService) return res.status(503).json({ ok: false, error: "blx control service unavailable" });
    const masterTimeUs = BigInt(Number(req.body?.masterTimeUs || Date.now() * 1000));
    blxControlService.sendClockMaster(masterTimeUs);
    return res.json({ ok: true, snapshot: blxControlService.snapshot() });
  });

  app.post("/api/live/blx/shader", (req, res) => {
    if (!blxControlService) return res.status(503).json({ ok: false, error: "blx control service unavailable" });
    blxControlService.sendShaderParam(req.body || {});
    return res.json({ ok: true, snapshot: blxControlService.snapshot() });
  });

  app.post("/api/live/blx/compressed", (req, res) => {
    if (!blxControlService) return res.status(503).json({ ok: false, error: "blx control service unavailable" });
    const payload = req.body && typeof req.body === "object" ? { ...req.body } : {};
    if (Array.isArray(payload.data)) payload.data = Uint8Array.from(payload.data);
    blxControlService.sendCompressedFrame(payload);
    return res.json({ ok: true, snapshot: blxControlService.snapshot() });
  });

  app.post("/api/live/blx/clock/reply", (req, res) => {
    if (!blxControlService) return res.status(503).json({ ok: false, error: "blx control service unavailable" });
    blxControlService.sendClockReply(req.body || {});
    return res.json({ ok: true, snapshot: blxControlService.snapshot() });
  });

  app.post("/api/live/blx/failover", (req, res) => {
    if (!blxControlService) return res.status(503).json({ ok: false, error: "blx control service unavailable" });
    blxControlService.sendFailoverTarget(req.body || {});
    return res.json({ ok: true, snapshot: blxControlService.snapshot() });
  });

  app.post("/api/live/blx/frame", (req, res) => {
    if (!blxControlService) return res.status(503).json({ ok: false, error: "blx control service unavailable" });
    const rgb = Array.isArray(req.body?.rgb) ? req.body.rgb : null;
    if (!rgb || rgb.length < 3) {
      return res.status(400).json({ ok: false, error: "rgb array required (at least 3 values)" });
    }
    const accepted = blxControlService.pushRgbFrame({
      frameId: req.body?.frameId || 0,
      rgb,
      brightness: req.body?.brightness
    });
    return res.json({ ok: Boolean(accepted), accepted: Boolean(accepted), snapshot: blxControlService.snapshot() });
  });

  app.post("/api/live/blx/frame/solid", (req, res) => {
    if (!blxControlService) return res.status(503).json({ ok: false, error: "blx control service unavailable" });
    const accepted = blxControlService.pushSolidFrame({
      frameId: req.body?.frameId || 0,
      pixels: req.body?.pixels,
      color: Array.isArray(req.body?.color) ? req.body.color : [255, 0, 0],
      brightness: req.body?.brightness
    });
    return res.json({ ok: Boolean(accepted), accepted: Boolean(accepted), snapshot: blxControlService.snapshot() });
  });

  app.get("/api/live/full-token", (req, res) => {
    if (!liveFullEnableTokenGate) return res.status(503).json({ ok: false, error: "full live token gate unavailable" });
    const tokenGate = liveFullEnableTokenGate.snapshot();
    liveAuditLog?.append?.("live.full-token.read", { tokenGate });
    res.json({ ok: true, tokenGate });
  });

  app.post("/api/live/full-token/issue", (req, res) => {
    if (!liveFullEnableTokenGate) return res.status(503).json({ ok: false, error: "full live token gate unavailable" });
    const tokenGate = liveFullEnableTokenGate.issue(req.body || {});
    liveAuditLog?.append?.("live.full-token.issue", { tokenGate, request: req.body || {} });
    res.json({ ok: tokenGate.ok, tokenGate });
  });

  app.post("/api/live/full-token/validate", (req, res) => {
    if (!liveFullEnableTokenGate) return res.status(503).json({ ok: false, error: "full live token gate unavailable" });
    const tokenGate = liveFullEnableTokenGate.validate(req.body || {});
    liveAuditLog?.append?.("live.full-token.validate", { tokenGate, request: req.body || {} });
    res.json({ ok: tokenGate.ok, tokenGate });
  });

  app.post("/api/live/full-token/revoke", (req, res) => {
    if (!liveFullEnableTokenGate) return res.status(503).json({ ok: false, error: "full live token gate unavailable" });
    const tokenGate = liveFullEnableTokenGate.revoke(req.body?.reason || "operator_revoke");
    liveAuditLog?.append?.("live.full-token.revoke", { tokenGate, reason: req.body?.reason || "operator_revoke" });
    res.json({ ok: true, tokenGate });
  });

  app.post("/api/live/physical-release/preflight", (req, res) => {
    if (!livePhysicalReleasePreflight) return res.status(503).json({ ok: false, error: "physical release preflight unavailable" });
    const preflight = livePhysicalReleasePreflight.evaluate(req.body || {});
    liveAuditLog?.append?.("live.physical-release.preflight", { preflight, request: req.body || {} });
    res.json({ ok: preflight.ok, preflight });
  });

  app.get("/api/live/audit", (req, res) => {
    if (!liveAuditLog) return res.status(503).json({ ok: false, error: "live audit log unavailable" });
    res.json({ ok: true, audit: liveAuditLog.read({ limit: req.query?.limit }) });
  });

  app.post("/api/live/audit/clear", (req, res) => {
    if (!liveAuditLog) return res.status(503).json({ ok: false, error: "live audit log unavailable" });
    const auditEntry = liveAuditLog.clear(req.body?.reason || "operator_clear_audit");
    res.json({ ok: true, auditEntry });
  });
}
