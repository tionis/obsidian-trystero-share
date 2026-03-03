# Protocol Reference

This document defines the Trystero room configuration and message contracts used between the Obsidian plugin and the browser client.

## Transport

- Library: `trystero`
- Strategy: `torrent`
- Room config:
  - `appId`: `obsidian-trystero-share-v1`
  - `roomId`: `my-obsidian-vault`

Both peers must use the exact same strategy, `appId`, and `roomId`.

## Action Contracts

The project uses three Trystero actions.

## `doc`

Request a single Markdown file and receive its content or an error.

Request shape:

```ts
{
  path: string;
  requestId: string;
}
```

Response shape:

```ts
{
  path: string;
  requestId: string;
  content?: string;
  error?: string;
}
```

Notes:

- Plugin responds only to the requesting peer (`send(data, peerId)`).
- Plugin validates target path:
  - exists
  - is a file
  - has `.md` extension

## `docList`

Request the list of markdown files from the vault.

Request shape:

```ts
{
  requestId: string;
}
```

Response shape:

```ts
{
  requestId: string;
  files: string[];
}
```

Notes:

- Returns paths from `app.vault.getMarkdownFiles()`.
- Response is sent only to the requesting peer.

## `update`

Broadcast updated file content to all connected peers.

Payload shape:

```ts
{
  path: string;
  content: string;
}
```

Notes:

- Sent by plugin only; web client listens.
- Updates are debounced by 500ms per file.
- Triggered on Obsidian vault `modify` events for Markdown files.

## Request/Response Correlation

The web client uses `requestId` to map async responses:

- A pending request map stores `requestId -> resolver`.
- On incoming response, matching resolver is called and removed.
- Requests time out after 10 seconds and resolve with an empty/error result.

## Typical Flow

1. Host plugin starts sharing and joins room.
2. Web client joins and receives `onPeerJoin(peerId)` for the host.
3. Client sends `docList` request to that `peerId`.
4. User selects a file; client sends `doc` request to host `peerId`.
5. Plugin emits `update` broadcasts whenever file content changes.

## Compatibility Requirements

- Plugin import: `trystero/torrent`
- Web client import: `https://esm.sh/trystero@0.20.1/torrent`

If strategy or version behavior diverges, peers may fail to connect or exchange actions.
