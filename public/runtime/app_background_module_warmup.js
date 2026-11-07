export function createAppBackgroundModuleWarmup({
  pathsForFolder,
  lists,
  moduleWarmupRef
}) {
  let queued = false;

  function scheduleBackgroundModuleWarmup() {
    if (queued) return;
    queued = true;
    const paths = [
      ...pathsForFolder("l1_anims", lists.l1Anims),
      ...pathsForFolder("l2_anims", lists.l2Anims),
      ...pathsForFolder("l1_palettes", lists.l1Palettes),
      ...pathsForFolder("l2_palettes", lists.l2Palettes)
    ];
    if (!paths.length) return;
    moduleWarmupRef()?.scheduleModuleWarmup(paths);
  }

  return {
    scheduleBackgroundModuleWarmup,
    isQueued: () => queued
  };
}
