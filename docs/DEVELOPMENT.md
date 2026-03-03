# Development Guide

This guide covers build settings, local workflows, and manual validation for the Trystero Share plugin and web client.

## Prerequisites

- Node.js 18+
- npm
- Obsidian installed with community plugins enabled

## Install

```bash
npm install
```

## Build Commands

- Production build:

  ```bash
  npm run build
  ```

- Watch mode:

  ```bash
  npm run dev
  ```

`main.js` is generated from `main.ts` by esbuild.

## Build Configuration Notes

The project uses `esbuild.config.mjs` with settings chosen for Obsidian and mobile compatibility:

- `format: 'cjs'`: required by Obsidian plugin runtime.
- `platform: 'browser'`: ensures Trystero uses native WebRTC (avoids node-datachannel issues).
- `external: ['obsidian']`: Obsidian API is provided by the host app.
- `define: { global: 'globalThis' }`: browser platform compatibility.
- `banner` shim defines `import.meta.url` safely for:
  - desktop (Node/Electron)
  - mobile (no Node globals)

## Runtime Architecture

## Obsidian Plugin (`main.ts`)

- Adds ribbon icon and command to toggle sharing.
- Joins/leaves Trystero room.
- Handles incoming `doc` and `docList` requests.
- Watches vault `modify` events and broadcasts `update`.

## Web Client (`webapp/index.html`)

- Joins the same room as plugin.
- Detects host peer on join.
- Requests file list and document content.
- Renders Markdown with `marked`.
- Applies live updates for currently selected file.

## Manual Test Workflow

1. Build plugin:

   ```bash
   npm run build
   ```

2. Reload Obsidian and enable plugin.
3. Click ribbon icon to start sharing.
4. Serve web client:

   ```bash
   cd webapp
   python3 -m http.server 8080
   ```

5. Open `http://localhost:8080`.
6. Confirm:
   - status changes to connected
   - file list loads
   - opening a file renders markdown
   - edits in Obsidian update active file view

## Debugging Tips

- Obsidian developer console:
  - `Trystero sharing started`
  - `Peer joined: ...`
  - `Doc request from ...`
- Browser console:
  - `Connected to host: ...`
- If connection fails, verify both sides match:
  - strategy: `torrent`
  - `appId`
  - `roomId`

## Common Failure Cases

- Top-level await / node polyfill issues:
  - keep `platform: 'browser'`
- Mobile load failures:
  - keep current `import.meta.url` shim
  - keep `manifest.json` with `"isDesktopOnly": false`
- Missing files in browser client:
  - only `.md` files are exposed by plugin
