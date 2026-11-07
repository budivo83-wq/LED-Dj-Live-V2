const OUTPUT_BUS_NAME = "led-engine-output-bus-v1";

function createStorageFallback(sourceId) {
  return {
    post(message) {
      try {
        localStorage.setItem(
          OUTPUT_BUS_NAME,
          JSON.stringify({ sourceId, message, at: Date.now() })
        );
      } catch {
        // ignore storage failures
      }
    },
    subscribe(handler) {
      const onStorage = (event) => {
        if (event.key !== OUTPUT_BUS_NAME || !event.newValue) return;
        try {
          const parsed = JSON.parse(event.newValue);
          if (!parsed || parsed.sourceId === sourceId) return;
          handler(parsed.message);
        } catch {
          // ignore malformed messages
        }
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
    close() {}
  };
}

export function createOutputBus() {
  if (typeof window === "undefined") return null;
  const sourceId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(OUTPUT_BUS_NAME);
    return {
      post(message) {
        channel.postMessage({ sourceId, message, at: Date.now() });
      },
      subscribe(handler) {
        const onMessage = (event) => {
          const payload = event?.data;
          if (!payload || payload.sourceId === sourceId) return;
          handler(payload.message);
        };
        channel.addEventListener("message", onMessage);
        return () => channel.removeEventListener("message", onMessage);
      },
      close() {
        try {
          channel.close();
        } catch {
          // ignore channel close failures
        }
      }
    };
  }

  return createStorageFallback(sourceId);
}
