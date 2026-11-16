export function bindModuleSelectControl({
  select,
  layer,
  stateKey,
  folder,
  moduleKey,
  lists,
  switchLayerModule
}) {
  if (!select || typeof select.addEventListener !== "function") return;
  if (typeof switchLayerModule !== "function") return;

  select.addEventListener("change", async (event) => {
    const file = event.target.value;
    await switchLayerModule(layer, stateKey, folder, moduleKey, file, {
      files: moduleKey === "anim" ? lists?.[`${layer}Anims`] : lists?.[`${layer}Palettes`],
      // Keep direct dropdown changes responsive; startup warmup already covers
      // the initial scene and speculative post-switch compiles can hitch later.
      warmup: false
    });
  });
}
