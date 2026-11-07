import { buildArtSyncPacket, buildDefaultEightStripUniverseMap, splitRgbByArtnetPatch, splitRgbByUniverseMap } from "./artnet_core.js";
import { createOutputRateLimiter } from "./rate_limiter.js";

export function createArtNetSenderEngine({
  universeMap = buildDefaultEightStripUniverseMap(),
  fps = 60,
  artSync = true,
  target = { host: "2.1.1.30", port: 6454 },
  sendPacket = null
} = {}) {
  // The monotonic output clock owns Art-Net cadence. Keep this limiter as a
  // safety gate, but never let one early/jittery tick permanently lower the
  // configured FPS; that creates a second hidden clock and causes 60 -> 50 ->
  // 40 FPS degradation even after the scheduler has recovered.
  const limiter = createOutputRateLimiter({ fps, autoAdapt: false, minFps: 20 });
  let sequence = 1;
  let sentFrames = 0;
  let droppedFrames = 0;
  let packetTx = 0;
  let bytesTx = 0;
  let lastError = "";
  let lastUniverseTx = 0;

  function sendFrame(frame = {}) {
    if (!limiter.allow()) {
      droppedFrames += 1;
      return Object.freeze({ ok: false, skipped: true, reason: "rate_limited", packets: [] });
    }

    const packets = frame?.artnetPatch?.routes?.length
      ? splitRgbByArtnetPatch({
          rgb: frame.frame || frame.payload || frame.rgb || [],
          width: frame.width || frame.artnetPatch?.width || universeMap.pixelsPerStrip,
          height: frame.height || frame.artnetPatch?.height || universeMap.stripCount,
          patch: frame.artnetPatch,
          sequence,
          fastPath: true
        })
      : splitRgbByUniverseMap({
          rgb: frame.frame || frame.payload || frame.rgb || [],
          universeMap,
          sequence,
          fastPath: true
        });
    sequence = (sequence + 1) & 0xff;

    try {
      let frameBytes = 0;
      for (let i = 0; i < packets.length; i += 1) {
        const packet = packets[i];
        frameBytes += Number(packet.packetBytes || packet.packet?.byteLength || 0);
        sendPacket?.(packet.packet, {
          host: packet.targetIp || packet.host || target.host,
          port: packet.targetPort || target.port || packet.port || 6454,
          universe: packet.universe,
          opCode: packet.opCode
        });
      }
      if (artSync) {
        const syncPacket = buildArtSyncPacket();
        frameBytes += syncPacket.packetBytes || syncPacket.packet?.byteLength || 0;
        sendPacket?.(syncPacket.packet, {
          host: target.host,
          port: target.port || syncPacket.port || 6454,
          universe: syncPacket.universe,
          opCode: syncPacket.opCode
        });
      }
      sentFrames += 1;
      packetTx += packets.length + (artSync ? 1 : 0);
      bytesTx += frameBytes;
      lastUniverseTx = packets.length;
      lastError = "";
      return { ok: true, packets, target };
    } catch (error) {
      droppedFrames += 1;
      lastError = String(error?.message || error || "artnet_send_failed");
      return { ok: false, packets: [], error: lastError, target };
    }
  }

  return Object.freeze({
    sendFrame,
    setFps: limiter.setFps,
    getStats: () => Object.freeze({
      version: "artnet-sender-engine-v1",
      sentFrames,
      droppedFrames,
      packetTx,
      bytesTx,
      lastUniverseTx,
      universeCount: universeMap.universeCount,
      artSync: Boolean(artSync),
      target,
      rate: limiter.getStats(),
      lastError
    })
  });
}
