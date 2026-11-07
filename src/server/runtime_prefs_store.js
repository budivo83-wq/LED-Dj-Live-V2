import fs from "fs";
import path from "path";

export function createRuntimePrefsStore({ runtimePrefsFile }) {
  function read() {
    try {
      if (!fs.existsSync(runtimePrefsFile)) return {};
      const parsed = JSON.parse(fs.readFileSync(runtimePrefsFile, "utf8"));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      console.warn("[runtime] failed to read runtime prefs", error?.message || error);
      return {};
    }
  }

  function write(prefs) {
    try {
      fs.mkdirSync(path.dirname(runtimePrefsFile), { recursive: true });
      fs.writeFileSync(runtimePrefsFile, JSON.stringify({
        ...prefs,
        savedAt: new Date().toISOString()
      }, null, 2));
      return true;
    } catch (error) {
      console.warn("[runtime] failed to write runtime prefs", error?.message || error);
      return false;
    }
  }

  return { read, write };
}
