import { Router } from "express";
import { requireAuth } from "../middleware/auth";

// Skeleton — implemented by the requests module build. Registered in index.ts.
export const requestsRouter = Router();

requestsRouter.get("/", requireAuth, (_req, res) => {
  res.json({ module: "requests", status: "not implemented yet" });
});
