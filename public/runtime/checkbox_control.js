export function bindCheckboxControl({ byId, commitState }, id, target, key) {
  const input = byId?.(id);
  if (!input) return;

  input.addEventListener("change", (event) => {
    target[key] = event.target.checked;
    commitState?.();
  });
}
