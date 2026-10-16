/**
 * Generate a GitHub Pages artifact for SafeSpace's account-free guest workflow.
 *
 * Keeps the full-stack source tree untouched. GitHub Pages cannot run API route
 * handlers, so the disposable staged build intentionally omits /app/api.
 * NEVER use this artifact to claim Supabase/cloud/Gemini API functionality.
 *
 * Usage: npm run build:pages
 */
import { cp, copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const stage = await mkdtemp(join(tmpdir(), "safespace-pages-"));
const exportDir = resolve(root, "out");
const files = ["package.json", "package-lock.json", "tsconfig.json", "postcss.config.mjs", "next-env.d.ts"];
const folders = ["src", "public"];

async function command(cmd, args, cwd, env = {}) {
  console.log("[pages] Running:", cmd, args.join(" "), "in", cwd);
  await new Promise((done, fail) => {
    const isWin = process.platform === "win32";
    const isShellCmd = isWin && (cmd.endsWith(".cmd") || cmd.endsWith(".bat"));
    const p = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: isShellCmd,
      env: { ...process.env, ...env, NEXT_PUBLIC_ENABLE_CLOUD_ACCOUNTS: "false", EXPORT_GH_PAGES: "false" }
    });
    p.on("error", fail);
    p.on("close", (code) => code === 0 ? done() : fail(new Error(cmd + " failed (" + code + ")")));
  });
}

try {
  for (const filename of files) await copyFile(resolve(root, filename), join(stage, filename));
  for (const folder of folders) await cp(resolve(root, folder), join(stage, folder), { recursive: true });

  const api = join(stage, "src", "app", "api");
  if (!existsSync(api)) throw new Error("Expected server API routes not found; refusing unverified staging layout");
  await rm(api, { recursive: true });

  await writeFile(join(stage, "next.config.mjs"), [
    "// ONLY for the disposable GitHub Pages guest static build.",
    "export default {",
    '  output: "export",',
    '  basePath: "/safespace",',
    "  trailingSlash: true,",
    "  images: { unoptimized: true },",
    "};",
    ""
  ].join("\n"));

  // npm ci in a detached directory avoids junction-based Turbopack root failures.
  await command(process.platform === "win32" ? "npm.cmd" : "npm", ["ci", "--no-audit", "--no-fund"], stage);
  await command(process.execPath, [join(stage, "node_modules", "next", "dist", "bin", "next"), "build"], stage);

  const builtDir = join(stage, "out");
  for (const page of ["index.html", "assessments/index.html", "assessments/new/index.html", "workspace/index.html"]) {
    if (!existsSync(join(builtDir, page))) {
      throw new Error("Missing Pages export route: " + page);
    }
  }
  if (existsSync(join(builtDir, "api"))) {
    throw new Error("Server API unexpectedly included in static Pages artifact");
  }
  await writeFile(join(builtDir, ".nojekyll"), "");
  await rm(exportDir, { recursive: true, force: true });
  await cp(builtDir, exportDir, { recursive: true });
  console.log("[pages] Generated guest-only Pages artifact:", exportDir);
  console.log("[pages] Excludes server API routes. Cloud account services are unavailable on Pages.");
} catch (error) {
  console.error("[pages] Static export failed:", error);
  process.exitCode = 1;
} finally {
  try { await rm(stage, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 }); }
  catch (error) { console.warn("[pages] Could not clean temp staging:", error.message); }
}
