import { Router } from "express";
import { requireAuth } from "../middleware/auth";

// Skeleton — implemented by the uploads module build. Registered in index.ts.
export const uploadsRouter = Router();

uploadsRouter.get("/", requireAuth, (_req, res) => {
  res.json({ module: "uploads", status: "not implemented yet" });
});
