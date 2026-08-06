import "dotenv/config";
import express from "express";
import cors from "cors";
import { queryRouter } from "./routes/query";
import { foundationRouter } from "./routes/foundation";
import { assetsRouter } from "./routes/assets";
import { WAR_ROOM_DIR } from "./services/warRoom";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, warRoom: WAR_ROOM_DIR })
);
app.use("/api/query", queryRouter);
app.use("/api/foundation", foundationRouter);
app.use("/api/assets", assetsRouter);

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`PMM Agent backend on http://localhost:${port}`);
  console.log(`War room: ${WAR_ROOM_DIR}`);
});
