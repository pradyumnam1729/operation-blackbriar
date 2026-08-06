import { Router } from "express";
import { requireAuth } from "../middleware/auth";

// Skeleton — implemented by the features module build. Registered in index.ts.
export const featuresRouter = Router();

featuresRouter.get("/", requireAuth, (_req, res) => {
  res.json({ module: "features", status: "not implemented yet" });
});
