import { createTelemetryCollector } from './telemetry/collector.js';

export function createDebugEngine() {
  const telemetry = createTelemetryCollector();

  return {
    telemetry,
    getHealthSnapshot() {
      return telemetry.snapshot();
    }
  };
}
