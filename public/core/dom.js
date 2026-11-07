// Shared DOM helpers for controls and pickers.
// Keeping these small utilities outside app.js makes the main runtime easier to scan.

export function byId(id) {
  return document.getElementById(id);
}

export function option(value, label) {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  return element;
}

export function setSelectValue(select, value) {
  if (!select) return;
  if (value && [...select.options].some((entry) => entry.value === value)) {
    select.value = value;
  }
}

export function cleanModuleName(file) {
  return String(file || "").replace(/\.js$/i, "").replace(/_/g, " ").toUpperCase();
}

export function blendModeLabel(mode) {
  return String(mode || "")
    .replace(/([A-Z])/g, " $1")
    .replace(/^max$/i, "MAX")
    .toUpperCase();
}
