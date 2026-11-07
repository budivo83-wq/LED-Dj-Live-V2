export function fillMetadataFormFields(item, refs) {
  const {
    metaNameInput,
    metaDescriptionInput,
    metaKindInput,
    metaOriginInput,
    metaTagsInput,
    metaParamsInput,
    saveMetadataBtn,
    resetMetadataBtn,
    metadataStatus
  } = refs;

  const disabled = !item || item.id === "__editor_preview";
  const tags = (item?.tags || []).filter((tag) => !["l1", "l2"].includes(String(tag).toLowerCase()) && !["L1", "L2"].includes(String(tag)));
  metaNameInput.value = item?.name || "";
  metaDescriptionInput.value = item?.description || "";
  metaKindInput.value = item?.kind || "";
  metaOriginInput.value = item?.origin || "";
  metaTagsInput.value = tags.join(", ");
  metaParamsInput.value = Array.isArray(item?.params) ? item.params.join(", ") : "";
  [metaNameInput, metaDescriptionInput, metaKindInput, metaOriginInput, metaTagsInput, metaParamsInput, saveMetadataBtn, resetMetadataBtn]
    .forEach((el) => { if (el) el.disabled = disabled; });
  metadataStatus.textContent = disabled ? "save first" : "ready";
}

export function buildMetadataPayload(selectedId, refs, normalizeTags) {
  return {
    id: selectedId,
    name: refs.metaNameInput.value,
    description: refs.metaDescriptionInput.value,
    kind: refs.metaKindInput.value,
    origin: refs.metaOriginInput.value,
    tags: normalizeTags(refs.metaTagsInput.value),
    params: String(refs.metaParamsInput.value || "").split(",").map((param) => param.trim()).filter(Boolean)
  };
}
