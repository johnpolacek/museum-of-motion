import { readFileSync } from "node:fs";
import { join } from "node:path";

// The motion brief, served as plain text at /MOTION.md so the article can link to it.
export const dynamic = "force-static";

export function GET() {
  const brief = readFileSync(join(process.cwd(), "MOTION.md"), "utf8");
  return new Response(brief, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
