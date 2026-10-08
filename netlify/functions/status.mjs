// GET /status — on/off and since when. No secrets, no tunnel address.
import { store } from "../lib/common.mjs";

export default async () => {
  const t = await store().get("tunnel", { type: "json" });
  let reachable = false;
  if (t && t.url) {
    try { const r = await fetch(`${t.url}/mcp/${process.env.PC_SECRET}`, { signal: AbortSignal.timeout(5000) }); reachable = r.status < 500; } catch {}
  }
  return Response.json({ on: !!(t && t.url), reachable, since: t ? t.at : null });
};

export const config = { path: "/status" };
