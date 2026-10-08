// POST /register  {url: "https://xxx.trycloudflare.com"}  or  {url: null} to mark OFF.
// Only the work PC knows REGISTER_TOKEN (stored DPAPI-encrypted there).
import { store, safeEqual } from "../lib/common.mjs";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!safeEqual(req.headers.get("x-register-token"), process.env.REGISTER_TOKEN)) return new Response("Forbidden", { status: 403 });
  let url;
  try { ({ url } = await req.json()); } catch { return new Response("Bad JSON", { status: 400 }); }
  if (url !== null && !/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(String(url))) return new Response("Bad tunnel URL", { status: 400 });
  await store().setJSON("tunnel", { url, at: new Date().toISOString() });
  return Response.json({ ok: true, on: url !== null });
};

export const config = { path: "/register" };
