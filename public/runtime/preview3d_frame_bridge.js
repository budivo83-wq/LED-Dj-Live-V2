import { FRAME_CONSUMERS } from "./frame_authority.js";

// STEP 3M — read-only 3D preview frame bridge
//
// Purpose:
//   Export a lightweight snapshot of the latest authoritative frame bus packet
//   to preview3d.html without coupling the 3D sandbox to render/output/loading.
//
// Safety rules:
//   - read-only consumer of frame_bus packets
//   - throttled, lossy preview snapshot only
//   - never throws into render loop
//   - no imports from app/startup/output modules

const CHANNEL_NAME = "led-dj-live-preview3d-frame";
const STORAGE_KEY = "ledDjLive.preview3d.latestFrame.v1";
const MIN_INTERVAL_MS = 1000 / 15;
const STORAGE_INTERVAL_MS = 350;
const MAX_POINTS = 640;

let bridgeStarted = false;
let channel = null;
let lastPostAt = 0;
let lastStorageAt = 0;
let unsubscribe = null;

function nowSafe() {
  if (globalThis.performance?.now) return performance.now();
  return Date.now();
}

function makePreviewPayload(packet) {
  if (!packet || !(packet.frame instanceof Uint8Array)) return null;
  const width = Math.max(0, Number(packet.width) || 0);
  const height = Math.max(0, Number(packet.height) || 0);
  const frame = packet.frame;
  if (!width || !height || frame.byteLength < width * height * 3) return null;

  const totalPixels = width * height;
  const stride = Math.max(1, Math.ceil(totalPixels / MAX_POINTS));
  const samples = [];

  for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += stride) {
    const offset = pixelIndex * 3;
    samples.push([
      pixelIndex % width,
      Math.floor(pixelIndex / width),
      frame[offset] | 0,
      frame[offset + 1] | 0,
      frame[offset + 2] | 0
    ]);
  }

  return {
    type: "led-preview3d-frame",
    version: 1,
    frameId: Number(packet.frameId) || 0,
    timestamp: Date.now(),
    width,
    height,
    sampleStride: stride,
    samples,
    meta: {
      source: packet.source || "frame-bus",
      outputEnabled: packet.meta?.outputEnabled !== false,
      previewMode: packet.meta?.previewMode || "unknown",
      byteLength: packet.byteLength || frame.byteLength || 0
    }
  };
}

function postPayload(payload) {
  if (!payload) return;
  try {
    channel?.postMessage(payload);
  } catch (error) {
    console.warn("preview3d frame bridge channel post failed", error);
  }

  const t = nowSafe();
  if (t - lastStorageAt < STORAGE_INTERVAL_MS) return;
  lastStorageAt = t;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore localStorage failures: private mode/quota must not affect render.
  }
}

export function initPreview3dFrameBridge(frameSource) {
  if (bridgeStarted) return { started: true, reason: "already-started" };
  if (!frameSource || typeof frameSource.subscribe !== "function") {
    return { started: false, reason: "missing-frame-source" };
  }

  bridgeStarted = true;

  try {
    if (typeof globalThis.BroadcastChannel === "function") {
      channel = new BroadcastChannel(CHANNEL_NAME);
    }
  } catch {
    channel = null;
  }

  try {
    unsubscribe = frameSource.subscribe((packet) => {
      const t = nowSafe();
      if (t - lastPostAt < MIN_INTERVAL_MS) return;
      lastPostAt = t;
      postPayload(makePreviewPayload(packet));
    }, { consumer: FRAME_CONSUMERS.PREVIEW3D_FRAME_BRIDGE });
  } catch (error) {
    console.warn("preview3d frame bridge subscribe failed", error);
    bridgeStarted = false;
    return { started: false, reason: "subscribe-failed" };
  }

  globalThis.__preview3dFrameBridge = Object.freeze({
    channelName: CHANNEL_NAME,
    storageKey: STORAGE_KEY,
    maxPoints: MAX_POINTS,
    minIntervalMs: MIN_INTERVAL_MS,
    stop: stopPreview3dFrameBridge
  });

  return { started: true, reason: channel ? "broadcast+storage" : "storage-only" };
}

export function stopPreview3dFrameBridge() {
  try { unsubscribe?.(); } catch {}
  unsubscribe = null;
  try { channel?.close?.(); } catch {}
  channel = null;
  bridgeStarted = false;
}

export const PREVIEW3D_FRAME_BRIDGE_CHANNEL = CHANNEL_NAME;
export const PREVIEW3D_FRAME_BRIDGE_STORAGE_KEY = STORAGE_KEY;
