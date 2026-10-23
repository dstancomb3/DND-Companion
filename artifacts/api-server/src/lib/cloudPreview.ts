import express, { type Express } from "express";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

const COOKIE = "__Host-dnd-preview";
const TTL = 8 * 60 * 60;
const equal = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

// Opt-in staging perimeter. Party bearer capabilities remain independent.
export function createCloudPreview(env: NodeJS.ProcessEnv = process.env, now = () => Date.now()) {
  if (env.CLOUD_PREVIEW_MODE !== undefined && env.CLOUD_PREVIEW_MODE !== "true" && env.CLOUD_PREVIEW_MODE !== "false") throw new Error("CLOUD_PREVIEW_MODE must be true or false");
  if (env.CLOUD_PREVIEW_MODE !== "true") return null;
  const username = env.PREVIEW_USERNAME || "tester", password = env.PREVIEW_PASSWORD || "", secret = env.PREVIEW_SESSION_SECRET || "";
  if (password.length < 20 || secret.length < 32) throw new Error("Cloud preview requires PREVIEW_PASSWORD (20+ characters) and PREVIEW_SESSION_SECRET (32+ characters)");
  const origin = new URL(env.CLOUD_PREVIEW_ORIGIN || env.RENDER_EXTERNAL_URL || "");
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("Cloud preview origin must be an HTTPS origin");
  const root = path.resolve(env.CLOUD_PREVIEW_WEB_ROOT || "artifacts/living-character-sheet/dist");
  if (!existsSync(path.join(root, "index.html"))) throw new Error("Cloud preview web build is missing index.html");
  const key = createHmac("sha256", secret).update(`${username}\0${password}`).digest();
  const sign = (value: string) => createHmac("sha256", key).update(value).digest("base64url");
  function validCookie(value: string) {
    const parts = value.split(".");
    if (parts.length !== 3 || parts[0] !== "v1" || !/^\d+$/.test(parts[1])) return false;
    const expiry = Number(parts[1]), seconds = Math.floor(now() / 1000);
    return expiry > seconds && expiry <= seconds + TTL && equal(parts[2], sign(`v1.${parts[1]}`));
  }
  return {
    protect(app: Express) {
      app.get("/healthz", (_req, res) => { res.json({ ok: true }); });
      app.use((req, res, next) => {
        res.setHeader("Cache-Control", "private, no-store");
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("X-Content-Type-Options", "nosniff");
        const isApi = req.path === "/api" || req.path.startsWith("/api/");
        if (isApi && ((req.get("origin") && req.get("origin") !== origin.origin) || req.get("sec-fetch-site") === "cross-site")) {
          res.status(403).json({ code: "preview_origin_required", error: "Use the preview site's own API" }); return;
        }
        const cookie = req.headers.cookie?.split(";").map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
        if (cookie && validCookie(cookie)) { next(); return; }
        const auth = req.get("authorization") || "";
        if (auth.startsWith("Basic ") && auth.length < 4096) {
          const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8"), colon = decoded.indexOf(":");
          if (colon >= 0 && equal(decoded.slice(0, colon), username) && equal(decoded.slice(colon + 1), password)) {
            const value = `v1.${Math.floor(now() / 1000) + TTL}`;
            res.setHeader("Set-Cookie", `${COOKIE}=${value}.${sign(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL}`);
            next(); return;
          }
        }
        if (!isApi) res.setHeader("WWW-Authenticate", 'Basic realm="DND private preview", charset="UTF-8"');
        res.status(401).json({ code: "preview_login_required", error: "Open or reload the preview site and sign in" });
      });
    },
    serve(app: Express) {
      // Unknown APIs must never fall through to the SPA's HTML.
      app.use("/api", (_req, res) => { res.status(404).json({ error: "API route not found" }); });
      app.use((req, res, next) => {
        try {
          if (decodeURIComponent(req.path).split("/").some(segment => segment.startsWith("."))) { res.status(404).end(); return; }
        } catch { res.status(400).end(); return; }
        next();
      });
      app.use(express.static(root, { dotfiles: "deny", etag: false }));
      app.use((req, res) => {
        if ((req.method === "GET" || req.method === "HEAD") && !path.extname(req.path) && req.accepts("html")) {
          res.sendFile(path.join(root, "index.html")); return;
        }
        res.status(404).end();
      });
    },
  };
}
