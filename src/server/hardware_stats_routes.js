import os from "os";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

let lastCpuSample = sampleCpu();

function sampleCpu() {
  const cpus = os.cpus?.() || [];
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    const times = cpu.times || {};
    idle += Number(times.idle || 0);
    total +=
      Number(times.user || 0) +
      Number(times.nice || 0) +
      Number(times.sys || 0) +
      Number(times.irq || 0) +
      Number(times.idle || 0);
  }
  return { idle, total };
}

function cpuPercent() {
  const next = sampleCpu();
  const idleDelta = next.idle - lastCpuSample.idle;
  const totalDelta = next.total - lastCpuSample.total;
  lastCpuSample = next;
  if (!Number.isFinite(totalDelta) || totalDelta <= 0) return 0;
  const busy = 1 - idleDelta / totalDelta;
  return Math.max(0, Math.min(100, Math.round(busy * 100)));
}

function normalizeTempValue(rawValue) {
  const value = Number(String(rawValue).trim());
  if (!Number.isFinite(value)) return null;

  // Linux thermal sysfs normally reports millidegrees Celsius, e.g. 45234 = 45.234 C.
  // Some hwmon entries can report plain Celsius. Support both, but reject impossible 0 fallback.
  const celsius = Math.abs(value) > 1000 ? value / 1000 : value;
  if (!Number.isFinite(celsius)) return null;
  if (celsius <= 0 || celsius > 125) return null;

  return Math.round(celsius * 10) / 10;
}

function readFileTemp(file, source) {
  try {
    const raw = fs.readFileSync(file, "utf8").trim();
    const tempC = normalizeTempValue(raw);
    if (tempC == null) return null;
    return { tempC, source, raw };
  } catch {
    return null;
  }
}

function readThermalZoneTemp() {
  const base = "/sys/class/thermal";
  try {
    const entries = fs.readdirSync(base)
      .filter((name) => /^thermal_zone\d+$/.test(name))
      .sort((a, b) => Number(a.replace("thermal_zone", "")) - Number(b.replace("thermal_zone", "")));

    const zones = entries.map((name) => {
      const dir = path.join(base, name);
      let type = "unknown";
      try {
        type = fs.readFileSync(path.join(dir, "type"), "utf8").trim();
      } catch {
        // optional
      }
      return { name, type, tempFile: path.join(dir, "temp") };
    });

    const preferred = zones.find((z) => /cpu|soc|bcm|thermal/i.test(z.type)) || zones[0];
    if (!preferred) return null;
    return readFileTemp(preferred.tempFile, `${preferred.name}:${preferred.type}`);
  } catch {
    return null;
  }
}

function readHwmonTemp() {
  const base = "/sys/class/hwmon";
  try {
    const hwmons = fs.readdirSync(base).sort();
    for (const hwmon of hwmons) {
      const dir = path.join(base, hwmon);
      let name = hwmon;
      try {
        name = fs.readFileSync(path.join(dir, "name"), "utf8").trim();
      } catch {
        // optional
      }
      const files = fs.readdirSync(dir).filter((file) => /^temp\d+_input$/.test(file)).sort();
      for (const file of files) {
        const result = readFileTemp(path.join(dir, file), `${hwmon}:${name}:${file}`);
        if (result) return result;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function readVcgencmdTemp() {
  try {
    const out = execFileSync("vcgencmd", ["measure_temp"], {
      encoding: "utf8",
      timeout: 500,
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    const match = out.match(/temp=([0-9.]+)'?C/i);
    const tempC = match ? normalizeTempValue(match[1]) : null;
    if (tempC == null) return null;
    return { tempC, source: "vcgencmd", raw: out };
  } catch {
    return null;
  }
}

function readTemperature() {
  return readThermalZoneTemp() || readHwmonTemp() || readVcgencmdTemp() || null;
}

function formatUptime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds || 0)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function registerHardwareStatsRoutes(app, { runtimeProfile } = {}) {
  const cacheMs = Math.max(500, Number(runtimeProfile?.hardwareStatsCacheMs || (runtimeProfile?.raspi ? 2500 : 1200)));
  let cached = null;
  let cachedAt = 0;

  function buildStats() {
    const totalMem = os.totalmem?.() || 0;
    const freeMem = os.freemem?.() || 0;
    const usedMem = Math.max(0, totalMem - freeMem);
    const memPercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;
    const load = os.loadavg?.() || [0, 0, 0];
    const cores = os.cpus?.().length || 1;
    const temperature = readTemperature();

    return {
      ok: true,
      raspi: runtimeProfile?.raspi === true,
      cached: false,
      cacheMs,
      cpuPercent: cpuPercent(),
      memPercent,
      totalMemMb: Math.round(totalMem / 1024 / 1024),
      freeMemMb: Math.round(freeMem / 1024 / 1024),
      load1: Math.round(Number(load[0] || 0) * 100) / 100,
      load5: Math.round(Number(load[1] || 0) * 100) / 100,
      cores,
      tempC: temperature?.tempC ?? null,
      tempSource: temperature?.source ?? null,
      tempRaw: temperature?.raw ?? null,
      tempAvailable: temperature?.tempC != null,
      uptime: formatUptime(os.uptime?.() || process.uptime()),
      platform: os.platform?.() || "unknown",
      arch: os.arch?.() || "unknown",
      sampledAt: Date.now()
    };
  }

  app.get("/api/hardware-stats", (_req, res) => {
    const now = Date.now();
    if (cached && now - cachedAt < cacheMs) {
      res.json({ ...cached, cached: true, ageMs: now - cachedAt });
      return;
    }

    cached = buildStats();
    cachedAt = now;
    res.json({ ...cached, ageMs: 0 });
  });
}
