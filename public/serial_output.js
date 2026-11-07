import { createBlxV2Sender, BLX_V2_FLAGS } from "./blx_sender_v2.js";
import {
  buildSerialFrame as buildMappedSerialFrame,
  buildSegmentedFrameForMode,
  buildRoutedFrameForMode,
  wrapBlxNetTransportPacket,
  clampPort,
  shouldUseLegacySerialPayload,
  effectiveSerialRoutingMode
} from "./runtime/mapping_transform.js";
import { applyMappingOutputTestFrame, readMappingTestOutput } from "./runtime/mapping_v2_test_output.js";
import { compileArtNetPatchFromMappingV2, finalizeArtNetPatch } from "./runtime/mapping_v2.js";
import { loadMappingV2 } from "./runtime/mapping_v2_store.js";

export function createSerialOutput(deps) {
  const {
    getWidth,
    getHeight,
    getSerialReversedRows,
    getSerialEnabledRows,
    getSerialBrightnessRows,
    getSerialPixelLimitRows,
    getSerialOutputRouteRows,
    getSerialColorOrderRows,
    getOutputMode,
    getBlxNetConfig,
    getBlxSerialBaud,
    getSerialSettings,
    getSocket,
    setLastSerialFrameAt
  } = deps;

  const blxV2 = createBlxV2Sender();
  let blxFrameId = 0;
  let worker = null;
  let workerFailed = false;
  let serialFrameBuffers = [null, null];
  let serialFrameBufferSize = 0;
  let serialFrameBufferIndex = 0;
  let lastArtnetLiveSendAtMs = 0;
  let cachedArtnetPatch = null;
  let cachedArtnetPatchAt = 0;
  let cachedArtnetPatchSizeKey = "";
  const ARTNET_MASTER_PATCH_STORAGE_KEY = "led-engine-artnet-master-patch-v1";
  let lastArtnetPatchSignature = "";
  let lastDebug = {
    mode: "legacy",
    strips: 0,
    ledsPerStrip: 0,
    pixels: 0,
    frameBytes: 0,
    packetBytes: 0,
    checksum: "--",
    type: "--",
    seq: 0
  };

  function buildSerialFrame(frame) {
    const mode = String(getOutputMode?.() || "preview").toLowerCase();
    const rows = {
      reversed: getSerialReversedRows?.() || [],
      enabled: getSerialEnabledRows?.() || [],
      brightness: getSerialBrightnessRows?.() || [],
      pixelLimit: getSerialPixelLimitRows?.() || [],
      route: getSerialOutputRouteRows?.() || [],
      colorOrder: getSerialColorOrderRows?.() || []
    };
    const mappingTest = readMappingTestOutput();
    const applyMappingTest = shouldApplyMappingTestToLiveSerial(mappingTest);
    const sourceFrame = applyMappingTest
      ? applyMappingOutputTestFrame(frame, getWidth(), getHeight(), rows, mappingTest)
      : frame;
    const mappingMode = effectiveSerialRoutingMode(rows, mode);
    const mapped = buildMappedSerialFrame(sourceFrame, getWidth(), getHeight(), rows, mappingMode);
    const serialFrame = acquireSerialFrameBuffer(mapped.length);
    serialFrame.set(mapped);
    return serialFrame;
  }


  function shouldApplyMappingTestToLiveSerial(test) {
    const armed = Boolean(test?.armed) && String(test?.pattern || "off").toLowerCase() !== "off";
    if (!armed) return false;
    try {
      return globalThis.localStorage?.getItem?.("led-engine-allow-mapping-test-on-live-serial") === "1";
    } catch {
      return false;
    }
  }

  function buildSerialFrameLegacyUnused(frame) {
    const mode = String(getOutputMode?.() || "preview").toLowerCase();
    const mapped = buildMappedSerialFrame(frame, getWidth(), getHeight(), {
      reversed: getSerialReversedRows?.() || [],
      enabled: getSerialEnabledRows?.() || [],
      brightness: getSerialBrightnessRows?.() || [],
      pixelLimit: getSerialPixelLimitRows?.() || [],
      route: getSerialOutputRouteRows?.() || [],
      colorOrder: getSerialColorOrderRows?.() || []
    }, mode);
    const serialFrame = acquireSerialFrameBuffer(frame.length);
    serialFrame.set(mapped);
    return serialFrame;
  }

  function acquireSerialFrameBuffer(size) {
    if (serialFrameBufferSize !== size) {
      serialFrameBufferSize = size;
      serialFrameBuffers = [new Uint8Array(size), new Uint8Array(size)];
      serialFrameBufferIndex = 0;
    }

    const index = serialFrameBufferIndex;
    let buffer = serialFrameBuffers[index];
    if (!buffer || buffer.byteLength !== size) {
      buffer = new Uint8Array(size);
      serialFrameBuffers[index] = buffer;
    }

    serialFrameBufferIndex = (index + 1) % serialFrameBuffers.length;
    return buffer;
  }

  function effectiveSerialFps(packetBytes, preferredFps) {
    const preferred = Math.max(1, Number(preferredFps) || 30);
    const mode = String(getOutputMode?.() || "preview").toLowerCase();
    if (mode !== "blx_serial") return preferred;
    const baud = Math.max(9600, Number(getBlxSerialBaud?.() || 1000000));
    const bytes = Math.max(1, Number(packetBytes) || 1);
    const rawFps = baud / (bytes * 10);
    const safeFps = Math.floor(rawFps * 0.5);
    const hardCap = 18;
    return Math.max(6, Math.min(preferred, safeFps, hardCap));
  }

  function ensureWorker() {
    if (workerFailed || worker) return worker;
    if (typeof Worker === "undefined" || typeof URL === "undefined") return null;

    try {
      worker = new Worker(new URL("./serial_output_worker.js", import.meta.url), { type: "module" });
      worker.onmessage = (event) => {
        const data = event?.data || {};
        if (data.type === "debug" && data.debug) {
          lastDebug = { ...lastDebug, ...data.debug };
        } else if (data.type === "error") {
          console.warn("Serial worker error", data.message || "unknown error");
        }
      };
      worker.onerror = () => {
        workerFailed = true;
        try { worker.terminate(); } catch {}
        worker = null;
      };
    } catch (error) {
      workerFailed = true;
      worker = null;
      console.warn("Serial worker unavailable", error);
    }
    return worker;
  }

  function snapshotFrame(frame) {
    return {
      width: getWidth(),
      height: getHeight(),
      outputMode: String(getOutputMode?.() || "preview"),
      serialSettings: { ...(getSerialSettings?.() || {}) },
      blxNetConfig: { ...(getBlxNetConfig?.() || {}) },
      blxSerialBaud: Number(getBlxSerialBaud?.() || 1000000),
      // STEP 13J: normal live serial must not accidentally replay the Mapping Test
      // frame (most often solid cyan/blue) as the live output. Mapping test is only
      // forwarded to the worker when explicitly allowed through localStorage.
      mappingTest: shouldApplyMappingTestToLiveSerial(readMappingTestOutput()) ? readMappingTestOutput() : null,
      rows: {
        reversed: [...(getSerialReversedRows?.() || [])],
        enabled: [...(getSerialEnabledRows?.() || [])],
        brightness: [...(getSerialBrightnessRows?.() || [])],
        pixelLimit: [...(getSerialPixelLimitRows?.() || [])],
        route: [...(getSerialOutputRouteRows?.() || [])]
      }
    };
  }

  function sendSerialFrame(frame) {
    const mode = String(getOutputMode?.() || "preview").toLowerCase();
    const settings = getSerialSettings?.() || {};
    const artnetLive = mode === "artnet" || settings.artnetEnabled === true || settings.routerArtnetEnabled === true;
    const serialLive = settings.enabled === true || settings.routerSerialEnabled === true;
    // STEP22GA: outputMode is no longer exclusive. ArtNet can run in parallel with Serial.
    if (artnetLive) sendArtnetLiveFrame(frame);
    if (!serialLive && mode !== "blx_serial" && mode !== "blx_net") return;
    if (mode === "blx_serial" || mode === "blx_net") {
      const serialWorker = ensureWorker();
      if (serialWorker) {
        const payload = snapshotFrame(frame);
        try {
          // STEP 13BA: never transfer the live render frame buffer to the
          // worker.  Transferring frame.buffer detaches the original ArrayBuffer
          // in the main runtime; after one/few frames the renderer/output can
          // freeze on the last visible frame while the serial LED still blinks.
          // Clone first, then transfer only the clone to keep the live frame
          // owned by the render pipeline.
          const frameSnapshot = new Uint8Array(frame);
          serialWorker.postMessage({ type: "frame", payload, frame: frameSnapshot.buffer }, [frameSnapshot.buffer]);
          setLastSerialFrameAt?.(performance.now());
          return;
        } catch (error) {
          console.warn("Serial worker post failed, falling back", error);
        }
      }
    }

    const payload = buildOutputPayload(frame);
    const socket = getSocket?.();
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(payload);
      setLastSerialFrameAt?.(performance.now());
      setLastDebugFromPayload(payload, mode);
    } catch (error) {
      console.warn("Serial send error", error);
    }
  }

  function sendArtnetLiveFrame(frame) {
    const now = performance.now();
    const settings = getSerialSettings?.() || {};
    // STEP22NY: ArtNet live used settings.fps || 30, so any old saved/default
    // profile silently throttled the physical stream to ~30 FPS. Output FPS is
    // live-transport authority; keep ArtNet at 60 unless operator explicitly
    // configured higher/lower via dedicated live/mirror settings.
    const requestedFps = Math.max(
      Number(settings.artnetMirrorFps || 0),
      Number(settings.maxLiveFps || 0),
      Number(settings.fps || 0),
      Number(globalThis.localStorage?.getItem?.('budilightArtNetMasterMirrorFps22EJ') || 0),
      60
    );
    const fps = Math.max(1, Math.min(120, Number(requestedFps) || 60));
    if (now - lastArtnetLiveSendAtMs < 1000 / fps) return;
    lastArtnetLiveSendAtMs = now;
    try {
      const artnetPatch = getCachedLiveArtnetPatch(now);
      publishArtnetPatchIfNeeded(artnetPatch);
      const mapped = buildSerialFrame(frame);
      const rgb = mapped;
      lastDebug = {
        mode: "artnet-live-master-framebus-step22lz",
        strips: getHeight?.() || 0,
        ledsPerStrip: getWidth?.() || 0,
        pixels: Math.floor((rgb?.length || 0) / 3),
        frameBytes: rgb?.length || 0,
        packetBytes: rgb?.length || 0,
        checksum: "--",
        type: "master-framebus + sync-live",
        seq: 0,
        routeCount: Array.isArray(artnetPatch?.routes) ? artnetPatch.routes.length : 0
      };
      setLastSerialFrameAt?.(performance.now());
    } catch (error) {
      console.warn("ArtNet live output build failed", error);
    }
  }

  function getCachedLiveArtnetPatch(now = performance.now()) {
    const sizeKey = `${getWidth?.() || 0}x${getHeight?.() || 0}`;
    if (cachedArtnetPatch && cachedArtnetPatchSizeKey === sizeKey && now - cachedArtnetPatchAt < 1000) {
      return cachedArtnetPatch;
    }
    cachedArtnetPatch = buildLiveArtnetPatch();
    cachedArtnetPatchAt = now;
    cachedArtnetPatchSizeKey = sizeKey;
    return cachedArtnetPatch;
  }

  function buildLiveArtnetPatch() {
    try {
      const storedRaw = globalThis.localStorage?.getItem?.(ARTNET_MASTER_PATCH_STORAGE_KEY);
      const stored = storedRaw ? JSON.parse(storedRaw) : null;
      if (stored?.version === "artnet-patch-v1" && Array.isArray(stored.routes) && stored.routes.length) {
        return finalizeArtNetPatch(stored, { patchSource: "mapping-screen-saved-master-patch" });
      }
    } catch (error) {
      console.warn("Saved ArtNet master patch ignored", error);
    }
    try {
      const mapping = loadMappingV2(globalThis.localStorage);
      return compileArtNetPatchFromMappingV2(mapping, { width: getWidth(), height: getHeight() });
    } catch (error) {
      console.warn("ArtNet patch compile failed, using legacy fallback", error);
      return null;
    }
  }

  function publishArtnetPatchIfNeeded(artnetPatch) {
    const routes = Array.isArray(artnetPatch?.routes) ? artnetPatch.routes : [];
    if (!routes.length) return;
    const signature = String(artnetPatch.mappingPatchSignature || JSON.stringify(routes.map((route) => [
      route.stripIndex,
      route.universe,
      route.startAddress,
      route.sourcePixelOffset,
      route.pixelCount
    ])));
    if (signature === lastArtnetPatchSignature) return;
    lastArtnetPatchSignature = signature;
    fetch("/api/artnet/master-mirror/patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...artnetPatch,
        source: "performance-uses-canonical-master-patch-step37d"
      })
    }).catch((error) => {
      console.warn("ArtNet patch publish failed", error);
      lastArtnetPatchSignature = "";
    });
  }

  function serialProtocol() {
    return String(getSerialSettings?.()?.protocol || "aa_len_rgb").toLowerCase();
  }


  function clampByte(value, fallback = 0) {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(255, n));
  }

  function countNonZero(bytes) {
    let n = 0;
    for (let i = 0; i < bytes.length; i += 1) if (bytes[i]) n += 1;
    return n;
  }

  function firstBytesHex(bytes, limit = 16) {
    return Array.from(bytes.subarray(0, Math.min(limit, bytes.length)))
      .map((v) => v.toString(16).toUpperCase().padStart(2, "0"))
      .join(" ");
  }

  function simpleAaPixelCount() {
    const settings = getSerialSettings?.() || {};
    const raw = settings.simpleAaPixels ?? settings.aaPixels ?? globalThis.localStorage?.getItem?.("led-simple-aa-pixels") ?? 160;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(2400, n)) : 160;
  }

  function fixedLengthAaRgb(raw, pixelCount) {
    const count = Math.max(1, Number.parseInt(pixelCount, 10) || 160);
    const bytes = count * 3;
    const out = new Uint8Array(bytes);
    if (raw instanceof Uint8Array) out.set(raw.subarray(0, Math.min(raw.length, bytes)), 0);
    return out;
  }

  function applySerialProtocol(routed, preferredProtocol = "aa_len_rgb") {
    // STEP22BX: live/operator output has exactly one supported serial packet.
    // Older protocol names can remain in saved settings, but they are ignored here
    // so stale UI state cannot silently switch the ESP32 receiver out of contract.
    const raw = routed?.data instanceof Uint8Array ? routed.data : new Uint8Array(0);
    const forcedProtocol = "aa_len_rgb";
    const rawPixels = Math.floor(raw.length / 3);
    const aaPixels = simpleAaPixelCount();
    const aaRaw = fixedLengthAaRgb(raw, aaPixels);
    const lenPixels = aaPixels;
    const payload = new Uint8Array(3 + aaRaw.length);
    payload[0] = 0xAA;
    payload[1] = lenPixels & 0xff;
    payload[2] = (lenPixels >> 8) & 0xff;
    payload.set(aaRaw, 3);
    lastDebug = {
      mode: "step22bx-aa-len-rgb-locked",
      protocol: forcedProtocol,
      requestedProtocol: String(preferredProtocol || "aa_len_rgb").toLowerCase(),
      lenField: "pixels_le16",
      strips: routed?.strips || 0,
      ledsPerStrip: routed?.ledsPerStrip || 0,
      pixels: aaPixels,
      rawPixelsBeforeLimit: rawPixels,
      frameBytes: aaRaw.length,
      rawFrameBytesBeforeLimit: raw.length,
      packetBytes: payload.length,
      expectedPacketBytes: 3 + aaPixels * 3,
      nonZeroBytes: countNonZero(aaRaw),
      firstBytes: firstBytesHex(payload),
      checksum: "--",
      type: "0xAA+LEN16_PIXELS_LE+RGB ONLY",
      seq: 0
    };
    return payload;
  }


  function buildOutputPayload(frame) {
    const mode = String(getOutputMode?.() || "preview");
    const serialFrame = buildSerialFrame(frame);
    const rows = {
      pixelLimit: getSerialPixelLimitRows?.() || [],
      route: getSerialOutputRouteRows?.() || [],
      colorOrder: getSerialColorOrderRows?.() || []
    };
    if (mode === "blx_serial" && !shouldUseLegacySerialPayload(rows, mode)) return buildBlxV2SerialPayload(serialFrame);
    if (mode === "blx_net") return buildBlxV2NetPayload(serialFrame, getBlxNetConfig?.() || null);

    const routingMode = effectiveSerialRoutingMode(rows, mode);
    const routed = buildRoutedFrameForMode(serialFrame, getWidth(), getHeight(), rows, routingMode);
    return applySerialProtocol(routed, serialProtocol());
  }

  function buildBlxV2SerialPayload(frame) {
    const segmented = buildSegmentedFrameForMode(frame, getWidth(), getHeight(), {
      pixelLimit: getSerialPixelLimitRows?.() || [],
      route: getSerialOutputRouteRows?.() || []
    }, "blx_serial");
    if (!segmented.segments.length) return buildOutputPayloadFallback(segmented.raw);
    blxFrameId = (blxFrameId + 1) >>> 0;
    const built = blxV2.buildFrameFullPacket(blxFrameId, segmented.segments, BLX_V2_FLAGS.NONE);
    lastDebug = {
      mode: "blx_serial_v2",
      strips: segmented.segments.length,
      ledsPerStrip: segmented.maxPixels,
      pixels: segmented.pixels,
      frameBytes: segmented.raw.length,
      packetBytes: built.packet.length,
      checksum: built.crc.toString(16).toUpperCase().padStart(4, "0"),
      type: "0x01",
      seq: built.seq
    };
    return built.packet;
  }

  function buildBlxV2NetPayload(frame, netConfig) {
    const segmented = buildSegmentedFrameForMode(frame, getWidth(), getHeight(), {
      pixelLimit: getSerialPixelLimitRows?.() || [],
      route: getSerialOutputRouteRows?.() || []
    }, "blx_net");
    if (!segmented.segments.length) return buildOutputPayloadFallback(segmented.raw);
    blxFrameId = (blxFrameId + 1) >>> 0;
    const built = blxV2.buildFrameFullPacket(blxFrameId, segmented.segments, BLX_V2_FLAGS.NONE);
    const targetIp = String(netConfig?.targetIp || "127.0.0.1").trim();
    const port = clampPort(netConfig?.port);
    const tunneled = wrapBlxNetTransportPacket(built.packet, targetIp, port);
    lastDebug = {
      mode: "blx_net_v2",
      strips: segmented.segments.length,
      ledsPerStrip: segmented.maxPixels,
      pixels: segmented.pixels,
      frameBytes: segmented.raw.length,
      packetBytes: tunneled.length,
      checksum: built.crc.toString(16).toUpperCase().padStart(4, "0"),
      type: "0x01",
      seq: built.seq
    };
    return tunneled;
  }

  function buildOutputPayloadFallback(frame) {
    return applySerialProtocol({ data: frame, strips: 0, ledsPerStrip: Math.floor((frame?.length || 0) / 3) }, serialProtocol());
  }


  function setLastDebugFromPayload(payload, mode) {
    if (mode === "blx_serial" || mode === "blx_net") return;
    const pixels = Math.max(0, ((payload?.length || 0) - 3) / 3);
    lastDebug = {
      mode: "step22by-aa-len16-fallback-debug",
      strips: 0,
      ledsPerStrip: 0,
      pixels,
      frameBytes: Math.max(0, (payload?.length || 0) - 3),
      packetBytes: payload?.length || 0,
      checksum: "--",
      type: "--",
      seq: 0
    };
  }

  function getDebugInfo() {
    return { ...lastDebug };
  }

  return { sendSerialFrame, getDebugInfo };
}
