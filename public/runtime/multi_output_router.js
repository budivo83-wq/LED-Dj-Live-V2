import { createTransportRegistry, resolveTransportCapabilities } from "./transport_registry.js";
import { runLiveExecutorPreflight } from "./live_executor_preflight.js";
import { buildLiveFrameMirrorValidation } from "./live_frame_mirror_validation.js";

export const MULTI_OUTPUT_ROUTER_VERSION = "11P-live-executor-preflight";

const EXECUTION_AUDIT_HISTORY_MAX_DEFAULT = 8;
const EXECUTION_HEALTH_TREND_MAX_DEFAULT = 12;
let executionAuditHistoryBuffer = [];
let executionHealthTrendBuffer = [];

function freezeArrayCopy(values) {
  return Object.freeze([...(Array.isArray(values) ? values : [])]);
}

function normalizeProtocol(value) {
  return String(value || "").split(":")[0].trim().toLowerCase() || "unknown";
}

function unique(values) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const key = String(value || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function routeKind(output) {
  const id = normalizeProtocol(output);
  if (id === "serial") return "serial";
  if (id === "artnet" || id === "sacn" || id === "blx" || id === "udp" || id === "network") return "network";
  if (id === "dmx") return "dmx";
  if (id === "mock") return "mock";
  return "unknown";
}

function normalizeSegment(segment = {}, index = 0) {
  const physical = segment.physical || segment || {};
  const output = normalizeProtocol(physical.output);
  const pixelCount = Math.max(0, Number(physical.pixelCount || segment.pixelCount || segment.pixels || 0));
  return Object.freeze({
    segmentId: String(segment.id || `seg_${index + 1}`),
    label: String(segment.label || segment.id || `SEG ${index + 1}`),
    enabled: segment.enabled !== false,
    output,
    routeKind: routeKind(output),
    universe: Number(physical.universe || 0),
    startAddress: Number(physical.startAddress ?? physical.start ?? 0),
    pixelStart: Number(physical.pixelStart || 0),
    pixelCount,
    byteCount: pixelCount * 3,
    direction: String(physical.direction || "forward").toLowerCase() === "reverse" ? "reverse" : "forward",
    colorOrder: String(physical.colorOrder || "RGB").toUpperCase(),
    physicalWriteAllowed: false,
    touched: false
  });
}

export function createIdleMultiOutputRouter(reason = "idle") {
  return Object.freeze({
    version: MULTI_OUTPUT_ROUTER_VERSION,
    enabled: false,
    ran: false,
    ok: false,
    decision: "DISABLED",
    routeCount: 0,
    selectedRoutes: [],
    segmentRouteCount: 0,
    segmentRoutes: [],
    routePlanCount: 0,
    routePlans: [],
    routePlanDigest: "none",
    transportBatchCount: 0,
    transportBatches: [],
    transportBatchDigest: "none",
    executionAuditHistoryCount: 0,
    executionAuditHistory: [],
    executionAuditHistoryDigest: "none",
    executionHealthSummaryEnabled: false,
    executionHealthSummaryOk: false,
    executionHealthSummaryDecision: "DISABLED",
    executionHealthSummaryStatus: "OFF",
    executionHealthSummarySeverity: "off",
    executionHealthSummary: null,
    executionHealthSummaryDigest: "none",
    executionHealthTrendEnabled: false,
    executionHealthTrendOk: false,
    executionHealthTrendDecision: "DISABLED",
    executionHealthTrendStatus: "OFF",
    executionHealthTrendSeverity: "off",
    executionHealthTrend: null,
    executionHealthTrendDigest: "none",
    executionReadinessGateEnabled: false,
    executionReadinessGateOk: false,
    executionReadinessGateDecision: "DISABLED",
    executionReadinessGateStatus: "OFF",
    executionReadinessGateSeverity: "off",
    executionReadinessGate: null,
    executionReadinessGateDigest: "none",
    routeDigest: "none",
    selectedTransports: [],
    blockedReason: reason,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    dryRunOnly: true,
    safety: "11O router idle; no physical output write is called"
  });
}

export function buildSegmentRouteManifest({ mapping = null, selectedTransports = [] } = {}) {
  const allowed = new Set(unique(selectedTransports.map(normalizeProtocol)));
  const segments = Array.isArray(mapping?.segments) ? mapping.segments : [];
  const routes = [];
  for (const [index, segment] of segments.entries()) {
    const route = normalizeSegment(segment, index);
    if (!route.enabled || route.output === "none" || route.pixelCount <= 0) continue;
    if (allowed.size && !allowed.has(route.output)) continue;
    routes.push(route);
  }
  const totalsByTransport = {};
  for (const route of routes) {
    const entry = totalsByTransport[route.output] || { segments: 0, pixels: 0, bytes: 0 };
    entry.segments += 1;
    entry.pixels += route.pixelCount;
    entry.bytes += route.byteCount;
    totalsByTransport[route.output] = entry;
  }
  return Object.freeze({
    version: MULTI_OUTPUT_ROUTER_VERSION,
    routeCount: routes.length,
    routes: Object.freeze(routes),
    transports: Object.freeze(unique(routes.map((route) => route.output))),
    totalsByTransport: Object.freeze(totalsByTransport),
    digest: routes.length ? routes.map((route) => `${route.segmentId}:${route.output}:${route.universe}:${route.startAddress}:${route.pixelCount}`).join("|") : "none",
    outputTouched: false,
    networkTouched: false,
    serialTouched: false
  });
}


function routePlanKey(route) {
  const transport = normalizeProtocol(route?.output);
  const universe = Number(route?.universe || 0);
  const routeKindValue = routeKind(transport);
  return `${transport}:${routeKindValue}:${universe}`;
}

export function buildRoutePlan({ segmentManifest = null, maxPayloadBytes = 510 } = {}) {
  const routes = Array.isArray(segmentManifest?.routes) ? segmentManifest.routes : [];
  const groups = new Map();
  for (const route of routes) {
    const key = routePlanKey(route);
    const current = groups.get(key) || {
      id: key,
      transport: normalizeProtocol(route.output),
      routeKind: route.routeKind || routeKind(route.output),
      universe: Number(route.universe || 0),
      segments: [],
      segmentIds: [],
      segmentCount: 0,
      pixelCount: 0,
      byteCount: 0,
      packetEstimate: 0,
      physicalWriteAllowed: false,
      touched: false
    };
    current.segments.push(route);
    current.segmentIds.push(route.segmentId);
    current.segmentCount += 1;
    current.pixelCount += Number(route.pixelCount || 0);
    current.byteCount += Number(route.byteCount || 0);
    groups.set(key, current);
  }
  const safeMax = Math.max(1, Number(maxPayloadBytes || 510));
  const routePlans = Array.from(groups.values()).map((group) => Object.freeze({
    ...group,
    segments: Object.freeze(group.segments),
    segmentIds: Object.freeze(group.segmentIds),
    packetEstimate: Math.max(1, Math.ceil(group.byteCount / safeMax))
  })).sort((a, b) => a.transport.localeCompare(b.transport) || a.universe - b.universe || a.id.localeCompare(b.id));
  const totalsByTransport = {};
  for (const plan of routePlans) {
    const entry = totalsByTransport[plan.transport] || { routePlans: 0, segments: 0, pixels: 0, bytes: 0, packets: 0 };
    entry.routePlans += 1;
    entry.segments += plan.segmentCount;
    entry.pixels += plan.pixelCount;
    entry.bytes += plan.byteCount;
    entry.packets += plan.packetEstimate;
    totalsByTransport[plan.transport] = entry;
  }
  return Object.freeze({
    version: MULTI_OUTPUT_ROUTER_VERSION,
    routePlanCount: routePlans.length,
    routePlans: Object.freeze(routePlans),
    totalsByTransport: Object.freeze(totalsByTransport),
    packetEstimate: routePlans.reduce((sum, plan) => sum + plan.packetEstimate, 0),
    payloadBytes: routePlans.reduce((sum, plan) => sum + plan.byteCount, 0),
    digest: routePlans.length ? routePlans.map((plan) => `${plan.transport}:${plan.routeKind}:${plan.universe}:${plan.segmentCount}:${plan.byteCount}:${plan.packetEstimate}`).join("|") : "none",
    outputTouched: false,
    networkTouched: false,
    serialTouched: false
  });
}

export function buildTransportBatches({ routePlan = null } = {}) {
  const plans = Array.isArray(routePlan?.routePlans) ? routePlan.routePlans : [];
  const groups = new Map();
  for (const plan of plans) {
    const transport = normalizeProtocol(plan?.transport);
    const kind = routeKind(transport);
    const key = `${transport}:${kind}`;
    const current = groups.get(key) || {
      id: key,
      transport,
      routeKind: kind,
      routePlanIds: [],
      routePlanCount: 0,
      segmentCount: 0,
      pixelCount: 0,
      payloadBytes: 0,
      packetEstimate: 0,
      universes: [],
      physicalWriteAllowed: false,
      touched: false
    };
    current.routePlanIds.push(plan.id);
    current.routePlanCount += 1;
    current.segmentCount += Number(plan.segmentCount || 0);
    current.pixelCount += Number(plan.pixelCount || 0);
    current.payloadBytes += Number(plan.byteCount || 0);
    current.packetEstimate += Number(plan.packetEstimate || 0);
    if (!current.universes.includes(Number(plan.universe || 0))) current.universes.push(Number(plan.universe || 0));
    groups.set(key, current);
  }
  const batches = Array.from(groups.values()).map((batch) => Object.freeze({
    ...batch,
    routePlanIds: Object.freeze(batch.routePlanIds),
    universes: Object.freeze(batch.universes.sort((a, b) => a - b)),
    batchDigest: `${batch.transport}:${batch.routeKind}:${batch.routePlanCount}:${batch.segmentCount}:${batch.payloadBytes}:${batch.packetEstimate}`
  })).sort((a, b) => a.transport.localeCompare(b.transport) || a.routeKind.localeCompare(b.routeKind));
  const totalsByTransport = {};
  for (const batch of batches) {
    totalsByTransport[batch.transport] = {
      routePlans: batch.routePlanCount,
      segments: batch.segmentCount,
      pixels: batch.pixelCount,
      bytes: batch.payloadBytes,
      packets: batch.packetEstimate,
      universes: batch.universes.length
    };
  }
  return Object.freeze({
    version: MULTI_OUTPUT_ROUTER_VERSION,
    transportBatchCount: batches.length,
    transportBatches: Object.freeze(batches),
    totalsByTransport: Object.freeze(totalsByTransport),
    packetEstimate: batches.reduce((sum, batch) => sum + batch.packetEstimate, 0),
    payloadBytes: batches.reduce((sum, batch) => sum + batch.payloadBytes, 0),
    digest: batches.length ? batches.map((batch) => batch.batchDigest).join("|") : "none",
    outputTouched: false,
    networkTouched: false,
    serialTouched: false
  });
}


function createValidationIssue(code, severity, message, ref = {}) {
  return Object.freeze({
    code,
    severity,
    message,
    ...ref
  });
}

export function validateTransportBatches({ transportBatchPlan = null, routePlan = null, segmentManifest = null } = {}) {
  const batches = Array.isArray(transportBatchPlan?.transportBatches) ? transportBatchPlan.transportBatches : [];
  const routePlans = Array.isArray(routePlan?.routePlans) ? routePlan.routePlans : [];
  const segmentRoutes = Array.isArray(segmentManifest?.routes) ? segmentManifest.routes : [];
  const routePlanIds = new Set(routePlans.map((plan) => String(plan.id || "")));
  const batchRoutePlanIds = new Set();
  const issues = [];

  for (const route of segmentRoutes) {
    if (!route.segmentId) issues.push(createValidationIssue("SEGMENT_ID_MISSING", "error", "segment route has no segmentId"));
    if (!route.output || route.output === "unknown") issues.push(createValidationIssue("SEGMENT_OUTPUT_INVALID", "error", "segment route has invalid output", { segmentId: route.segmentId || "unknown" }));
    if (Number(route.pixelCount || 0) <= 0) issues.push(createValidationIssue("SEGMENT_PIXEL_COUNT_INVALID", "error", "segment route has invalid pixel count", { segmentId: route.segmentId || "unknown" }));
    if (Number(route.byteCount || 0) !== Number(route.pixelCount || 0) * 3) issues.push(createValidationIssue("SEGMENT_BYTE_COUNT_MISMATCH", "error", "segment byte count must equal pixelCount * 3", { segmentId: route.segmentId || "unknown" }));
    if (Number(route.startAddress || 0) < 0) issues.push(createValidationIssue("SEGMENT_START_ADDRESS_INVALID", "error", "segment route has negative startAddress", { segmentId: route.segmentId || "unknown" }));
  }

  for (const plan of routePlans) {
    if (!plan.id) issues.push(createValidationIssue("ROUTE_PLAN_ID_MISSING", "error", "route plan has no id"));
    if (!plan.transport || plan.transport === "unknown") issues.push(createValidationIssue("ROUTE_PLAN_TRANSPORT_INVALID", "error", "route plan has invalid transport", { routePlanId: plan.id || "unknown" }));
    if (Number(plan.segmentCount || 0) <= 0) issues.push(createValidationIssue("ROUTE_PLAN_EMPTY", "error", "route plan contains no segments", { routePlanId: plan.id || "unknown" }));
    if (Number(plan.byteCount || 0) <= 0) issues.push(createValidationIssue("ROUTE_PLAN_BYTES_INVALID", "error", "route plan contains no payload bytes", { routePlanId: plan.id || "unknown" }));
    if (Number(plan.packetEstimate || 0) <= 0) issues.push(createValidationIssue("ROUTE_PLAN_PACKET_ESTIMATE_INVALID", "error", "route plan has invalid packet estimate", { routePlanId: plan.id || "unknown" }));
  }

  for (const batch of batches) {
    if (!batch.id) issues.push(createValidationIssue("BATCH_ID_MISSING", "error", "transport batch has no id"));
    if (!batch.transport || batch.transport === "unknown") issues.push(createValidationIssue("BATCH_TRANSPORT_INVALID", "error", "transport batch has invalid transport", { batchId: batch.id || "unknown" }));
    if (Number(batch.routePlanCount || 0) <= 0) issues.push(createValidationIssue("BATCH_EMPTY", "error", "transport batch contains no route plans", { batchId: batch.id || "unknown" }));
    if (Number(batch.segmentCount || 0) <= 0) issues.push(createValidationIssue("BATCH_SEGMENTS_INVALID", "error", "transport batch contains no segments", { batchId: batch.id || "unknown" }));
    if (Number(batch.payloadBytes || 0) <= 0) issues.push(createValidationIssue("BATCH_PAYLOAD_INVALID", "error", "transport batch contains no payload bytes", { batchId: batch.id || "unknown" }));
    if (Number(batch.packetEstimate || 0) <= 0) issues.push(createValidationIssue("BATCH_PACKET_ESTIMATE_INVALID", "error", "transport batch has invalid packet estimate", { batchId: batch.id || "unknown" }));
    if (batch.physicalWriteAllowed !== false || batch.touched !== false) issues.push(createValidationIssue("BATCH_GUARD_VIOLATION", "error", "transport batch must stay dry-run and untouched", { batchId: batch.id || "unknown" }));
    for (const id of batch.routePlanIds || []) {
      const key = String(id || "");
      batchRoutePlanIds.add(key);
      if (!routePlanIds.has(key)) issues.push(createValidationIssue("BATCH_ROUTE_PLAN_UNKNOWN", "error", "transport batch references unknown route plan", { batchId: batch.id || "unknown", routePlanId: key || "unknown" }));
    }
  }

  for (const id of routePlanIds) {
    if (id && !batchRoutePlanIds.has(id)) issues.push(createValidationIssue("ROUTE_PLAN_NOT_BATCHED", "error", "route plan is not assigned to a transport batch", { routePlanId: id }));
  }

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  return Object.freeze({
    version: MULTI_OUTPUT_ROUTER_VERSION,
    enabled: true,
    ok: errorCount === 0,
    decision: errorCount === 0 ? "BATCH_VALID" : "BATCH_INVALID",
    issueCount: issues.length,
    errorCount,
    warningCount,
    issues: Object.freeze(issues),
    checkedBatches: batches.length,
    checkedRoutePlans: routePlans.length,
    checkedSegments: segmentRoutes.length,
    digest: issues.length ? issues.map((issue) => `${issue.severity}:${issue.code}`).join("|") : `valid:${batches.length}:${routePlans.length}:${segmentRoutes.length}`,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    dryRunOnly: true
  });
}


export function buildBatchExecutionSchedule({ enabled = false, transportBatchPlan = null, validation = null, targetFPS = 60 } = {}) {
  if (!enabled) {
    return Object.freeze({
      version: MULTI_OUTPUT_ROUTER_VERSION,
      enabled: false,
      ok: false,
      decision: "DISABLED",
      scheduleCount: 0,
      entries: Object.freeze([]),
      totalPacketEstimate: 0,
      totalPayloadBytes: 0,
      frameBudgetMs: 0,
      digest: "none",
      blockedReason: "batch_execution_scheduler_disabled",
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      dryRunOnly: true
    });
  }
  const batches = Array.isArray(transportBatchPlan?.transportBatches) ? transportBatchPlan.transportBatches : [];
  const validationOk = Boolean(validation?.ok && validation?.decision === "BATCH_VALID");
  const safeFPS = Math.max(1, Number(targetFPS || 60));
  const frameBudgetMs = Math.round((1000 / safeFPS) * 1000) / 1000;
  if (!validationOk) {
    return Object.freeze({
      version: MULTI_OUTPUT_ROUTER_VERSION,
      enabled: true,
      ok: false,
      decision: "WAITING_FOR_VALID_BATCHES",
      scheduleCount: 0,
      entries: Object.freeze([]),
      totalPacketEstimate: 0,
      totalPayloadBytes: 0,
      frameBudgetMs,
      digest: "none",
      blockedReason: "transport_batches_not_valid",
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      dryRunOnly: true
    });
  }

  const orderWeight = { serial: 10, blx: 20, artnet: 30, sacn: 40, udp: 50, network: 60, mock: 90, unknown: 99 };
  let cumulativePackets = 0;
  const entries = batches
    .slice()
    .sort((a, b) => (orderWeight[a.transport] ?? 99) - (orderWeight[b.transport] ?? 99) || String(a.id).localeCompare(String(b.id)))
    .map((batch, index) => {
      const packetEstimate = Number(batch.packetEstimate || 0);
      const payloadBytes = Number(batch.payloadBytes || 0);
      const entry = Object.freeze({
        sequence: index + 1,
        id: `exec:${index + 1}:${batch.id}`,
        batchId: String(batch.id || `batch_${index + 1}`),
        transport: String(batch.transport || "unknown"),
        routeKind: String(batch.routeKind || routeKind(batch.transport)),
        routePlanIds: Object.freeze([...(batch.routePlanIds || [])]),
        routePlanCount: Number(batch.routePlanCount || 0),
        segmentCount: Number(batch.segmentCount || 0),
        universes: Object.freeze([...(batch.universes || [])]),
        packetEstimate,
        payloadBytes,
        sendOrder: index + 1,
        dryRunOnly: true,
        physicalWriteAllowed: false,
        touched: false
      });
      cumulativePackets += packetEstimate;
      return entry;
    });
  const totalPayloadBytes = entries.reduce((sum, entry) => sum + entry.payloadBytes, 0);
  const digest = entries.length ? entries.map((entry) => `${entry.sequence}:${entry.transport}:${entry.routePlanCount}:${entry.packetEstimate}:${entry.payloadBytes}`).join("|") : "none";
  return Object.freeze({
    version: MULTI_OUTPUT_ROUTER_VERSION,
    enabled: true,
    ok: entries.length > 0,
    decision: entries.length > 0 ? "SCHEDULED_DRY_RUN" : "NO_BATCHES_TO_SCHEDULE",
    scheduleCount: entries.length,
    entries: Object.freeze(entries),
    totalPacketEstimate: cumulativePackets,
    totalPayloadBytes,
    frameBudgetMs,
    digest,
    blockedReason: entries.length > 0 ? "physical_write_not_allowed" : "no_transport_batches",
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    dryRunOnly: true
  });
}


export function buildExecutionCommitPreview({ enabled = false, schedule = null, frameId = 0, targetFPS = 60 } = {}) {
  if (!enabled) {
    return Object.freeze({
      version: MULTI_OUTPUT_ROUTER_VERSION,
      enabled: false,
      ok: false,
      decision: "DISABLED",
      preview: null,
      digest: "none",
      blockedReason: "execution_commit_preview_disabled",
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      dryRunOnly: true
    });
  }

  const entries = Array.isArray(schedule?.entries) ? schedule.entries : [];
  const scheduleOk = Boolean(schedule?.ok && schedule?.decision === "SCHEDULED_DRY_RUN");
  const safeFPS = Math.max(1, Number(targetFPS || 60));
  const frameBudgetMs = Number(schedule?.frameBudgetMs || Math.round((1000 / safeFPS) * 1000) / 1000);
  if (!scheduleOk || entries.length === 0) {
    return Object.freeze({
      version: MULTI_OUTPUT_ROUTER_VERSION,
      enabled: true,
      ok: false,
      decision: "WAITING_FOR_EXECUTION_SCHEDULE",
      preview: null,
      digest: "none",
      blockedReason: "batch_execution_schedule_not_ready",
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      dryRunOnly: true
    });
  }

  const operations = entries.map((entry, index) => Object.freeze({
    sequence: Number(entry.sequence || index + 1),
    operationId: `commit:${Number(frameId || 0)}:${index + 1}:${entry.batchId}`,
    batchId: String(entry.batchId || `batch_${index + 1}`),
    transport: String(entry.transport || "unknown"),
    routeKind: String(entry.routeKind || routeKind(entry.transport)),
    routePlanIds: Object.freeze([...(entry.routePlanIds || [])]),
    routePlanCount: Number(entry.routePlanCount || 0),
    segmentCount: Number(entry.segmentCount || 0),
    universes: Object.freeze([...(entry.universes || [])]),
    packetEstimate: Number(entry.packetEstimate || 0),
    payloadBytes: Number(entry.payloadBytes || 0),
    sendOrder: Number(entry.sendOrder || index + 1),
    deadlineMs: Math.round(((index + 1) * (frameBudgetMs / Math.max(1, entries.length))) * 1000) / 1000,
    dryRunOnly: true,
    physicalWriteAllowed: false,
    touched: false
  }));

  const preview = Object.freeze({
    frameId: Number(frameId || 0),
    operationCount: operations.length,
    operations: Object.freeze(operations),
    transports: Object.freeze(unique(operations.map((operation) => operation.transport))),
    totalPacketEstimate: operations.reduce((sum, operation) => sum + operation.packetEstimate, 0),
    totalPayloadBytes: operations.reduce((sum, operation) => sum + operation.payloadBytes, 0),
    frameBudgetMs,
    physicalWriteAllowed: false,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    dryRunOnly: true
  });
  const digest = operations.map((operation) => `${operation.sequence}:${operation.transport}:${operation.packetEstimate}:${operation.payloadBytes}:${operation.deadlineMs}`).join("|") || "none";
  return Object.freeze({
    version: MULTI_OUTPUT_ROUTER_VERSION,
    enabled: true,
    ok: true,
    decision: "COMMIT_PREVIEW_DRY_RUN",
    preview,
    digest,
    blockedReason: "physical_write_not_allowed",
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    dryRunOnly: true
  });
}


export function buildExecutionAuditSnapshot({ enabled = false, commitPlan = null, segmentManifest = null, routePlan = null, transportBatchPlan = null, validation = null, schedule = null, commitPreview = null, frameId = 0 } = {}) {
  if (!enabled) {
    return Object.freeze({
      version: MULTI_OUTPUT_ROUTER_VERSION,
      enabled: false,
      ok: false,
      decision: "DISABLED",
      snapshot: null,
      digest: "none",
      blockedReason: "execution_audit_snapshot_disabled",
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      dryRunOnly: true
    });
  }

  const previewOk = Boolean(commitPreview?.ok && commitPreview?.preview);
  if (!previewOk) {
    return Object.freeze({
      version: MULTI_OUTPUT_ROUTER_VERSION,
      enabled: true,
      ok: false,
      decision: "WAITING_FOR_COMMIT_PREVIEW",
      snapshot: null,
      digest: "none",
      blockedReason: "execution_commit_preview_not_ready",
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      dryRunOnly: true
    });
  }

  const snapshot = Object.freeze({
    frameId: Number(frameId || commitPreview.preview.frameId || 0),
    commitPlanDecision: String(commitPlan?.decision || "unknown"),
    commitPlanPackets: Number(commitPlan?.commitPlanPackets || 0),
    commitPlanPayloadBytes: Number(commitPlan?.commitPlanPayloadBytes || 0),
    segmentRouteCount: Number(segmentManifest?.routeCount || 0),
    routePlanCount: Number(routePlan?.routePlanCount || 0),
    transportBatchCount: Number(transportBatchPlan?.transportBatchCount || 0),
    validationOk: Boolean(validation?.ok),
    validationIssueCount: Array.isArray(validation?.issues) ? validation.issues.length : 0,
    scheduleCount: Number(schedule?.scheduleCount || 0),
    operationCount: Number(commitPreview.preview.operationCount || 0),
    transports: Object.freeze([...(commitPreview.preview.transports || [])]),
    totalPacketEstimate: Number(commitPreview.preview.totalPacketEstimate || 0),
    totalPayloadBytes: Number(commitPreview.preview.totalPayloadBytes || 0),
    digests: Object.freeze({
      segmentRoutes: String(segmentManifest?.digest || "none"),
      routePlan: String(routePlan?.digest || "none"),
      transportBatches: String(transportBatchPlan?.digest || "none"),
      validation: String(validation?.digest || "none"),
      schedule: String(schedule?.digest || "none"),
      commitPreview: String(commitPreview?.digest || "none")
    }),
    physicalWriteAllowed: false,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    dryRunOnly: true
  });

  const digest = [
    snapshot.frameId,
    snapshot.commitPlanPackets,
    snapshot.commitPlanPayloadBytes,
    snapshot.segmentRouteCount,
    snapshot.routePlanCount,
    snapshot.transportBatchCount,
    snapshot.scheduleCount,
    snapshot.operationCount,
    snapshot.transports.join("+") || "none",
    snapshot.digests.commitPreview
  ].join(":");

  return Object.freeze({
    version: MULTI_OUTPUT_ROUTER_VERSION,
    enabled: true,
    ok: true,
    decision: "AUDIT_SNAPSHOT_DRY_RUN",
    snapshot,
    digest,
    blockedReason: "physical_write_not_allowed",
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    dryRunOnly: true
  });
}


export function resetExecutionAuditHistory() {
  executionAuditHistoryBuffer = [];
}

export function buildExecutionAuditHistory({ enabled = false, auditSnapshot = null, frameId = 0, maxEntries = EXECUTION_AUDIT_HISTORY_MAX_DEFAULT } = {}) {
  const limit = Math.max(1, Math.min(64, Number(maxEntries || EXECUTION_AUDIT_HISTORY_MAX_DEFAULT)));
  if (!enabled) {
    return Object.freeze({
      version: MULTI_OUTPUT_ROUTER_VERSION,
      enabled: false,
      ok: false,
      decision: "DISABLED",
      historyCount: executionAuditHistoryBuffer.length,
      entries: freezeArrayCopy(executionAuditHistoryBuffer),
      digest: executionAuditHistoryBuffer.length ? executionAuditHistoryBuffer.map((entry) => entry.digest).join("|") : "none",
      blockedReason: "execution_audit_history_disabled",
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      dryRunOnly: true
    });
  }

  if (!auditSnapshot?.ok || !auditSnapshot?.snapshot) {
    return Object.freeze({
      version: MULTI_OUTPUT_ROUTER_VERSION,
      enabled: true,
      ok: false,
      decision: "WAITING_FOR_AUDIT_SNAPSHOT",
      historyCount: executionAuditHistoryBuffer.length,
      entries: freezeArrayCopy(executionAuditHistoryBuffer),
      digest: executionAuditHistoryBuffer.length ? executionAuditHistoryBuffer.map((entry) => entry.digest).join("|") : "none",
      blockedReason: "execution_audit_snapshot_not_ready",
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      dryRunOnly: true
    });
  }

  const snapshot = auditSnapshot.snapshot;
  const entry = Object.freeze({
    frameId: Number(frameId || snapshot.frameId || 0),
    sequence: executionAuditHistoryBuffer.length ? Number(executionAuditHistoryBuffer[executionAuditHistoryBuffer.length - 1].sequence || 0) + 1 : 1,
    decision: String(auditSnapshot.decision || "AUDIT_SNAPSHOT_DRY_RUN"),
    operationCount: Number(snapshot.operationCount || 0),
    transportBatchCount: Number(snapshot.transportBatchCount || 0),
    scheduleCount: Number(snapshot.scheduleCount || 0),
    totalPacketEstimate: Number(snapshot.totalPacketEstimate || 0),
    totalPayloadBytes: Number(snapshot.totalPayloadBytes || 0),
    transports: freezeArrayCopy(snapshot.transports || []),
    snapshotDigest: String(auditSnapshot.digest || "none"),
    digest: `${Number(frameId || snapshot.frameId || 0)}:${Number(snapshot.operationCount || 0)}:${Number(snapshot.totalPacketEstimate || 0)}:${Number(snapshot.totalPayloadBytes || 0)}:${String(auditSnapshot.digest || "none")}`,
    physicalWriteAllowed: false,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    dryRunOnly: true
  });

  const last = executionAuditHistoryBuffer[executionAuditHistoryBuffer.length - 1];
  if (!last || last.digest !== entry.digest) {
    executionAuditHistoryBuffer = [...executionAuditHistoryBuffer, entry].slice(-limit);
  }

  const entries = freezeArrayCopy(executionAuditHistoryBuffer);
  const digest = entries.length ? entries.map((item) => item.digest).join("|") : "none";
  return Object.freeze({
    version: MULTI_OUTPUT_ROUTER_VERSION,
    enabled: true,
    ok: true,
    decision: "AUDIT_HISTORY_DRY_RUN",
    historyCount: entries.length,
    entries,
    digest,
    blockedReason: "physical_write_not_allowed",
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    dryRunOnly: true
  });
}

export function buildExecutionAuditExport({ enabled = false, auditSnapshot = null, auditHistory = null, frameId = 0 } = {}) {
  const historyEntries = freezeArrayCopy(auditHistory?.entries || []);
  if (!enabled) {
    return Object.freeze({
      version: MULTI_OUTPUT_ROUTER_VERSION,
      enabled: false,
      ok: false,
      decision: "DISABLED",
      payload: null,
      exportSizeBytes: 0,
      digest: "none",
      blockedReason: "execution_audit_export_disabled",
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      dryRunOnly: true
    });
  }

  if (!auditSnapshot?.ok || !auditSnapshot?.snapshot || !auditHistory?.ok) {
    return Object.freeze({
      version: MULTI_OUTPUT_ROUTER_VERSION,
      enabled: true,
      ok: false,
      decision: "WAITING_FOR_AUDIT_DATA",
      payload: null,
      exportSizeBytes: 0,
      digest: "none",
      blockedReason: "execution_audit_data_not_ready",
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      dryRunOnly: true
    });
  }

  const snapshot = auditSnapshot.snapshot;
  const payload = Object.freeze({
    schema: "execution-audit-export-v1",
    frameId: Number(frameId || snapshot.frameId || 0),
    decision: "AUDIT_EXPORT_DRY_RUN",
    snapshotDigest: String(auditSnapshot.digest || "none"),
    historyDigest: String(auditHistory.digest || "none"),
    historyCount: Number(auditHistory.historyCount || historyEntries.length || 0),
    transports: freezeArrayCopy(snapshot.transports || []),
    totals: Object.freeze({
      operationCount: Number(snapshot.operationCount || 0),
      transportBatchCount: Number(snapshot.transportBatchCount || 0),
      scheduleCount: Number(snapshot.scheduleCount || 0),
      packetEstimate: Number(snapshot.totalPacketEstimate || 0),
      payloadBytes: Number(snapshot.totalPayloadBytes || 0)
    }),
    snapshot: Object.freeze({ ...snapshot }),
    history: Object.freeze(historyEntries.map((entry) => Object.freeze({ ...entry }))),
    physicalWriteAllowed: false,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    dryRunOnly: true
  });

  const serialized = JSON.stringify(payload);
  const digest = [
    payload.schema,
    payload.frameId,
    payload.snapshotDigest,
    payload.historyDigest,
    payload.historyCount,
    payload.totals.operationCount,
    payload.totals.packetEstimate,
    payload.totals.payloadBytes
  ].join(":");

  return Object.freeze({
    version: MULTI_OUTPUT_ROUTER_VERSION,
    enabled: true,
    ok: true,
    decision: "AUDIT_EXPORT_DRY_RUN",
    payload,
    exportSizeBytes: serialized.length,
    digest,
    blockedReason: "physical_write_not_allowed",
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    dryRunOnly: true
  });
}


export function buildExecutionDebugPayload({ enabled = false, auditExport = null, frameId = 0 } = {}) {
  if (!enabled) {
    return Object.freeze({
      version: MULTI_OUTPUT_ROUTER_VERSION,
      enabled: false,
      ok: false,
      decision: "DISABLED",
      payload: null,
      digest: "none",
      blockedReason: "execution_debug_payload_disabled",
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      dryRunOnly: true
    });
  }

  if (!auditExport?.ok || !auditExport?.payload) {
    return Object.freeze({
      version: MULTI_OUTPUT_ROUTER_VERSION,
      enabled: true,
      ok: false,
      decision: "WAITING_FOR_AUDIT_EXPORT",
      payload: null,
      digest: "none",
      blockedReason: "execution_audit_export_not_ready",
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      dryRunOnly: true
    });
  }

  const exported = auditExport.payload;
  const debugPayload = Object.freeze({
    schema: "execution-debug-payload-v1",
    sourceSchema: String(exported.schema || "execution-audit-export-v1"),
    frameId: Number(frameId || exported.frameId || 0),
    decision: "DEBUG_PAYLOAD_DRY_RUN",
    summary: Object.freeze({
      transports: Object.freeze([...(exported.transports || [])]),
      historyCount: Number(exported.historyCount || 0),
      operationCount: Number(exported.totals?.operationCount || 0),
      transportBatchCount: Number(exported.totals?.transportBatchCount || 0),
      packetEstimate: Number(exported.totals?.packetEstimate || 0),
      payloadBytes: Number(exported.totals?.payloadBytes || 0),
      exportSizeBytes: Number(auditExport.exportSizeBytes || 0)
    }),
    digests: Object.freeze({
      auditExport: String(auditExport.digest || "none"),
      snapshot: String(exported.snapshotDigest || "none"),
      history: String(exported.historyDigest || "none")
    }),
    flags: Object.freeze({
      physicalWriteAllowed: false,
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      dryRunOnly: true
    })
  });

  const digest = [
    debugPayload.schema,
    debugPayload.frameId,
    debugPayload.summary.historyCount,
    debugPayload.summary.operationCount,
    debugPayload.summary.packetEstimate,
    debugPayload.summary.payloadBytes,
    debugPayload.digests.auditExport
  ].join(":");

  return Object.freeze({
    version: MULTI_OUTPUT_ROUTER_VERSION,
    enabled: true,
    ok: true,
    decision: "DEBUG_PAYLOAD_DRY_RUN",
    payload: debugPayload,
    digest,
    blockedReason: "physical_write_not_allowed",
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    dryRunOnly: true
  });
}


export function buildExecutionSanityMonitor({ enabled = false, debugPayload = null, auditExport = null, auditHistory = null, auditSnapshot = null, schedule = null, validation = null, frameId = 0 } = {}) {
  if (!enabled) {
    return Object.freeze({
      version: MULTI_OUTPUT_ROUTER_VERSION,
      enabled: false,
      ok: false,
      decision: "DISABLED",
      issueCount: 0,
      issues: Object.freeze([]),
      digest: "none",
      blockedReason: "execution_sanity_monitor_disabled",
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      dryRunOnly: true
    });
  }

  const issues = [];
  const add = (code, severity, message) => issues.push(Object.freeze({ code, severity, message }));
  const debugOk = Boolean(debugPayload?.ok && debugPayload?.payload);
  const exportOk = Boolean(auditExport?.ok && auditExport?.payload);
  const historyOk = Boolean(auditHistory?.ok);
  const snapshotOk = Boolean(auditSnapshot?.ok && auditSnapshot?.snapshot);
  const scheduleOk = Boolean(schedule?.ok);
  const validationOk = Boolean(validation?.ok);

  if (!debugOk) add("DEBUG_PAYLOAD_NOT_READY", "error", "execution debug payload is not ready");
  if (!exportOk) add("AUDIT_EXPORT_NOT_READY", "error", "execution audit export is not ready");
  if (!historyOk) add("AUDIT_HISTORY_NOT_READY", "error", "execution audit history is not ready");
  if (!snapshotOk) add("AUDIT_SNAPSHOT_NOT_READY", "error", "execution audit snapshot is not ready");
  if (!scheduleOk) add("EXECUTION_SCHEDULE_NOT_READY", "error", "batch execution schedule is not ready");
  if (!validationOk) add("BATCH_VALIDATION_NOT_READY", "error", "transport batch validation is not valid");

  const payload = debugPayload?.payload || {};
  const exported = auditExport?.payload || {};
  const snapshot = auditSnapshot?.snapshot || {};
  const historyEntries = Array.isArray(auditHistory?.entries) ? auditHistory.entries : [];
  const safeFrameId = Number(frameId || payload.frameId || exported.frameId || snapshot.frameId || 0);

  if (debugOk && exportOk && Number(payload.frameId || 0) !== Number(exported.frameId || 0)) {
    add("FRAME_ID_MISMATCH", "error", "debug payload frameId does not match audit export frameId");
  }
  if (snapshotOk && exportOk && Number(snapshot.frameId || 0) !== Number(exported.frameId || 0)) {
    add("SNAPSHOT_EXPORT_FRAME_ID_MISMATCH", "error", "audit snapshot frameId does not match audit export frameId");
  }
  if (debugOk && exportOk && String(payload.digests?.auditExport || "") !== String(auditExport?.digest || "")) {
    add("AUDIT_EXPORT_DIGEST_MISMATCH", "error", "debug payload audit export digest does not match source digest");
  }
  if (debugOk && exportOk && Number(payload.summary?.operationCount || 0) !== Number(exported.totals?.operationCount || 0)) {
    add("OPERATION_COUNT_MISMATCH", "error", "debug operation count does not match audit export total");
  }
  if (historyOk && exportOk && Number(exported.historyCount || 0) !== Number(historyEntries.length || 0)) {
    add("HISTORY_COUNT_MISMATCH", "error", "audit export history count does not match history entries");
  }
  if (scheduleOk && snapshotOk && Number(schedule.scheduleCount || 0) !== Number(snapshot.scheduleCount || 0)) {
    add("SCHEDULE_COUNT_MISMATCH", "error", "execution schedule count does not match snapshot schedule count");
  }

  const guardTrip = Boolean(
    payload.flags?.physicalWriteAllowed || payload.flags?.outputTouched || payload.flags?.networkTouched || payload.flags?.serialTouched ||
    exported.physicalWriteAllowed || exported.outputTouched || exported.networkTouched || exported.serialTouched ||
    snapshot.physicalWriteAllowed || snapshot.outputTouched || snapshot.networkTouched || snapshot.serialTouched ||
    schedule?.physicalWriteAllowed || schedule?.outputTouched || schedule?.networkTouched || schedule?.serialTouched ||
    validation?.outputTouched || validation?.networkTouched || validation?.serialTouched
  );
  if (guardTrip) add("DRY_RUN_GUARD_VIOLATION", "error", "dry-run guard was violated by a downstream diagnostic object");

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const digest = issues.length
    ? issues.map((issue) => `${issue.severity}:${issue.code}`).join("|")
    : `sanity:${safeFrameId}:${String(debugPayload?.digest || "none")}:${String(auditExport?.digest || "none")}:${Number(payload.summary?.operationCount || 0)}`;

  return Object.freeze({
    version: MULTI_OUTPUT_ROUTER_VERSION,
    enabled: true,
    ok: errorCount === 0,
    decision: errorCount === 0 ? "SANITY_OK_DRY_RUN" : "SANITY_FAILED",
    frameId: safeFrameId,
    issueCount: issues.length,
    errorCount,
    warningCount,
    issues: Object.freeze(issues),
    digest,
    blockedReason: errorCount === 0 ? "physical_write_not_allowed" : "execution_sanity_issues_found",
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    dryRunOnly: true
  });
}


export function buildExecutionHealthSummary({ enabled = false, sanityMonitor = null, debugPayload = null, auditExport = null, schedule = null, validation = null, frameId = 0 } = {}) {
  if (!enabled) {
    return Object.freeze({
      version: MULTI_OUTPUT_ROUTER_VERSION,
      enabled: false,
      ok: false,
      decision: "DISABLED",
      status: "OFF",
      severity: "off",
      frameId: Number(frameId || 0),
      summary: null,
      digest: "none",
      blockedReason: "execution_health_summary_disabled",
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      dryRunOnly: true
    });
  }

  const issueCount = Number(sanityMonitor?.issueCount || 0);
  const errorCount = Number(sanityMonitor?.errorCount || 0);
  const warningCount = Number(sanityMonitor?.warningCount || 0);
  const validationOk = Boolean(validation?.ok);
  const scheduleOk = Boolean(schedule?.ok);
  const debugOk = Boolean(debugPayload?.ok);
  const exportOk = Boolean(auditExport?.ok);
  const payload = debugPayload?.payload || {};
  const safeFrameId = Number(frameId || sanityMonitor?.frameId || payload.frameId || auditExport?.payload?.frameId || 0);

  const guardTrip = Boolean(
    sanityMonitor?.outputTouched || sanityMonitor?.networkTouched || sanityMonitor?.serialTouched ||
    debugPayload?.outputTouched || debugPayload?.networkTouched || debugPayload?.serialTouched ||
    auditExport?.outputTouched || auditExport?.networkTouched || auditExport?.serialTouched ||
    schedule?.outputTouched || schedule?.networkTouched || schedule?.serialTouched ||
    validation?.outputTouched || validation?.networkTouched || validation?.serialTouched
  );

  let status = "HEALTHY_DRY_RUN";
  let severity = "ok";
  let decision = "HEALTH_OK_DRY_RUN";
  let blockedReason = "physical_write_not_allowed";

  if (guardTrip) {
    status = "GUARD_VIOLATION";
    severity = "critical";
    decision = "HEALTH_FAILED";
    blockedReason = "dry_run_guard_violation";
  } else if (errorCount > 0 || !validationOk || !scheduleOk || !debugOk || !exportOk) {
    status = "ERROR";
    severity = "error";
    decision = "HEALTH_FAILED";
    blockedReason = "execution_pipeline_not_healthy";
  } else if (warningCount > 0) {
    status = "WARNING";
    severity = "warning";
    decision = "HEALTH_WARNING_DRY_RUN";
  }

  const summary = Object.freeze({
    frameId: safeFrameId,
    status,
    severity,
    sanityOk: Boolean(sanityMonitor?.ok),
    validationOk,
    scheduleOk,
    debugPayloadOk: debugOk,
    auditExportOk: exportOk,
    issueCount,
    errorCount,
    warningCount,
    operationCount: Number(payload.summary?.operationCount || auditExport?.payload?.totals?.operationCount || 0),
    transportBatchCount: Number(payload.summary?.transportBatchCount || auditExport?.payload?.totals?.transportBatchCount || 0),
    packetEstimate: Number(payload.summary?.packetEstimate || auditExport?.payload?.totals?.packetEstimate || schedule?.totalPacketEstimate || 0),
    payloadBytes: Number(payload.summary?.payloadBytes || auditExport?.payload?.totals?.payloadBytes || schedule?.totalPayloadBytes || 0),
    transports: Object.freeze([...(payload.summary?.transports || auditExport?.payload?.transports || [])]),
    dryRunOnly: true,
    physicalWriteAllowed: false
  });

  const digest = [
    "health",
    safeFrameId,
    status,
    severity,
    issueCount,
    summary.operationCount,
    summary.packetEstimate,
    String(sanityMonitor?.digest || "none")
  ].join(":");

  return Object.freeze({
    version: MULTI_OUTPUT_ROUTER_VERSION,
    enabled: true,
    ok: severity === "ok" || severity === "warning",
    decision,
    status,
    severity,
    frameId: safeFrameId,
    summary,
    digest,
    blockedReason,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    dryRunOnly: true
  });
}


function severityRank(value) {
  const key = String(value || "off").toLowerCase();
  if (key === "critical") return 4;
  if (key === "error") return 3;
  if (key === "warning") return 2;
  if (key === "ok") return 1;
  return 0;
}

export function resetExecutionHealthTrend() {
  executionHealthTrendBuffer = [];
}

export function buildExecutionHealthTrend({ enabled = false, healthSummary = null, frameId = 0, maxEntries = EXECUTION_HEALTH_TREND_MAX_DEFAULT } = {}) {
  if (!enabled) {
    return Object.freeze({
      version: MULTI_OUTPUT_ROUTER_VERSION,
      enabled: false,
      ok: false,
      decision: "DISABLED",
      status: "OFF",
      severity: "off",
      frameId: Number(frameId || healthSummary?.frameId || 0),
      entryCount: 0,
      entries: Object.freeze([]),
      trend: "OFF",
      stability: "unknown",
      digest: "none",
      blockedReason: "execution_health_trend_disabled",
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      dryRunOnly: true
    });
  }

  const safeFrameId = Number(frameId || healthSummary?.frameId || 0);
  const currentStatus = String(healthSummary?.status || "UNKNOWN").toUpperCase();
  const currentSeverity = String(healthSummary?.severity || "off").toLowerCase();
  const currentRank = severityRank(currentSeverity);
  const currentOk = Boolean(healthSummary?.ok);
  const entry = Object.freeze({
    frameId: safeFrameId,
    status: currentStatus,
    severity: currentSeverity,
    rank: currentRank,
    ok: currentOk,
    digest: String(healthSummary?.digest || "none"),
    dryRunOnly: true,
    physicalWriteAllowed: false
  });

  const cappedMax = Math.max(2, Math.min(64, Number(maxEntries || EXECUTION_HEALTH_TREND_MAX_DEFAULT)));
  executionHealthTrendBuffer = [...executionHealthTrendBuffer, entry].slice(-cappedMax);
  const entries = executionHealthTrendBuffer;
  const ranks = entries.map((item) => Number(item.rank || 0));
  const statuses = entries.map((item) => String(item.status || "UNKNOWN"));
  const uniqueStatuses = new Set(statuses);
  const worstRank = ranks.reduce((max, value) => Math.max(max, value), 0);
  const errorFrames = entries.filter((item) => Number(item.rank || 0) >= 3).length;
  const warningFrames = entries.filter((item) => Number(item.rank || 0) === 2).length;
  const okFrames = entries.filter((item) => item.ok && Number(item.rank || 0) <= 1).length;
  const previous = entries.length >= 2 ? entries[entries.length - 2] : null;
  const previousRank = previous ? Number(previous.rank || 0) : currentRank;

  let trend = "STABLE";
  if (entries.length < 2) trend = "WARMING_UP";
  else if (currentRank > previousRank) trend = "DEGRADING";
  else if (currentRank < previousRank) trend = "RECOVERING";
  else if (uniqueStatuses.size > Math.max(2, Math.ceil(entries.length / 2))) trend = "FLAPPING";

  const stability = errorFrames > 0
    ? "unstable"
    : (warningFrames > 0 ? "watch" : (entries.length >= 3 && uniqueStatuses.size === 1 ? "stable" : "warming"));
  const severity = worstRank >= 4 ? "critical" : (worstRank >= 3 ? "error" : (warningFrames > 0 ? "warning" : "ok"));
  const decision = severity === "ok" ? "TREND_STABLE_DRY_RUN" : (severity === "warning" ? "TREND_WATCH_DRY_RUN" : "TREND_UNSTABLE_DRY_RUN");
  const digest = ["trend", safeFrameId, trend, stability, entries.length, okFrames, warningFrames, errorFrames, String(healthSummary?.digest || "none")].join(":");

  return Object.freeze({
    version: MULTI_OUTPUT_ROUTER_VERSION,
    enabled: true,
    ok: severity === "ok" || severity === "warning",
    decision,
    status: trend,
    severity,
    frameId: safeFrameId,
    entryCount: entries.length,
    entries: Object.freeze([...entries]),
    trend,
    stability,
    okFrames,
    warningFrames,
    errorFrames,
    worstRank,
    digest,
    blockedReason: "physical_write_not_allowed",
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    dryRunOnly: true
  });
}


export function buildExecutionReadinessGate({ enabled = false, healthTrend = null, healthSummary = null, sanityMonitor = null, validation = null, schedule = null, frameId = 0 } = {}) {
  if (!enabled) {
    return Object.freeze({
      version: MULTI_OUTPUT_ROUTER_VERSION,
      enabled: false,
      ok: false,
      decision: "DISABLED",
      status: "OFF",
      severity: "off",
      frameId: Number(frameId || healthTrend?.frameId || healthSummary?.frameId || 0),
      readyForLiveCandidate: false,
      readyForDryRunCommit: false,
      blockerCount: 0,
      warningCount: 0,
      blockers: Object.freeze([]),
      warnings: Object.freeze([]),
      gate: null,
      digest: "none",
      blockedReason: "execution_readiness_gate_disabled",
      physicalWriteAllowed: false,
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      dryRunOnly: true
    });
  }

  const safeFrameId = Number(frameId || healthTrend?.frameId || healthSummary?.frameId || 0);
  const blockers = [];
  const warnings = [];
  const addBlocker = (code) => { if (!blockers.includes(code)) blockers.push(code); };
  const addWarning = (code) => { if (!warnings.includes(code)) warnings.push(code); };

  const validationOk = Boolean(validation?.ok);
  const scheduleOk = Boolean(schedule?.ok);
  const sanityOk = Boolean(sanityMonitor?.ok);
  const summaryOk = Boolean(healthSummary?.ok);
  const trendOk = Boolean(healthTrend?.ok);
  const summarySeverity = String(healthSummary?.severity || "off").toLowerCase();
  const trendSeverity = String(healthTrend?.severity || "off").toLowerCase();
  const stability = String(healthTrend?.stability || "unknown").toLowerCase();
  const trend = String(healthTrend?.trend || healthTrend?.status || "OFF").toUpperCase();

  if (!validationOk) addBlocker("BATCH_VALIDATION_NOT_OK");
  if (!scheduleOk) addBlocker("SCHEDULE_NOT_OK");
  if (!sanityOk) addBlocker("SANITY_NOT_OK");
  if (!summaryOk) addBlocker("HEALTH_SUMMARY_NOT_OK");
  if (!trendOk) addBlocker("HEALTH_TREND_NOT_OK");
  if (["critical", "error"].includes(summarySeverity)) addBlocker("HEALTH_SUMMARY_SEVERITY_BLOCKS");
  if (["critical", "error"].includes(trendSeverity)) addBlocker("HEALTH_TREND_SEVERITY_BLOCKS");
  if (stability === "unstable") addBlocker("HEALTH_TREND_UNSTABLE");
  if (trend === "DEGRADING" || trend === "FLAPPING") addWarning(`TREND_${trend}`);
  if (summarySeverity === "warning" || trendSeverity === "warning" || stability === "watch") addWarning("HEALTH_WARNING_ACTIVE");

  const guardTrip = Boolean(
    healthTrend?.physicalWriteAllowed || healthTrend?.outputTouched || healthTrend?.networkTouched || healthTrend?.serialTouched ||
    healthSummary?.summary?.physicalWriteAllowed || healthSummary?.outputTouched || healthSummary?.networkTouched || healthSummary?.serialTouched ||
    sanityMonitor?.outputTouched || sanityMonitor?.networkTouched || sanityMonitor?.serialTouched ||
    validation?.outputTouched || validation?.networkTouched || validation?.serialTouched ||
    schedule?.physicalWriteAllowed || schedule?.outputTouched || schedule?.networkTouched || schedule?.serialTouched
  );
  if (guardTrip) addBlocker("DRY_RUN_GUARD_VIOLATION");

  const readyForDryRunCommit = blockers.length === 0;
  const readyForLiveCandidate = false;
  let status = readyForDryRunCommit ? "READY_DRY_RUN" : "BLOCKED";
  let severity = readyForDryRunCommit ? (warnings.length ? "warning" : "ok") : "error";
  let decision = readyForDryRunCommit ? "READINESS_OK_DRY_RUN" : "READINESS_BLOCKED";
  if (guardTrip) {
    status = "GUARD_VIOLATION";
    severity = "critical";
    decision = "READINESS_FAILED";
  } else if (readyForDryRunCommit && warnings.length) {
    status = "READY_DRY_RUN_WITH_WARNINGS";
    decision = "READINESS_WARNING_DRY_RUN";
  }

  const gate = Object.freeze({
    frameId: safeFrameId,
    status,
    severity,
    validationOk,
    scheduleOk,
    sanityOk,
    summaryOk,
    trendOk,
    trend,
    stability,
    readyForDryRunCommit,
    readyForLiveCandidate,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    blockers: Object.freeze([...blockers]),
    warnings: Object.freeze([...warnings]),
    dryRunOnly: true,
    physicalWriteAllowed: false
  });
  const digest = ["readiness", safeFrameId, status, severity, blockers.join("+") || "none", warnings.join("+") || "none", String(healthTrend?.digest || "none")].join(":");

  return Object.freeze({
    version: MULTI_OUTPUT_ROUTER_VERSION,
    enabled: true,
    ok: readyForDryRunCommit,
    decision,
    status,
    severity,
    frameId: safeFrameId,
    readyForLiveCandidate,
    readyForDryRunCommit,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    blockers: Object.freeze([...blockers]),
    warnings: Object.freeze([...warnings]),
    gate,
    digest,
    blockedReason: readyForDryRunCommit ? "physical_write_not_allowed" : (guardTrip ? "dry_run_guard_violation" : "readiness_blockers_present"),
    physicalWriteAllowed: false,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    dryRunOnly: true
  });
}

export function buildMultiOutputRoutes({ enabled = false, commitPlan = null, selectedTransports = [], registry = createTransportRegistry(), mapping = null, batchExecutionSchedulerEnabled = false, executionCommitPreviewEnabled = false, executionAuditSnapshotEnabled = false, executionAuditHistoryEnabled = false, executionAuditExportEnabled = false, executionDebugPayloadEnabled = false, executionSanityMonitorEnabled = false, executionHealthSummaryEnabled = false, executionHealthTrendEnabled = false, executionReadinessGateEnabled = false, liveExecutorPreflightEnabled = false, liveFrameMirrorValidationEnabled = false, authoritativeFrame = null, frameSource = "frame_bus", frameTimestampMs = null, targetFPS = 60, frameId = 0 } = {}) {
  if (!enabled) return createIdleMultiOutputRouter("multi_output_router_disabled");
  const planReady = Boolean(commitPlan?.commitPlanReady || commitPlan?.decision === "COMMIT_PLAN_BLOCKED");
  const packetCount = Number(commitPlan?.commitPlanPackets || commitPlan?.wouldWritePackets || 0);
  const payloadBytes = Number(commitPlan?.commitPlanPayloadBytes || commitPlan?.wouldWritePayloadBytes || 0);
  const protocols = unique((Array.isArray(selectedTransports) && selectedTransports.length ? selectedTransports : (commitPlan?.commitPlanTransports || commitPlan?.selectedTransports || [])).map(normalizeProtocol));
  const resolved = resolveTransportCapabilities({ protocols, registry, requiredCapabilities: ["rgb", "frame"], allowMock: false });
  const segmentManifest = buildSegmentRouteManifest({ mapping, selectedTransports: resolved.selected });
  const routePlan = buildRoutePlan({ segmentManifest });
  const transportBatchPlan = buildTransportBatches({ routePlan });
  const transportBatchValidation = validateTransportBatches({ transportBatchPlan, routePlan, segmentManifest });
  const batchExecutionSchedule = buildBatchExecutionSchedule({ enabled: Boolean(batchExecutionSchedulerEnabled), transportBatchPlan, validation: transportBatchValidation });
  const executionCommitPreview = buildExecutionCommitPreview({ enabled: Boolean(executionCommitPreviewEnabled), schedule: batchExecutionSchedule, frameId });
  const executionAuditSnapshot = buildExecutionAuditSnapshot({ enabled: Boolean(executionAuditSnapshotEnabled), commitPlan, segmentManifest, routePlan, transportBatchPlan, validation: transportBatchValidation, schedule: batchExecutionSchedule, commitPreview: executionCommitPreview, frameId });
  const executionAuditHistory = buildExecutionAuditHistory({ enabled: Boolean(executionAuditHistoryEnabled), auditSnapshot: executionAuditSnapshot, frameId });
  const executionAuditExport = buildExecutionAuditExport({ enabled: Boolean(executionAuditExportEnabled), auditSnapshot: executionAuditSnapshot, auditHistory: executionAuditHistory, frameId });
  const executionDebugPayload = buildExecutionDebugPayload({ enabled: Boolean(executionDebugPayloadEnabled), auditExport: executionAuditExport, frameId });
  const executionSanityMonitor = buildExecutionSanityMonitor({ enabled: Boolean(executionSanityMonitorEnabled), debugPayload: executionDebugPayload, auditExport: executionAuditExport, auditHistory: executionAuditHistory, auditSnapshot: executionAuditSnapshot, schedule: batchExecutionSchedule, validation: transportBatchValidation, frameId });
  const executionHealthSummary = buildExecutionHealthSummary({ enabled: Boolean(executionHealthSummaryEnabled), sanityMonitor: executionSanityMonitor, debugPayload: executionDebugPayload, auditExport: executionAuditExport, schedule: batchExecutionSchedule, validation: transportBatchValidation, frameId });
  const executionHealthTrend = buildExecutionHealthTrend({ enabled: Boolean(executionHealthTrendEnabled), healthSummary: executionHealthSummary, frameId });
  const executionReadinessGate = buildExecutionReadinessGate({ enabled: Boolean(executionReadinessGateEnabled), healthTrend: executionHealthTrend, healthSummary: executionHealthSummary, sanityMonitor: executionSanityMonitor, validation: transportBatchValidation, schedule: batchExecutionSchedule, frameId });
  const liveExecutorPreflight = runLiveExecutorPreflight({
    enabled: Boolean(liveExecutorPreflightEnabled),
    frame: authoritativeFrame,
    frameSource,
    frameTimestampMs,
    mapping,
    selectedTransports: protocols,
    resolved,
    registry,
    segmentManifest,
    routePlan,
    transportBatchPlan,
    validation: transportBatchValidation,
    schedule: batchExecutionSchedule,
    healthSummary: executionHealthSummary,
    healthTrend: executionHealthTrend,
    readinessGate: executionReadinessGate,
    targetFPS,
    frameId
  });
  const liveFrameMirrorValidation = buildLiveFrameMirrorValidation({
    enabled: Boolean(liveFrameMirrorValidationEnabled),
    authoritativeFrame,
    frameSource,
    frameTimestampMs,
    frameId,
    liveExecutorPreflight,
    executionCommitPreview,
    routePlan,
    transportBatchPlan
  });
  const routeCountBase = Math.max(1, packetCount || protocols.length);
  const routes = resolved.selected.map((transportId, index) => {
    const totals = segmentManifest.totalsByTransport?.[transportId] || null;
    const planTotals = routePlan.totalsByTransport?.[transportId] || null;
    return Object.freeze({
      id: `${transportId}:${index}`,
      transport: transportId,
      packets: packetCount || routeCountBase,
      payloadBytes: planTotals?.bytes || totals?.bytes || payloadBytes || 0,
      segmentCount: planTotals?.segments || totals?.segments || 0,
      pixelCount: planTotals?.pixels || totals?.pixels || 0,
      routePlanCount: planTotals?.routePlans || 0,
      packetEstimate: planTotals?.packets || packetCount || routeCountBase,
      physicalWriteAllowed: false,
      touched: false
    });
  });
  const ok = Boolean(planReady && routes.length > 0 && packetCount > 0 && payloadBytes > 0 && transportBatchValidation.ok);
  const decision = !planReady ? "WAITING_FOR_COMMIT_PLAN" : (routes.length ? (transportBatchValidation.ok ? "ROUTED_DRY_RUN" : "BATCH_VALIDATION_FAILED") : "NO_CAPABLE_TRANSPORT");
  const blockedReason = !planReady ? "commit_plan_not_ready" : (routes.length ? (transportBatchValidation.ok ? "physical_write_not_allowed" : "transport_batch_validation_failed") : resolved.reason);
  const selectedTransportIds = unique(routes.map((route) => route.transport));
  return Object.freeze({
    version: MULTI_OUTPUT_ROUTER_VERSION,
    enabled: true,
    ran: true,
    ok,
    decision,
    routeCount: routes.length,
    selectedRoutes: Object.freeze(routes),
    segmentRouteCount: segmentManifest.routeCount,
    segmentRoutes: segmentManifest.routes,
    segmentRouteDigest: segmentManifest.digest,
    routePlanCount: routePlan.routePlanCount,
    routePlans: routePlan.routePlans,
    routePlanDigest: routePlan.digest,
    routePlanPacketEstimate: routePlan.packetEstimate,
    routePlanPayloadBytes: routePlan.payloadBytes,
    transportBatchCount: transportBatchPlan.transportBatchCount,
    transportBatches: transportBatchPlan.transportBatches,
    transportBatchDigest: transportBatchPlan.digest,
    transportBatchPacketEstimate: transportBatchPlan.packetEstimate,
    transportBatchPayloadBytes: transportBatchPlan.payloadBytes,
    transportBatchValidation,
    transportBatchValidationOk: transportBatchValidation.ok,
    transportBatchValidationDecision: transportBatchValidation.decision,
    transportBatchValidationIssues: transportBatchValidation.issues,
    transportBatchValidationDigest: transportBatchValidation.digest,
    batchExecutionSchedulerEnabled: Boolean(batchExecutionSchedulerEnabled),
    batchExecutionScheduleOk: batchExecutionSchedule.ok,
    batchExecutionScheduleDecision: batchExecutionSchedule.decision,
    batchExecutionScheduleCount: batchExecutionSchedule.scheduleCount,
    batchExecutionSchedule: batchExecutionSchedule.entries,
    batchExecutionScheduleDigest: batchExecutionSchedule.digest,
    batchExecutionSchedulePacketEstimate: batchExecutionSchedule.totalPacketEstimate,
    batchExecutionSchedulePayloadBytes: batchExecutionSchedule.totalPayloadBytes,
    executionCommitPreviewEnabled: Boolean(executionCommitPreviewEnabled),
    executionCommitPreviewOk: executionCommitPreview.ok,
    executionCommitPreviewDecision: executionCommitPreview.decision,
    executionCommitPreview: executionCommitPreview.preview,
    executionCommitPreviewDigest: executionCommitPreview.digest,
    executionAuditSnapshotEnabled: Boolean(executionAuditSnapshotEnabled),
    executionAuditSnapshotOk: executionAuditSnapshot.ok,
    executionAuditSnapshotDecision: executionAuditSnapshot.decision,
    executionAuditSnapshot: executionAuditSnapshot.snapshot,
    executionAuditSnapshotDigest: executionAuditSnapshot.digest,
    executionAuditHistoryEnabled: Boolean(executionAuditHistoryEnabled),
    executionAuditHistoryOk: executionAuditHistory.ok,
    executionAuditHistoryDecision: executionAuditHistory.decision,
    executionAuditHistoryCount: executionAuditHistory.historyCount,
    executionAuditHistory: executionAuditHistory.entries,
    executionAuditHistoryDigest: executionAuditHistory.digest,
    executionAuditExportEnabled: Boolean(executionAuditExportEnabled),
    executionAuditExportOk: executionAuditExport.ok,
    executionAuditExportDecision: executionAuditExport.decision,
    executionAuditExport: executionAuditExport.payload,
    executionAuditExportSizeBytes: executionAuditExport.exportSizeBytes,
    executionAuditExportDigest: executionAuditExport.digest,
    executionDebugPayloadEnabled: Boolean(executionDebugPayloadEnabled),
    executionDebugPayloadOk: executionDebugPayload.ok,
    executionDebugPayloadDecision: executionDebugPayload.decision,
    executionDebugPayload: executionDebugPayload.payload,
    executionDebugPayloadDigest: executionDebugPayload.digest,
    executionSanityMonitorEnabled: Boolean(executionSanityMonitorEnabled),
    executionSanityMonitorOk: executionSanityMonitor.ok,
    executionSanityMonitorDecision: executionSanityMonitor.decision,
    executionSanityMonitorIssueCount: executionSanityMonitor.issueCount,
    executionSanityMonitorIssues: executionSanityMonitor.issues,
    executionSanityMonitorDigest: executionSanityMonitor.digest,
    executionHealthSummaryEnabled: Boolean(executionHealthSummaryEnabled),
    executionHealthSummaryOk: executionHealthSummary.ok,
    executionHealthSummaryDecision: executionHealthSummary.decision,
    executionHealthSummaryStatus: executionHealthSummary.status,
    executionHealthSummarySeverity: executionHealthSummary.severity,
    executionHealthSummary: executionHealthSummary.summary,
    executionHealthSummaryDigest: executionHealthSummary.digest,
    executionHealthTrendEnabled: Boolean(executionHealthTrendEnabled),
    executionHealthTrendOk: executionHealthTrend.ok,
    executionHealthTrendDecision: executionHealthTrend.decision,
    executionHealthTrendStatus: executionHealthTrend.status,
    executionHealthTrendSeverity: executionHealthTrend.severity,
    executionHealthTrend: executionHealthTrend,
    executionHealthTrendDigest: executionHealthTrend.digest,
    executionReadinessGateEnabled: Boolean(executionReadinessGateEnabled),
    executionReadinessGateOk: executionReadinessGate.ok,
    executionReadinessGateDecision: executionReadinessGate.decision,
    executionReadinessGateStatus: executionReadinessGate.status,
    executionReadinessGateSeverity: executionReadinessGate.severity,
    executionReadinessGate: executionReadinessGate,
    executionReadinessGateDigest: executionReadinessGate.digest,
    liveExecutorPreflightEnabled: Boolean(liveExecutorPreflightEnabled),
    liveExecutorPreflightOk: liveExecutorPreflight.ok,
    liveExecutorPreflightDecision: liveExecutorPreflight.decision,
    liveExecutorPreflightStatus: liveExecutorPreflight.status,
    liveExecutorPreflightSeverity: liveExecutorPreflight.severity,
    liveExecutorPreflightCanArmLive: liveExecutorPreflight.canArmLive,
    liveExecutorPreflightBlockerCount: liveExecutorPreflight.blockerCount,
    liveExecutorPreflightWarningCount: liveExecutorPreflight.warningCount,
    liveExecutorPreflight: liveExecutorPreflight,
    liveExecutorPreflightDigest: liveExecutorPreflight.digest,
    liveFrameMirrorValidationEnabled: Boolean(liveFrameMirrorValidationEnabled),
    liveFrameMirrorValidationOk: liveFrameMirrorValidation.ok,
    liveFrameMirrorValidationDecision: liveFrameMirrorValidation.decision,
    liveFrameMirrorValidationStatus: liveFrameMirrorValidation.status,
    liveFrameMirrorValidationSeverity: liveFrameMirrorValidation.severity,
    liveFrameMirrorValidation: liveFrameMirrorValidation,
    liveFrameMirrorValidationDigest: liveFrameMirrorValidation.digest,
    routeDigest: routes.length ? `${routes.length}:${packetCount}:${payloadBytes}:${selectedTransportIds.join("+")}:${segmentManifest.routeCount}` : "none",
    selectedTransports: Object.freeze(selectedTransportIds),
    blockedReason,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    dryRunOnly: true,
    safety: "11Q validates live frame mirror evidence in dry-run only; no serial/network/socket/write API is called"
  });
}
