import { Router } from "express";
import { requireAuth } from "../middleware/auth";

// Skeleton — implemented by the artifacts module build. Registered in index.ts.
export const artifactsRouter = Router();

artifactsRouter.get("/", requireAuth, (_req, res) => {
  res.json({ module: "artifacts", status: "not implemented yet" });
});
