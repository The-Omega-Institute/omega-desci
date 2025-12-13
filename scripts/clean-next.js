const fs = require("fs");
const path = require("path");

const target = path.join(process.cwd(), ".next");

try {
  fs.rmSync(target, { recursive: true, force: true });
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.warn(`[clean-next] Failed to remove .next via fs.rmSync: ${message}`);
}

