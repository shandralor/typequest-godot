# Deploy -- web publishing

TypeQuest ships to the web as a Godot HTML5 export. The pipeline is CI-driven:
push to `main`, GitHub Actions builds the export, GitHub Pages serves it.

## How it works

- `export_presets.cfg` -- the `Web` export preset. `thread_support=false`
  (single-threaded) on purpose: GitHub Pages cannot send the
  `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers a
  threaded WASM build needs, so we stay single-threaded there.
- `project.godot` -- desktop keeps `forward_plus`; the web override
  `rendering/renderer/rendering_method.web="gl_compatibility"` builds the web
  target on WebGL2 for universal browser support.
- `.github/workflows/deploy.yml` -- on push to `main` (or a manual
  `workflow_dispatch`): installs Godot 4.7 + the matching export templates,
  imports resources, runs `--export-release "Web"`, and deploys `build/web` to
  Pages.

## One-time setup (do this once, in the repo settings)

1. The repo must be **public** -- GitHub Pages is only free on public repos
   (private needs a paid plan). TypeQuest is source-available under a
   noncommercial license (see `LICENSE.md`), so public is fine.
2. GitHub -> repo **Settings -> Pages**.
3. Under **Build and deployment**, set **Source = GitHub Actions**.

That is all. The first push to `main` after that runs the workflow and the site
goes live at `https://<owner>.github.io/typequest-godot/`.

## Building the web export locally

Requires Godot 4.7 with the web export templates installed (Editor ->
**Manage Export Templates**, or download the `.tpz` for 4.7.stable).

```sh
mkdir -p build/web
godot --headless --export-release "Web" build/web/index.html
# serve it (a plain file:// open will NOT work -- browsers block WASM there):
python3 -m http.server -d build/web 8000   # then open http://localhost:8000
```

## Other hosts (Coolify, a VPS, any static host)

The export is just static files (`index.html`, `.wasm`, `.pck`, `.js`), so it
serves from anywhere. On a host where you control the response headers (nginx,
Caddy, Coolify) you can send `Cross-Origin-Opener-Policy: same-origin` +
`Cross-Origin-Embedder-Policy: require-corp` and switch the preset to a
**threaded** build for better performance -- something Pages can't do. A
Dockerfile that exports with Godot and serves the result via nginx is the clean
fit for Coolify's push-to-deploy; not set up yet (Pages first).
