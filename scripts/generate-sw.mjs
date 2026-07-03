import { writeFileSync, readFileSync } from "fs";
import { createHash } from "crypto";

const template = readFileSync("public/sw.template.js", "utf-8");
const buildId = createHash("md5")
  .update(Date.now().toString() + Math.random().toString())
  .digest("hex")
  .slice(0, 8);

const output = template.replace("__BUILD_ID__", buildId);
writeFileSync("public/sw.js", output);
console.log(`Generated sw.js with build ID: ${buildId}`);
