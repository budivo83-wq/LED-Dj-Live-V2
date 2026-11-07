import path from "node:path";

export const assetFolderAliases = Object.freeze({
  l1_anims: "l1_anims",
  l1_palettes: "l1_palettes",
  l2_anims: "l1_anims",
  l2_palettes: "l1_palettes"
});

export const publicPaths = Object.freeze(
  new Set([
    "/login.html",
    "/login.js",
    "/login.css",
    "/appearance.js",
    "/style.css",
    "/login.png",
    "/bg.jpg",
    "/bg.png",
    "/favicon.ico"
  ])
);

export function createServerPaths(rootDir) {
  return Object.freeze({
    publicDir: path.join(rootDir, "public"),
    stateFile: path.join(rootDir, "engine-state.json"),
    runtimePrefsFile: path.join(rootDir, "data", "runtime-profile-prefs.json"),
    liveStateFile: path.join(rootDir, "data", "live-state.json"),
    liveAuditFile: path.join(rootDir, "data", "live-audit-log.json"),
    authFile: path.join(rootDir, "auth.json"),
    animationLibraryFile: path.join(rootDir, "data", "animation-library.json")
  });
}
