import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { queryRouter } from "./routes/query";
import { quickGenRouter } from "./routes/quickgen";
import { meRouter } from "./routes/me";
import { usersRouter } from "./routes/users";
import { productsRouter } from "./routes/products";
import { aiRouter } from "./routes/ai";
import { requestsRouter } from "./routes/requests";
import { uploadsRouter } from "./routes/uploads";
import { artifactsRouter } from "./routes/artifacts";
import { featuresRouter } from "./routes/features";
import { commentsRouter } from "./routes/comments";
import { studioRouter } from "./routes/studio";
import { integrationsRouter } from "./routes/integrations";
import { sharepointRouter } from "./routes/sharepoint";
import { localFoldersRouter } from "./routes/localFolders";
import { documentsRouter } from "./routes/documents";
import { competitiveRouter } from "./routes/competitive";
import { guardrailsRouter } from "./routes/guardrails";
import { questionnaireRouter } from "./routes/questionnaire";
import { messagingDocsRouter } from "./routes/messagingDocs";
import { templatesRouter } from "./routes/templates";
import { agentsRouter } from "./routes/agents";
import { customAgentsRouter } from "./routes/customAgents";
import { brandThemeRouter } from "./routes/brandTheme";
import { referenceAssetsRouter } from "./routes/referenceAssets";
import { syncAgentBaselines } from "./services/agents";
import { WAR_ROOM_DIR } from "./services/warRoom";
import { dbStatus } from "./services/db";
import { startSharePointPolling } from "./services/sharepoint";
import { restartInputWatcher } from "./services/localFolders";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", async (_req, res) =>
  res.json({ ok: true, warRoom: WAR_ROOM_DIR, database: await dbStatus() })
);

app.use("/api/me", meRouter);
app.use("/api/users", usersRouter);
app.use("/api/products", productsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/query", queryRouter);
app.use("/api/quick-generate", quickGenRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/artifacts", artifactsRouter);
app.use("/api/features", featuresRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/studio", studioRouter);
app.use("/api/integrations", integrationsRouter);
app.use("/api/sharepoint", sharepointRouter);
app.use("/api/local-folders", localFoldersRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/competitive", competitiveRouter);
app.use("/api/guardrails", guardrailsRouter);
app.use("/api/questionnaire", questionnaireRouter);
app.use("/api/messaging-docs", messagingDocsRouter);
// Brand-theme routes mount first so the templates router's /:id never swallows them.
app.use("/api/templates/brand-theme", brandThemeRouter);
app.use("/api/templates", templatesRouter);
// Custom-agent routes mount first so the main router's /:key never swallows them.
app.use("/api/agents/custom", customAgentsRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/reference-assets", referenceAssetsRouter);

// Uploaded files (previews/downloads go through routes; this serves raw files to admins via signed paths later)
app.use("/files", express.static(path.resolve(__dirname, "..", "uploads")));

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`PMM Agent backend on http://localhost:${port}`);
  console.log(`War room: ${WAR_ROOM_DIR}`);
  startSharePointPolling();
  void restartInputWatcher();
  // Reconcile agent base prompts from canonical sources (code constants +
  // .claude/agents files) — never touches admin-owned config fields.
  void syncAgentBaselines();
});
