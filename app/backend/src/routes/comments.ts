import { Router } from "express";
import { requireAuth } from "../middleware/auth";

// Skeleton — implemented by the comments module build. Registered in index.ts.
export const commentsRouter = Router();

commentsRouter.get("/", requireAuth, (_req, res) => {
  res.json({ module: "comments", status: "not implemented yet" });
});
