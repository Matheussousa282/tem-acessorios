
import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.all("/api/:route", async (req, res) => {
    const { route } = req.params;
    const apiPath = path.join(__dirname, "api", `${route}.ts`);

    if (fs.existsSync(apiPath)) {
      try {
        const module = await import(`./api/${route}.ts`);
        const handler = module.default;
        if (typeof handler === "function") {
          return await handler(req, res);
        } else {
          return res.status(500).json({ error: "Handler not found in API file" });
        }
      } catch (error: any) {
        console.error(`Error executing API route ${route}:`, error);
        return res.status(500).json({ error: error.message });
      }
    } else {
      return res.status(404).json({ error: "API route not found" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
