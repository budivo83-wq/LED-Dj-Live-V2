function resolveFullscreenDocument(documentRef) {
  try {
    const topDocument = window?.top?.document;
    if (topDocument?.documentElement) return topDocument;
  } catch {
    // Ignore cross-origin or denied access.
  }
  return documentRef;
}

export async function toggleFullscreenRuntime(documentRef) {
  const fullscreenDocument = resolveFullscreenDocument(documentRef);
  try {
    if (fullscreenDocument.fullscreenElement) {
      await fullscreenDocument.exitFullscreen();
      return;
    }
    await fullscreenDocument.documentElement.requestFullscreen();
  } catch (error) {
    console.warn("Fullscreen toggle failed", error);
  }
}

export function toggleCenterMenuRuntime(centerMenuStrip) {
  centerMenuStrip?.classList.toggle("open");
}

export function handleOutsideMenuClickRuntime(event, centerMenuStrip) {
  if (!centerMenuStrip?.classList.contains("open")) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest("#centerMenuStrip") || target.closest("#menuBtn")) return;
  centerMenuStrip.classList.remove("open");
}
