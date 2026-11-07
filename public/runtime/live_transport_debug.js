const DEFAULT_ARTNET_DEBUG_API = Object.freeze({
  status: "/api/artnet/sync-live/status",
  stop: "/api/artnet/sync-live/stop",
  discovery: "/api/artnet/debug/discovery",
  nodes: "/api/artnet/debug/nodes"
});

function setNodeJson(target, payload) {
  if (target) target.value = JSON.stringify(payload, null, 2);
}

function renderBlxNodesList(refs, nodes = []) {
  const list = Array.isArray(nodes) ? nodes : [];
  setNodeJson(refs.liveBlxNodesStatus, {
    count: list.length,
    nodes: list.map((node) => ({
      id: node.id || "",
      host: node.host || "",
      port: Number(node.port || 0),
      nodeId: Number.isFinite(node.nodeId) ? node.nodeId : null,
      fwVersion: node.fwVersion || "",
      capabilities: Number.isFinite(node.capabilities) ? node.capabilities : null,
      pixelCount: Number.isFinite(node.pixelCount) ? node.pixelCount : null,
      fps: Number.isFinite(node.fps) ? node.fps : null,
      seenAt: Number(node.seenAt || 0)
    }))
  });
}

function renderArtnetNodesList(refs, nodes = []) {
  const list = Array.isArray(nodes) ? nodes : [];
  setNodeJson(refs.liveArtnetNodesStatus, {
    count: list.length,
    nodes: list.map((node) => ({
      id: node.id || "",
      host: node.host || "",
      port: Number(node.port || 0),
      shortName: node.shortName || "",
      longName: node.longName || "",
      universeOut: Number(node.universeOut || 0),
      universeIn: Number(node.universeIn || 0),
      seenAt: Number(node.seenAt || 0)
    }))
  });
}

export function createLiveTransportDebugController({
  fetchRef,
  refs,
  setText,
  postJson,
  renderArtnetDiagnosticsSummary,
  getLatestArtnetDiagnostics,
  artnetDebugApi = DEFAULT_ARTNET_DEBUG_API
} = {}) {
  async function refreshBlxRuntimeStatus() {
    try {
      const response = await fetchRef("/api/live/blx/status");
      if (!response.ok) throw new Error(`/api/live/blx/status ${response.status}`);
      const data = await response.json();
      const running = data?.active ? "RUNNING" : "STOPPED";
      const transport = String(data?.adapter?.transport || "unknown").toUpperCase();
      const queue = Number(data?.adapter?.queueDepth || 0);
      setText(refs.liveBlxDiagnosticsStatus, `BLX ${running} | ${transport} | q ${queue}`);
      return data;
    } catch (error) {
      setText(refs.liveBlxDiagnosticsStatus, `BLX STATUS FAILED: ${error?.message || error}`);
      return null;
    }
  }

  async function startBlxRuntime() {
    try {
      const data = await postJson(fetchRef, "/api/live/blx/start", {});
      const running = data?.active ? "RUNNING" : "STOPPED";
      setText(refs.liveBlxDiagnosticsStatus, `BLX START OK | ${running}`);
      return data;
    } catch (error) {
      setText(refs.liveBlxDiagnosticsStatus, `BLX START FAILED: ${error?.message || error}`);
      return null;
    }
  }

  async function stopBlxRuntime() {
    try {
      const data = await postJson(fetchRef, "/api/live/blx/stop", {});
      const running = data?.active ? "RUNNING" : "STOPPED";
      setText(refs.liveBlxDiagnosticsStatus, `BLX STOP OK | ${running}`);
      return data;
    } catch (error) {
      setText(refs.liveBlxDiagnosticsStatus, `BLX STOP FAILED: ${error?.message || error}`);
      return null;
    }
  }

  async function refreshBlxNodes() {
    try {
      const response = await fetchRef("/api/live/blx/nodes?maxAgeMs=30000");
      if (!response.ok) throw new Error(`/api/live/blx/nodes ${response.status}`);
      const data = await response.json();
      const nodes = Array.isArray(data.nodes) ? data.nodes : [];
      renderBlxNodesList(refs, nodes);
      setText(refs.liveBlxDiagnosticsStatus, `BLX NODES ${nodes.length}`);
      return nodes;
    } catch (error) {
      setText(refs.liveBlxDiagnosticsStatus, `BLX NODES FAILED: ${error?.message || error}`);
      return [];
    }
  }

  async function discoverBlxNodes() {
    try {
      const data = await postJson(fetchRef, "/api/live/blx/discovery", { maxAgeMs: 30000 });
      const nodes = Array.isArray(data.nodes) ? data.nodes : [];
      renderBlxNodesList(refs, nodes);
      setText(refs.liveBlxDiagnosticsStatus, `BLX DISCOVERY SENT | nodes ${nodes.length}`);
      return nodes;
    } catch (error) {
      setText(refs.liveBlxDiagnosticsStatus, `BLX DISCOVERY FAILED: ${error?.message || error}`);
      return [];
    }
  }

  async function sendBlxSolidColor(color = [255, 0, 0]) {
    try {
      const data = await postJson(fetchRef, "/api/live/blx/frame/solid", {
        pixels: 300,
        color
      });
      const queue = Number(data?.snapshot?.adapter?.queueDepth || 0);
      setText(refs.liveBlxDiagnosticsStatus, `BLX SOLID ${color.join(",")} | q ${queue}`);
    } catch (error) {
      setText(refs.liveBlxDiagnosticsStatus, `BLX SOLID FAILED: ${error?.message || error}`);
    }
  }

  async function refreshArtnetNodes() {
    try {
      const response = await fetchRef(`${artnetDebugApi.nodes}?maxAgeMs=30000`);
      if (!response.ok) throw new Error(`${artnetDebugApi.nodes} ${response.status}`);
      const data = await response.json();
      const nodes = Array.isArray(data.nodes) ? data.nodes : [];
      renderArtnetNodesList(refs, nodes);
      renderArtnetDiagnosticsSummary(refs, getLatestArtnetDiagnostics?.() || null, `ARTNET NODES ${nodes.length}`);
      return nodes;
    } catch (error) {
      setText(refs.liveArtnetDiagnosticsStatus, `ARTNET NODES FAILED: ${error?.message || error}`);
      return [];
    }
  }

  async function discoverArtnetNodes() {
    try {
      const data = await postJson(fetchRef, artnetDebugApi.discovery, { maxAgeMs: 30000 });
      const nodes = Array.isArray(data.nodes) ? data.nodes : [];
      renderArtnetNodesList(refs, nodes);
      setText(refs.liveArtnetDiagnosticsStatus, `ARTNET DISCOVERY SENT | nodes ${nodes.length}`);
      return nodes;
    } catch (error) {
      setText(refs.liveArtnetDiagnosticsStatus, `ARTNET DISCOVERY FAILED: ${error?.message || error}`);
      return [];
    }
  }

  async function refreshArtnetRuntimeStatus() {
    try {
      const response = await fetchRef(artnetDebugApi.status);
      if (!response.ok) throw new Error(`${artnetDebugApi.status} ${response.status}`);
      const data = await response.json();
      const running = data?.running ? "RUNNING" : "STOPPED";
      const target = data?.network?.resolvedTarget?.targetIp
        ? `${data.network.resolvedTarget.targetIp}:${Number(data.network.port || 6454)}`
        : (data?.network?.outputIp ? `${data.network.outputIp}:${Number(data.network.port || 6454)}` : "NO TARGET");
      const fps = Number(data?.actualFps || data?.frameClock?.effectiveFps || 0);
      setText(refs.liveArtnetDiagnosticsStatus, `ARTNET ${running} | ${target} | ${fps ? `${fps.toFixed(1)} FPS` : "idle"}`);
      return data;
    } catch (error) {
      setText(refs.liveArtnetDiagnosticsStatus, `ARTNET STATUS FAILED: ${error?.message || error}`);
      return null;
    }
  }

  async function startArtnetRuntime() {
    setText(refs.liveArtnetDiagnosticsStatus, "ARTNET START MOVED | use Settings or guarded ArtNet dry/physical output actions");
    return null;
  }

  async function stopArtnetRuntime() {
    try {
      const data = await postJson(fetchRef, artnetDebugApi.stop, {});
      const running = data?.running ? "RUNNING" : "STOPPED";
      setText(refs.liveArtnetDiagnosticsStatus, `ARTNET STOP OK | ${running}`);
      return data;
    } catch (error) {
      setText(refs.liveArtnetDiagnosticsStatus, `ARTNET STOP FAILED: ${error?.message || error}`);
      return null;
    }
  }

  async function sendArtnetSolidColor(color = [255, 0, 0]) {
    setText(
      refs.liveArtnetDiagnosticsStatus,
      `ARTNET SOLID DISABLED | use guarded output tests for ${color.join(",")} instead of legacy writer`
    );
  }

  function bind() {
    refs.liveBlxStatusButton?.addEventListener?.("click", async () => { await refreshBlxRuntimeStatus(); });
    refs.liveBlxStartButton?.addEventListener?.("click", async () => {
      const started = await startBlxRuntime();
      if (started) await refreshBlxNodes();
    });
    refs.liveBlxStopButton?.addEventListener?.("click", async () => { await stopBlxRuntime(); });
    refs.liveBlxDiscoverButton?.addEventListener?.("click", async () => { await discoverBlxNodes(); });
    refs.liveBlxNodesButton?.addEventListener?.("click", async () => { await refreshBlxNodes(); });
    refs.liveBlxSendRedButton?.addEventListener?.("click", async () => { await sendBlxSolidColor([255, 0, 0]); });
    refs.liveBlxSendGreenButton?.addEventListener?.("click", async () => { await sendBlxSolidColor([0, 255, 0]); });
    refs.liveBlxSendBlueButton?.addEventListener?.("click", async () => { await sendBlxSolidColor([0, 0, 255]); });
    refs.liveBlxSendBlackoutButton?.addEventListener?.("click", async () => { await sendBlxSolidColor([0, 0, 0]); });

    refs.liveArtnetStatusButton?.addEventListener?.("click", async () => { await refreshArtnetRuntimeStatus(); });
    refs.liveArtnetStartButton?.addEventListener?.("click", async () => {
      const started = await startArtnetRuntime();
      if (started) await refreshArtnetNodes();
    });
    refs.liveArtnetStopButton?.addEventListener?.("click", async () => { await stopArtnetRuntime(); });
    refs.liveArtnetDiscoverButton?.addEventListener?.("click", async () => { await discoverArtnetNodes(); });
    refs.liveArtnetNodesButton?.addEventListener?.("click", async () => { await refreshArtnetNodes(); });
    refs.liveArtnetSendRedButton?.addEventListener?.("click", async () => { await sendArtnetSolidColor([255, 0, 0]); });
    refs.liveArtnetSendGreenButton?.addEventListener?.("click", async () => { await sendArtnetSolidColor([0, 255, 0]); });
    refs.liveArtnetSendBlueButton?.addEventListener?.("click", async () => { await sendArtnetSolidColor([0, 0, 255]); });
    refs.liveArtnetSendBlackoutButton?.addEventListener?.("click", async () => { await sendArtnetSolidColor([0, 0, 0]); });
  }

  return Object.freeze({
    bind,
    refreshBlxRuntimeStatus,
    startBlxRuntime,
    stopBlxRuntime,
    refreshBlxNodes,
    discoverBlxNodes,
    sendBlxSolidColor,
    refreshArtnetNodes,
    discoverArtnetNodes,
    refreshArtnetRuntimeStatus,
    startArtnetRuntime,
    stopArtnetRuntime,
    sendArtnetSolidColor
  });
}
