import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npx.cmd" : "npx";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: isWindows,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(path.join(root, "android"))) {
  run(npmCommand, ["cap", "add", "android"]);
}

run("npm", ["run", "android:sync"]);

const gradleCommand = isWindows ? "gradlew.bat" : "./gradlew";
const gradleArgs = ["assembleDebug"];
const gradle = spawnSync(gradleCommand, gradleArgs, {
  cwd: path.join(root, "android"),
  stdio: "inherit",
  shell: isWindows,
});

if (gradle.error) throw gradle.error;
process.exit(gradle.status ?? 1);
