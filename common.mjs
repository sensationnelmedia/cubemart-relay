import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

export const store = () => getStore({ name: "cubemart", consistency: "strong" });

export function safeEqual(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

export function rpcError(status, message, id = null) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message } }),
    { status, headers: { "content-type": "application/json" } });
}
