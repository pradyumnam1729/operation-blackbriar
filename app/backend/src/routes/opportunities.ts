import { Router } from "express";
import { requireAuth } from "../middleware/auth";

// Skeleton — implemented by the opportunities module build. Registered in index.ts.
export const opportunitiesRouter = Router();

opportunitiesRouter.get("/", requireAuth, (_req, res) => {
  res.json({ module: "opportunities", status: "not implemented yet" });
});
