import fs from "fs";
import path from "path";

export const LIVE_AUDIT_LOG_VERSION = "12G-live-safety-audit-log";
const DEFAULT_MAX_ENTRIES = 200;

function sanitize(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function compactPayload(payload = {}) {
  const source = sanitize(payload);
  delete source.token;
  delete source.fullLiveToken;
  delete source.armToken;
  if (source.tokenGate?.token) source.tokenGate.token = "[redacted]";
  return source;
}

export function createLiveAuditLog({ auditFile, now = () => Date.now(), maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
  if (!auditFile) throw new Error("live audit log requires auditFile");

  function loadEntries() {
    try {
      const parsed = JSON.parse(fs.readFileSync(auditFile, "utf8"));
      return Array.isArray(parsed.entries) ? parsed.entries : [];
    } catch {
      return [];
    }
  }

  function persist(entries) {
    fs.mkdirSync(path.dirname(auditFile), { recursive: true });
    fs.writeFileSync(auditFile, JSON.stringify({
      version: LIVE_AUDIT_LOG_VERSION,
      entries: entries.slice(-Math.max(1, Number(maxEntries || DEFAULT_MAX_ENTRIES)))
    }, null, 2));
  }

  function append(action, payload = {}) {
    const entries = loadEntries();
    const entry = Object.freeze({
      version: LIVE_AUDIT_LOG_VERSION,
      id: `${now()}-${entries.length + 1}`,
      at: now(),
      action: String(action || "unknown"),
      payload: compactPayload(payload),
      physicalWriteAllowed: false
    });
    entries.push(entry);
    persist(entries);
    return entry;
  }

  function read({ limit = 50 } = {}) {
    const safeLimit = Math.max(1, Math.min(500, Number(limit || 50)));
    return Object.freeze({
      version: LIVE_AUDIT_LOG_VERSION,
      entries: Object.freeze(loadEntries().slice(-safeLimit)),
      physicalWriteAllowed: false
    });
  }

  function clear(reason = "operator_clear_audit") {
    persist([]);
    return append("audit.clear", { reason });
  }

  return Object.freeze({
    version: LIVE_AUDIT_LOG_VERSION,
    append,
    read,
    clear
  });
}
