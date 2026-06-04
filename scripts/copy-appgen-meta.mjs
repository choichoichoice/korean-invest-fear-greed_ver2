import { cp, mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const metaDir = join(root, "dist", "_appgen_meta");
const hostingConfig = join(root, ".openai", "hosting.json");
const drizzleDir = join(root, "drizzle");

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

await rm(metaDir, { force: true, recursive: true });
await mkdir(metaDir, { recursive: true });

if (await exists(hostingConfig)) {
  await cp(hostingConfig, join(metaDir, "appgarden.json"));
}

if (await exists(drizzleDir)) {
  await cp(drizzleDir, join(metaDir, "drizzle"), { recursive: true });
}
