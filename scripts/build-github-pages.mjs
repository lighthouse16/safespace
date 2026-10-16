/**
 * Produce a GitHub Pages artifact for the account-free SafeSpace client.
 * Runs Next.js in a disposable, separately installed static-only project.
 * GitHub Pages cannot host Next.js API routes; omit those only in staging.
 */
import { cp, copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const stage = await mkdtemp(join(tmpdir(), "safespace-pages-"));
const artifact = resolve(root, "out");

async function run(command, args, cwd) {
  await new Promise((ok, fail) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        NEXT_PUBLIC_ENABLE_CLOUD_ACCOUNTS: "false",
        EXPORT_GH_PAGES: "false",
      },
    });
    child.on("error", fail);
    child.on("close", (code) => code === 0 ? ok() : fail(new Error(command + " exited " + code)));
  });
}

try {
  for (const file of ["package.json", "package-lock.json", "tsconfig.json", "postcss.config.mjs", "next-env.d.ts"]) {
    await copyFile(resolve(root, file), join(stage, file));
  }
  for (const directory of ["src", "public"]) {
    await cp(resolve(root, directory), join(stage, directory), { recursive: true });
  }
  const serverRoutes = join(stage, "src", "app", "api");
  if (!existsSync(serverRoutes)) throw new Error("Unexpected app structure: no API routes to exclude");
  await rm(serverRoutes, { recursive: true });

  await writeFile(join(stage, "next.config.mjs"), [
    "// Temporary guest-only static build. Never deploy server secrets here.",
    "export default {",
    "  output: 'export',",
    "  basePath: '/safespace',",
    "  trailingSlash: true,",
    "  images: { unoptimized: true },",
    "};",
    "",
  ].join("\n"));

  await run(process.platform === "win32" ? "npm.cmd" : "npm", ["ci", "--no-audit", "--no-fund"], stage);
  await run(process.execPath, [join(stage, "node_modules", "next", "dist", "bin", "next"), "build"], stage);

  const pages = join(stage, "out");
  for (const page of ["index.html", "assessments/index.html", "assessments/new/index.html", "workspace/index.html"]) {
    if (!existsSync(join(pages, page))) throw new Error("Static export missing " + page);
  }
  if (existsSync(join(pages, "api"))) throw new Error("API unexpectedly present in Pages artifact");

  await writeFile(join(pages, ".nojekyll"), "");
  await rm(artifact, { recursive: true, force: true });
  await cp(pages, artifact, { recursive: true });
  console.log("[pages] Guest-only static site is ready at out/");
} catch (error) {
  console.error("[pages] Failed:", error);
  process.exitCode = 1;
} finally {
  try { await rm(stage, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 }); }
  catch (error) { console.warn("[pages] Staging cleanup:", error.message); }
}
