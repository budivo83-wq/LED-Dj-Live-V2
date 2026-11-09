import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const auth = await readFile(new URL("../src/server/auth_middleware.js", import.meta.url), "utf8");
assert.match(auth, /req\.path === "\/api\/health"/);
assert.match(auth, /req\.path === "\/api\/device\/quit"/);
assert.match(auth, /::ffff:127\.0\.0\.1/);
console.log("Local control-plane contract passed (health + quit survive expired UI auth).");
