import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = readFileSync(join(root, "public", "runtime", "render_pipeline.js"), "utf8");

const failures = [];

function expect(pattern, note) {
  if (!pattern.test(source)) failures.push(note);
}

expect(/let previewBudgetPressureUntil = 0;/, "preview budget pressure state should exist");
expect(/function isPreviewBudgetUnderPressure\(now = performance\.now\(\)\)/, "preview budget pressure helper should exist");
expect(/function armPreviewBudgetPressure\(now, previewFrameMs, previewDrawMs, renderMs\)/, "preview budget pressure arm helper should exist");
expect(/const previewBudgetPressured = isPreviewBudgetUnderPressure\(now\);/, "draw loop should sample the preview pressure state");
expect(/\|\| \(previewBudgetPressured && previewMode !== "pixel"\);/, "non-pixel center previews should skip blits under pressure while pixel preview remains visible");
expect(/const shellRawPreviewAllowed = \(\!previewBudgetPressured\)/, "raw preview should stop during preview pressure");
expect(/schedulerDebugState\.previewBudgetPressureUntil = Math\.max\(0, Math\.round\(previewBudgetPressureUntil\)\);/, "scheduler debug state should expose the pressure deadline");

if (failures.length) {
  console.error("Preview budget pressure contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Preview budget pressure contract passed.");
