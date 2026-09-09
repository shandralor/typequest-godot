import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";

// Dev-only write-back for the island editor: POST /__editor/save {name, source} writes
// src/content/island/<name>.ts. The authored data-as-code file stays the source of truth; the
// editor is just a nicer pen for it. Name is a strict identifier so nothing escapes the folder.
function editorWriteBack(): Plugin {
  return {
    name: "tq-editor-writeback",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__editor/save", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = "";
        req.on("data", (c: Buffer) => (body += c.toString()));
        req.on("end", async () => {
          try {
            const { name, source, dir: dirName = "island" } = JSON.parse(body) as { name: string; source: string; dir?: string };
            if (!/^[a-z][a-z0-9_]{0,40}$/.test(name) || !/^(island|scenes)$/.test(dirName) || typeof source !== "string" || source.length > 4_000_000) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "bad_name_or_source" }));
              return;
            }
            const dir = resolve(__dirname, "src/content", dirName);
            await mkdir(dir, { recursive: true });
            const file = resolve(dir, `${name}.ts`);
            await writeFile(file, source, "utf8");
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: true, file: `src/content/${dirName}/${name}.ts` }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
      });
    },
  };
}

// GitHub Pages serves a project site under /<repo>/, so the deployment prefix comes in as
// TQ_BASE at build time and reaches the runtime as import.meta.env.BASE_URL (see assetPath.ts).
// Unset (dev, and a domain-root deploy) means "/".
export default defineConfig({
  base: process.env.TQ_BASE ?? "/",
  plugins: [editorWriteBack()],
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, "index.html"), editor: resolve(__dirname, "editor.html") },
    },
  },
});
