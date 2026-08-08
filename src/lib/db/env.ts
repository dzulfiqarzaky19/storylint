// Minimal .env.local loader for standalone scripts (reset/seed) run via tsx.
// No dotenv dependency: parse the file ourselves. Under Next this is unused
// because process.env.DATABASE_URL is already populated.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnv(): void {
  if (process.env.DATABASE_URL) return;
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
      }
    } catch {
      // file missing; try the next one
    }
  }
}
