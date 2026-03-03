# Trystero Share

Trystero Share is an Obsidian plugin plus a small browser client for live, peer-to-peer sharing of Markdown notes over WebRTC.

> This repository is a proof of concept (PoC) intended for experimentation and learning, not production deployment.

The project has two runtime parts:

- Obsidian plugin (`main.ts`): hosts your vault content and serves requests from connected peers.
- Browser web client (`webapp/index.html`): connects to the plugin, lists Markdown files, renders selected notes, and updates live as files change.

## Features

- Peer-to-peer sharing with [trystero](https://github.com/dmotz/trystero) (`torrent` strategy).
- Request/response document fetch by path.
- Request/response Markdown file index.
- Live update broadcast when Markdown files are modified in Obsidian.
- Works on desktop and mobile Obsidian (`isDesktopOnly: false`).

## Project Layout

```text
trystero-share/
├── main.ts                # Obsidian plugin source
├── main.js                # Built plugin output (generated)
├── manifest.json          # Obsidian plugin manifest
├── esbuild.config.mjs     # Build configuration
├── webapp/
│   └── index.html         # Standalone browser client
└── docs/
    ├── DEVELOPMENT.md     # Build/runtime internals and workflows
    └── PROTOCOL.md        # P2P message contracts and flow
```

## Requirements

- Obsidian (desktop or mobile) with community plugins enabled.
- Node.js 18+ and npm (for building).
- A modern browser with WebRTC support.

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the plugin:

   ```bash
   npm run build
   ```

3. Reload Obsidian and enable **Trystero Share** in community plugins.
4. Click the share ribbon icon (or run command `Toggle document sharing`).
5. Serve the web client:

   ```bash
   cd webapp
   python3 -m http.server 8080
   ```

6. Open `http://localhost:8080` and select files from the sidebar.

## Development

- One-off production build: `npm run build`
- Watch mode while editing plugin code: `npm run dev`

For implementation details, compatibility notes, and testing workflows:

- [Development guide](docs/DEVELOPMENT.md)
- [Protocol reference](docs/PROTOCOL.md)

## How It Works (High Level)

1. Plugin joins room `my-obsidian-vault` with app ID `obsidian-trystero-share-v1`.
2. Web client joins the same room and waits for a host peer.
3. Client requests the markdown file list (`docList`).
4. Client requests selected file content (`doc`).
5. Plugin broadcasts updates (`update`) when Markdown files are modified.

## Current Limits

- This is a proof-of-concept implementation and is not hardened for production use.
- Shares only Markdown files (`.md`).
- Uses fixed room/app IDs in code (not configurable in UI yet).
- Web client is a standalone static page without authentication.

## Troubleshooting

- If the web client stays on "Waiting for host...":
  - Confirm sharing is enabled in Obsidian.
  - Confirm plugin and webapp use the same `appId`, `roomId`, and Trystero strategy.
- If builds fail on mobile compatibility:
  - Keep `platform: 'browser'` in `esbuild.config.mjs`.
  - Keep the `import.meta.url` shim used by this project.
