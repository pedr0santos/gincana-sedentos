import type { Express } from "express";
import { getProfileById } from "../db";
import { createContext } from "./context";
import { storageGetSignedUrl } from "../storage";
import { ENV } from "./env";

export function registerStorageProxy(app: Express) {
  app.get("/api/media/avatar/:participantId", async (req, res) => {
    const context = await createContext({ req, res } as any);
    if (!context.user) {
      res.status(401).send("Authentication required");
      return;
    }
    const participantId = Number(req.params.participantId);
    if (!Number.isInteger(participantId) || participantId <= 0) {
      res.status(400).send("Invalid participant");
      return;
    }
    const profile = await getProfileById(participantId);
    if (!profile || (profile.userId !== context.user.id && context.user.role !== "admin")) {
      res.status(404).send("Media not found");
      return;
    }
    if (!profile.avatarKey) {
      res.status(404).send("Avatar not found");
      return;
    }
    try {
      const signedUrl = await storageGetSignedUrl(profile.avatarKey);
      res.set("Cache-Control", "private, no-store");
      res.redirect(307, signedUrl);
    } catch {
      res.status(502).send("Storage backend error");
    }
  });

  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (key.startsWith("gincana/avatar/")) {
      res.status(404).send("Media not found");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
