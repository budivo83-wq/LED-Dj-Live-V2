import crypto from "crypto";
import fs from "fs";

export function createAuthController({ authFile, logger = console } = {}) {
  const sessions = new Set();

  function login(username, password) {
    const user = String(username || "").trim();
    const pass = String(password || "").trim();
    if (!user || !pass || !checkCredentials(user, pass)) return "";

    const token = crypto.randomBytes(24).toString("hex");
    sessions.add(token);
    return token;
  }

  function logout(req) {
    const token = cookie(req, "led_session");
    if (token) sessions.delete(token);
  }

  function isAuthenticated(req) {
    const cookies = parseCookies(req);
    return sessions.has(cookies.led_session);
  }

  function changePassword(oldPassword, newPassword, repeatPassword) {
    const oldPass = String(oldPassword || "");
    const newPass = String(newPassword || "");
    const repeatPass = String(repeatPassword || "");
    const auth = loadAuth();
    if (!checkCredentials(auth.username, oldPass) || newPass.length < 4 || newPass !== repeatPass) return false;
    saveAuth(auth.username, newPass);
    return true;
  }

  function loadAuth() {
    try {
      const auth = JSON.parse(fs.readFileSync(authFile, "utf8"));
      if (typeof auth?.username !== "string" || !auth.username.trim()) {
        const migrated = { username: "admin", salt: auth.salt, hash: auth.hash };
        fs.writeFileSync(authFile, JSON.stringify(migrated, null, 2));
        return migrated;
      }
      return auth;
    } catch {
      saveAuth("admin", "vojtech-");
      return JSON.parse(fs.readFileSync(authFile, "utf8"));
    }
  }

  function saveAuth(username, password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = hashPassword(password, salt);
    fs.writeFileSync(authFile, JSON.stringify({ username, salt, hash }, null, 2));
  }

  function checkCredentials(username, password) {
    if (!String(password || "").trim()) return false;
    const auth = loadAuth();
    if (String(username || "").trim() !== String(auth.username || "").trim()) return false;
    const expected = Buffer.from(auth.hash, "hex");
    const actual = Buffer.from(hashPassword(password, auth.salt), "hex");
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  function hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 32).toString("hex");
  }

  function cookie(req, name) {
    const cookies = parseCookies(req);
    return cookies[name] || "";
  }

  function parseCookies(req) {
    return Object.fromEntries(
      String(req.headers.cookie || "")
        .split(";")
        .map((entry) => entry.trim().split("="))
        .filter((parts) => parts.length === 2)
    );
  }

  return {
    login,
    logout,
    isAuthenticated,
    changePassword
  };
}
