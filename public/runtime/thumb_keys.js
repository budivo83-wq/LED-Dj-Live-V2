export function thumbCacheKeyForTask(task) {
  if (!task) return "";
  const sourcePath = String(task.sourcePath || "").trim();
  if (task.kind === "palette") return `palette:${sourcePath || `${task.folder}/${task.file}`}`;
  return `anim:${sourcePath || `${task.folder}/${task.file}`}`;
}
