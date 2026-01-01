# AGENTS.md - LLM Agent Documentation

## Project Overview

**Trystero Share** is an Obsidian plugin that enables peer-to-peer document sharing via WebRTC using the [trystero](https://github.com/dmotz/trystero) library. It consists of two parts:

1. **Obsidian Plugin** (`main.ts`) - Runs in Obsidian, shares vault documents
2. **Web Client** (`webapp/index.html`) - Browser app that connects to view documents

## Project Structure

```
trystero-share/
├── main.ts              # Plugin source (TypeScript)
├── main.js              # Compiled plugin (generated)
├── manifest.json        # Obsidian plugin manifest
├── package.json         # Dependencies and scripts
├── esbuild.config.mjs   # Build configuration
├── webapp/
│   └── index.html       # Web client (standalone HTML)
└── AGENTS.md            # This file
```

## Build System

### Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run build` | Production build |
| `npm run dev` | Watch mode for development |

### esbuild Configuration

The build uses esbuild with specific settings for Obsidian/Electron compatibility:

- **format**: `cjs` - Obsidian requires CommonJS modules
- **platform**: `browser` - Use browser APIs (WebRTC) instead of Node.js native addons
- **external**: `['obsidian']` - Obsidian API provided at runtime
- **banner**: Shim for `import.meta.url` with desktop/mobile detection (see below)
- **define**: `global` → `globalThis` for browser platform compatibility

### Mobile Compatibility

Obsidian mobile doesn't have Node.js APIs (`require`, `__filename`, etc.). The `import.meta.url` shim must detect the environment:

```javascript
// Works on both desktop (Electron/Node.js) and mobile
banner: {
  js: `var __import_meta_url = (typeof require !== 'undefined' && typeof __filename !== 'undefined') ? require('url').pathToFileURL(__filename).href : 'file:///plugin.js';`,
},
```

Also ensure `manifest.json` has `"isDesktopOnly": false` to allow mobile loading.

### Common Build Issues

1. **Top-level await error**: Use `platform: 'browser'` to avoid Node.js polyfills with top-level await
2. **node_datachannel.node error**: Caused by `platform: 'node'`; switch to `platform: 'browser'`
3. **import.meta.url undefined**: Add banner shim with environment detection (see Mobile Compatibility above)
4. **Failed to load plugin on mobile**: Don't use Node.js APIs unconditionally in banner/shims

## Trystero P2P Communication

### Strategy

Both plugin and webapp must use the **same strategy**. This project uses BitTorrent:

```typescript
// Plugin (main.ts)
import { joinRoom } from 'trystero/torrent';

// Webapp (index.html)
import { joinRoom } from 'https://esm.sh/trystero@0.20.1/torrent';
```

Available strategies: `torrent`, `nostr`, `mqtt`, `firebase`, `supabase`, `ipfs`

### Room Configuration

```typescript
const config = { appId: 'obsidian-trystero-share-v1' };
const roomId = 'my-obsidian-vault';
const room = joinRoom(config, roomId);
```

Both peers must use identical `appId` and `roomId` to connect.

### Actions Protocol

Actions are created with `room.makeAction(name)` returning `[send, receive]` functions.

| Action | Direction | Request Shape | Response Shape |
|--------|-----------|---------------|----------------|
| `doc` | Request/Response | `{ path: string, requestId: string }` | `{ path: string, content?: string, error?: string, requestId: string }` |
| `docList` | Request/Response | `{ requestId: string }` | `{ files: string[], requestId: string }` |
| `update` | Broadcast (plugin→webapp) | — | `{ path: string, content: string }` |

### Sending to Specific Peer

```typescript
// Broadcast to all peers
send(data);

// Send to specific peer
send(data, peerId);
```

## Obsidian Plugin Development

### Lifecycle Methods

```typescript
export default class MyPlugin extends Plugin {
  async onload() {
    // Called when plugin is enabled
    // Register commands, ribbon icons, event handlers
  }

  async onunload() {
    // Called when plugin is disabled
    // Clean up resources, leave rooms, etc.
  }
}
```

### Key Obsidian APIs

```typescript
// Get file by path
const file = this.app.vault.getAbstractFileByPath(path);

// Check if it's a file (not folder)
if (file instanceof TFile) {
  // Read file content
  const content = await this.app.vault.read(file);
}

// Get all markdown files
const files = this.app.vault.getMarkdownFiles();

// Register event listener (auto-cleanup on unload)
this.registerEvent(
  this.app.vault.on('modify', (file) => { /* ... */ })
);

// Add ribbon icon
this.addRibbonIcon('icon-name', 'Tooltip', () => { /* click handler */ });

// Add command
this.addCommand({
  id: 'command-id',
  name: 'Command Name',
  callback: () => { /* ... */ }
});

// Show notice
new Notice('Message to user');
```

### Type Guards

Always use type guards when working with vault files:

```typescript
import { TFile, TFolder } from 'obsidian';

const file = this.app.vault.getAbstractFileByPath(path);
if (file instanceof TFile) {
  // It's a file
} else if (file instanceof TFolder) {
  // It's a folder
}
```

## Webapp Development

### ESM Imports via CDN

```html
<script type="module">
  import { joinRoom } from 'https://esm.sh/trystero@0.20.1/torrent';
</script>
```

Pin the version to match the plugin's installed version.

### Request/Response Pattern

Use request IDs to match async responses:

```javascript
const pendingRequests = new Map();

function request(data) {
  return new Promise((resolve) => {
    const requestId = generateId();
    pendingRequests.set(requestId, resolve);
    send({ ...data, requestId }, hostPeerId);

    // Timeout
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        resolve({ error: 'Timeout' });
      }
    }, 10000);
  });
}

// In receive handler
receive((response) => {
  const resolve = pendingRequests.get(response.requestId);
  if (resolve) {
    pendingRequests.delete(response.requestId);
    resolve(response);
  }
});
```

## Testing

### Manual Testing Workflow

1. Build plugin: `npm run build`
2. Reload Obsidian or disable/enable plugin
3. Click ribbon icon to start sharing
4. Serve webapp: `cd webapp && python3 -m http.server 8080`
5. Open `http://localhost:8080`
6. Check both browser and Obsidian consoles for connection logs

### Console Debugging

Plugin logs to Obsidian console (Ctrl+Shift+I):
- "Trystero sharing started"
- "Peer joined: {peerId}"
- "Doc request from {peerId}: {path}"

Webapp logs to browser console (F12):
- "Connected to host: {peerId}"

## Common Patterns

### Toggle State with Ribbon Icon

```typescript
private isActive = false;
private ribbonIcon: HTMLElement | null = null;

onload() {
  this.ribbonIcon = this.addRibbonIcon('icon', 'Toggle', () => {
    this.isActive = !this.isActive;
    this.updateRibbonIcon();
  });
}

private updateRibbonIcon() {
  if (this.ribbonIcon) {
    this.ribbonIcon.toggleClass('is-active', this.isActive);
  }
}
```

### Clean Resource Cleanup

```typescript
private room: Room | null = null;

async onunload() {
  if (this.room) {
    this.room.leave();
    this.room = null;
  }
}
```

## References

- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [Obsidian Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [Obsidian API Types](https://github.com/obsidianmd/obsidian-api)
- [Trystero Documentation](https://github.com/dmotz/trystero)
- [esbuild Documentation](https://esbuild.github.io/)
