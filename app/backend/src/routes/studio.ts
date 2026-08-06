import { Router } from "express";
import { requireAuth } from "../middleware/auth";

// Skeleton — implemented by the studio module build. Registered in index.ts.
export const studioRouter = Router();

studioRouter.get("/", requireAuth, (_req, res) => {
  res.json({ module: "studio", status: "not implemented yet" });
});
