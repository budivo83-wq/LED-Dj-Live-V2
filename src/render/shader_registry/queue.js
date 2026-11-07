/**
 * Compile queue skeleton with bounded warmup batches.
 */
export function createShaderCompileQueue(batchSize = 4) {
  const maxBatch = Math.max(1, Number(batchSize) || 4);
  const queue = [];

  return {
    enqueue(task) {
      queue.push(task);
    },
    drainBatch(runTask) {
      const count = Math.min(maxBatch, queue.length);
      for (let i = 0; i < count; i += 1) {
        const task = queue.shift();
        runTask(task);
      }
      return count;
    },
    size() {
      return queue.length;
    },
    clear() {
      queue.length = 0;
    }
  };
}
