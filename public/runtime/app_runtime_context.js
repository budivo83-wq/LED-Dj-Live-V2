export function readAppRuntimeContext({ locationRef, windowRef }) {
  const params = new URLSearchParams(locationRef.search || "");
  const headless = params.get("headless") === "1";
  const safeBoot = params.get("safeBoot") === "1";

  // STEP 13K:
  // When index.html is opened inside shell.html as the visible UI iframe, it must
  // behave as shell-view immediately, even if the iframe URL was reached through
  // an old hard-coded link like "index.html" without "?shellView=1".
  //
  // The previous implementation called location.replace("?shellView=1") and then
  // returned shellViewOnly=false for the current execution pass. That allowed the
  // normal Performance runtime to continue booting for a short moment, including
  // serial/output ownership, and then the iframe reloaded. Visible symptoms:
  // - Performance page briefly flashed between two layouts/styles.
  // - Serial/output could be initialized for a moment while switching back to
  //   Performance, causing a short output dropout.
  //
  // This version derives shellViewOnly from the embedding context itself and does
  // not force a reload. The hidden headless runner remains the only iframe allowed
  // to own output.
  const embedded = Boolean(windowRef?.top && windowRef.top !== windowRef);
  const explicitShellView = params.get("shellView") === "1";
  const shellViewOnly = !headless && (explicitShellView || embedded);

  return {
    headless,
    shellViewOnly,
    safeBoot
  };
}
