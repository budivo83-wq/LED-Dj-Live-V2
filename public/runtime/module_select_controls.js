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
      files: moduleKey === "anim" ? lists?.[`${layer}Anims`] : lists?.[`${layer}Palettes`]
    });
  });
}
