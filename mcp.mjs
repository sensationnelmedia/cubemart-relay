// /mcp/<CONNECTOR_SECRET>  ->  <tunnel>/mcp/<PC_SECRET>
// The connector URL in claude.ai never changes; the tunnel address is whatever Cube Mart ON registered last.
// When Cube Mart is OFF, the relay answers by itself (cached initialize / tools list, and a clear "turn it on" tool result),
// so Claude tells the user what to do instead of showing a connector error.
import { store, safeEqual, rpcError } from "../lib/common.mjs";

const OFF_MSG = "Cube Mart is OFF right now. Tell the user: double-click 'Cube Mart ON' on the work PC (admin password), wait for the 'Cube Mart is ON' popup, then ask again. Do not answer from memory or estimate numbers.";
const FWD_REQ = ["content-type", "accept", "mcp-protocol-version", "mcp-session-id", "last-event-id"];
const FWD_RES = ["content-type", "mcp-session-id", "mcp-protocol-version"];
const CACHE = { initialize: "cache_initialize", "tools/list": "cache_tools_list" };

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

async function answerWhileOff(msg) {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return rpcError(503, OFF_MSG);
  if (msg.id === undefined) return new Response(null, { status: 202 });                 // notification
  if (CACHE[msg.method]) {
    const cached = await store().get(CACHE[msg.method], { type: "json" });
    if (cached && cached.result) return json({ jsonrpc: "2.0", id: msg.id, result: cached.result });
  }
  if (msg.method === "tools/call") return json({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: OFF_MSG }], isError: true } });
  if (msg.method === "ping") return json({ jsonrpc: "2.0", id: msg.id, result: {} });
  return rpcError(503, OFF_MSG, msg.id);
}

export default async (req, context) => {
  if (!safeEqual(context.params.key, process.env.CONNECTOR_SECRET)) return new Response("Not found", { status: 404 });

  const body = ["GET", "HEAD", "DELETE"].includes(req.method) ? undefined : await req.text();
  let msg = null;
  try { msg = body ? JSON.parse(body) : null; } catch { /* non-JSON */ }

  const t = await store().get("tunnel", { type: "json" });
  if (!t || !t.url) return req.method === "POST" ? answerWhileOff(msg) : new Response("Cube Mart is off", { status: 405 });

  const headers = {};
  for (const h of FWD_REQ) { const v = req.headers.get(h); if (v) headers[h] = v; }

  let upstream;
  try {
    upstream = await fetch(`${t.url}/mcp/${process.env.PC_SECRET}`, { method: req.method, headers, body, signal: AbortSignal.timeout(9500) });
  } catch (e) {
    const timeout = e && (e.name === "TimeoutError" || e.name === "AbortError");
    if (timeout) return rpcError(504, "Cube Mart query took too long; aggregate or narrow the window and try again.", msg && msg.id);
    return req.method === "POST" ? answerWhileOff(msg) : new Response("Cube Mart is off", { status: 503 });
  }
  const buf = await upstream.arrayBuffer();
  if (upstream.ok && msg && CACHE[msg.method]) {                                       // remember for OFF periods
    try { const r = JSON.parse(Buffer.from(buf).toString("utf8")); if (r.result) await store().setJSON(CACHE[msg.method], { result: r.result }); } catch {}
  }
  const out = new Headers();
  for (const h of FWD_RES) { const v = upstream.headers.get(h); if (v) out.set(h, v); }
  return new Response(buf, { status: upstream.status, headers: out });
};

export const config = { path: "/mcp/:key" };
