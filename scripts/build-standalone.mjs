import { spawnSync } from "node:child_process";

const target = process.argv[2];
if (target !== "desktop" && target !== "android") {
  throw new Error("Usage: node scripts/build-standalone.mjs <desktop|android>");
}

const env = {
  ...process.env,
  VITE_STANDALONE: "true",
  VITE_PRERENDER: "true",
  VITE_API_BASE_URL:
    target === "android"
      ? (process.env.VITE_API_BASE_URL ?? "https://webosumania.com")
      : "",
};

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, ["vite", "build"], {
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
