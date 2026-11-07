const FATAL_REASONS = new Set(["uncaughtException", "unhandledRejection"]);

export function createShutdownController({
  closeResources = [],
  closeClients = () => {},
  forceTimeoutMs = 4000,
  logger = console,
  processRef = process
} = {}) {
  let shuttingDown = false;
  let shutdownForceTimer = null;

  attachProcessHandlers(processRef, shutdown, logger);

  async function shutdown(reason = "unknown") {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.log(`Shutdown (${reason})...`);
    const fatalReason = FATAL_REASONS.has(reason);

    shutdownForceTimer = setTimeout(() => {
      processRef.exit(1);
    }, forceTimeoutMs);
    shutdownForceTimer.unref?.();

    try {
      closeClients();
    } catch {}

    const results = await Promise.allSettled(closeResources.map((resource) => resource.close()));
    results.forEach((result, index) => {
      const name = closeResources[index]?.name || `resource:${index}`;
      if (result.status === "rejected") logger.warn(`Shutdown cleanup failed: ${name}`, result.reason);
      else logger.log(`Shutdown cleanup ok: ${name}`);
    });

    if (shutdownForceTimer) {
      clearTimeout(shutdownForceTimer);
      shutdownForceTimer = null;
    }
    processRef.exit(fatalReason ? 1 : 0);
  }

  return {
    shutdown,
    isShuttingDown: () => shuttingDown
  };
}

function attachProcessHandlers(processRef, shutdown, logger) {
  processRef.on("SIGINT", () => {
    shutdown("SIGINT");
  });

  processRef.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });

  processRef.on("SIGBREAK", () => {
    shutdown("SIGBREAK");
  });

  processRef.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection:", reason);
    shutdown("unhandledRejection");
  });

  processRef.on("uncaughtException", (error) => {
    logger.error("Uncaught exception:", error);
    shutdown("uncaughtException");
  });
}
