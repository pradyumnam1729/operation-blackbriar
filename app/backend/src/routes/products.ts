import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { supabase } from "../services/db";

export const productsRouter = Router();

productsRouter.get("/", requireAuth, async (_req, res) => {
  const sb = supabase()!;
  const { data, error } = await sb
    .from("products")
    .select("id, name, line, module")
    .order("line")
    .order("module");
  if (error) return res.status(500).json({ error: error.message });
  res.json({ products: data });
});
