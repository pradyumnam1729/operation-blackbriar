import { Router } from "express";
import { requireAuth } from "../middleware/auth";

// Skeleton — implemented by the integrations module build. Registered in index.ts.
export const integrationsRouter = Router();

integrationsRouter.get("/", requireAuth, (_req, res) => {
  res.json({ module: "integrations", status: "not implemented yet" });
});
