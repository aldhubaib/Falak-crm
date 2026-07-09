import { writeFileSync, readFileSync } from "fs";
import { createHash } from "crypto";

const template = readFileSync("public/sw.template.js", "utf-8");
const buildId = createHash("md5")
  .update(Date.now().toString() + Math.random().toString())
  .digest("hex")
  .slice(0, 8);

const output = template
  .replace("__BUILD_ID__", buildId)
  // Empty key disables the SW's push re-subscribe handler (guarded in the
  // template by startsWith("__") / empty check).
  .replace('"__VAPID_PUBLIC_KEY__"', JSON.stringify(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""));
writeFileSync("public/sw.js", output);
console.log(`Generated sw.js with build ID: ${buildId}`);
