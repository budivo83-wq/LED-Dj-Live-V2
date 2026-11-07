import { freezeUniqueList } from "./list_utils.js";

export const TRANSPORT_REGISTRY_VERSION = "10Z-transport-capability-registry";

export const TRANSPORT_CAPABILITIES = Object.freeze({
  RGB: "rgb",
  BINARY: "binary",
  UNIVERSE: "universe",
  BROADCAST: "broadcast",
  MULTICAST: "multicast",
  SYNC: "sync",
  FRAME: "frame",
  SEGMENT: "segment",
  ROUTING: "routing",
  LOW_LATENCY: "low_latency",
  MOCK: "mock"
});

const DEFAULT_TRANSPORTS = Object.freeze([
  Object.freeze({ id: "mock", name: "Mock", enabled: true, priority: 10, maxFPS: 240, capabilities: ["mock", "rgb", "frame"] }),
  Object.freeze({ id: "serial", name: "Serial", enabled: true, priority: 100, maxFPS: 120, capabilities: ["rgb", "binary", "low_latency", "frame"] }),
  Object.freeze({ id: "blx", name: "BLX", enabled: true, priority: 90, maxFPS: 120, capabilities: ["rgb", "segment", "sync", "frame", "routing"] }),
  Object.freeze({ id: "artnet", name: "ArtNet", enabled: true, priority: 80, maxFPS: 60, universeStart: 0, maxUniverses: 32768, capabilities: ["rgb", "universe", "broadcast", "sync", "frame"] }),
  Object.freeze({ id: "sacn", name: "sACN", enabled: true, priority: 70, maxFPS: 60, universeStart: 1, maxUniverses: 63999, capabilities: ["rgb", "universe", "multicast", "sync", "frame"] })
]);

function normalizeId(value) {
  return String(value || "").split(":")[0].trim().toLowerCase() || "unknown";
}

function freezeTransport(transport) {
  return Object.freeze({
    ...transport,
    id: normalizeId(transport?.id),
    name: String(transport?.name || transport?.id || "Unknown"),
    enabled: transport?.enabled !== false,
    priority: Number.isFinite(Number(transport?.priority)) ? Number(transport.priority) : 0,
    maxFPS: Number.isFinite(Number(transport?.maxFPS)) ? Number(transport.maxFPS) : 0,
    capabilities: freezeUniqueList((Array.isArray(transport?.capabilities) ? transport.capabilities : []).map((cap) => String(cap).trim()).filter(Boolean))
  });
}

export function createTransportRegistry(overrides = {}) {
  const patchById = new Map(Object.entries(overrides || {}).map(([id, patch]) => [normalizeId(id), patch || {}]));
  const transports = DEFAULT_TRANSPORTS.map((transport) => freezeTransport({ ...transport, ...(patchById.get(transport.id) || {}) }));
  const byId = new Map(transports.map((transport) => [transport.id, transport]));
  return Object.freeze({
    version: TRANSPORT_REGISTRY_VERSION,
    transports: Object.freeze(transports),
    ids: Object.freeze(transports.map((transport) => transport.id)),
    get(id) { return byId.get(normalizeId(id)) || null; },
    has(id) { return byId.has(normalizeId(id)); },
    enabled() { return transports.filter((transport) => transport.enabled); }
  });
}

export function resolveTransportCapabilities({ protocols = [], requiredCapabilities = ["rgb", "frame"], registry = createTransportRegistry(), allowMock = false } = {}) {
  const wanted = freezeUniqueList((Array.isArray(protocols) ? protocols : []).map(normalizeId).filter((id) => id && id !== "unknown"));
  if (!wanted.length && allowMock) wanted.push("mock");
  const required = freezeUniqueList((Array.isArray(requiredCapabilities) ? requiredCapabilities : []).map(String).filter(Boolean));
  const candidates = wanted
    .map((id) => registry.get(id))
    .filter(Boolean)
    .filter((transport) => transport.enabled || (allowMock && transport.id === "mock"))
    .filter((transport) => required.every((capability) => transport.capabilities.includes(capability)))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  return Object.freeze({
    version: TRANSPORT_REGISTRY_VERSION,
    requested: Object.freeze(wanted),
    required: Object.freeze(required),
    selected: Object.freeze(candidates.map((transport) => transport.id)),
    selectedTransports: Object.freeze(candidates),
    ok: candidates.length > 0,
    reason: candidates.length ? "transport_capability_match" : "no_transport_capability_match"
  });
}
