import { spawn } from "child_process";

export function runDevicePowerCommand(action) {
  const isWindows = process.platform === "win32";
  const command = isWindows ? "shutdown" : "sudo";
  const args = isWindows
    ? [action === "reboot" ? "/r" : "/s", "/t", "0"]
    : [action === "reboot" ? "reboot" : "poweroff"];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

export function parseBlxPacket(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 9) return null;
  if (buffer[0] !== 66 || buffer[1] !== 76 || buffer[2] !== 88) return null;

  const transport = buffer[3] | 0;
  const targetLen = buffer[6] | 0;
  const payloadStart = 7 + targetLen;
  if (payloadStart >= buffer.length) return null;

  if (transport === 1) return { transport: 1, targetIp: "", port: 0 };
  if (transport !== 2) return null;
  if (buffer.length < payloadStart + 2) return null;

  const targetIp = buffer.subarray(7, 7 + targetLen).toString("utf8").trim();
  const port = buffer[buffer.length - 2] | (buffer[buffer.length - 1] << 8);
  if (!targetIp || port < 1 || port > 65535) return null;
  return { transport: 2, targetIp, port };
}

export function isLocalRequest(req) {
  const ip = String(req.ip || "").replace(/^::ffff:/, "");
  return ip === "127.0.0.1" || ip === "::1";
}

export function canUseDebugApi(req, debugApiEnabled) {
  return Boolean(debugApiEnabled) && isLocalRequest(req);
}
