import { Plugin, Notice, TFile } from 'obsidian';
import { joinRoom, Room } from 'trystero/torrent';

// Type definitions for action payloads
interface DocRequest {
	path: string;
	requestId: string;
}

interface DocResponse {
	path: string;
	content?: string;
	error?: string;
	requestId: string;
}

interface DocListRequest {
	requestId: string;
}

interface DocListResponse {
	files: string[];
	requestId: string;
}

interface UpdatePayload {
	path: string;
	content: string;
}

// Type for action sender functions
type ActionSender<T> = (data: T, targetPeers?: string | string[]) => void;

// Debounce delay for file updates (ms)
const UPDATE_DEBOUNCE_MS = 500;

export default class TrysteroSharePlugin extends Plugin {
	private room: Room | null = null;
	private isSharing = false;
	private ribbonIcon: HTMLElement | null = null;

	// Action senders
	private sendDoc: ActionSender<DocResponse> | null = null;
	private sendDocList: ActionSender<DocListResponse> | null = null;
	private sendUpdate: ActionSender<UpdatePayload> | null = null;

	// Debounce timers for file updates
	private pendingUpdates: Map<string, NodeJS.Timeout> = new Map();

	async onload() {
		// Add ribbon icon
		this.ribbonIcon = this.addRibbonIcon('share', 'Toggle document sharing', () => {
			this.toggleSharing();
		});

		// Add command
		this.addCommand({
			id: 'toggle-document-sharing',
			name: 'Toggle document sharing',
			callback: () => {
				this.toggleSharing();
			},
		});
	}

	async onunload() {
		await this.stopSharing();
	}

	private async toggleSharing() {
		if (this.isSharing) {
			await this.stopSharing();
		} else {
			await this.startSharing();
		}
	}

	private async startSharing() {
		if (this.isSharing) return;

		try {
			// Join the Trystero room
			this.room = joinRoom(
				{ appId: 'obsidian-trystero-share-v1' },
				'my-obsidian-vault'
			);

			// Set up peer event handlers
			this.room.onPeerJoin((peerId) => {
				console.log(`Peer joined: ${peerId}`);
				new Notice('Client connected!');
			});

			this.room.onPeerLeave((peerId) => {
				console.log(`Peer left: ${peerId}`);
			});

			// Set up actions
			this.setupActions();

			// Register vault modify event for live updates
			this.registerEvent(
				this.app.vault.on('modify', (file) => {
					if (file instanceof TFile && file.extension === 'md') {
						this.broadcastFileUpdate(file);
					}
				})
			);

			this.isSharing = true;
			this.updateRibbonIcon();
			new Notice('Document sharing started');
			console.log('Trystero sharing started');
		} catch (error) {
			console.error('Failed to start sharing:', error);
			new Notice('Failed to start document sharing');
		}
	}

	private setupActions() {
		if (!this.room) return;

		// Document request/response action
		const [sendDoc, getDoc] = this.room.makeAction<DocRequest | DocResponse>('doc');
		this.sendDoc = sendDoc as ActionSender<DocResponse>;

		getDoc((data, peerId) => {
			// Only handle requests (those with path but no content/error)
			const request = data as DocRequest;
			if (request.path && request.requestId && !('content' in data) && !('error' in data)) {
				this.handleDocRequest(request, peerId);
			}
		});

		// Document list action
		const [sendDocList, getDocList] = this.room.makeAction<DocListRequest | DocListResponse>('docList');
		this.sendDocList = sendDocList as ActionSender<DocListResponse>;

		getDocList((data, peerId) => {
			// Only handle requests (those without files array)
			const request = data as DocListRequest;
			if (request.requestId && !('files' in data)) {
				this.handleDocListRequest(request, peerId);
			}
		});

		// Update action (send only, no handler needed for incoming)
		const [sendUpdate] = this.room.makeAction<UpdatePayload>('update');
		this.sendUpdate = sendUpdate as ActionSender<UpdatePayload>;
	}

	private async handleDocRequest(request: DocRequest, peerId: string) {
		console.log(`Doc request from ${peerId}: ${request.path}`);

		const response: DocResponse = {
			path: request.path,
			requestId: request.requestId,
		};

		try {
			const file = this.app.vault.getAbstractFileByPath(request.path);

			if (!file) {
				response.error = 'File not found';
			} else if (!(file instanceof TFile)) {
				response.error = 'Path is not a file';
			} else if (file.extension !== 'md') {
				response.error = 'Only markdown files can be shared';
			} else {
				response.content = await this.app.vault.read(file);
			}
		} catch (error) {
			response.error = `Failed to read file: ${error}`;
		}

		// Send response to the requesting peer only
		if (this.sendDoc) {
			this.sendDoc(response, peerId);
		}
	}

	private async handleDocListRequest(request: DocListRequest, peerId: string) {
		console.log(`DocList request from ${peerId}`);

		const files = this.app.vault.getMarkdownFiles().map((file) => file.path);

		const response: DocListResponse = {
			files,
			requestId: request.requestId,
		};

		// Send response to the requesting peer only
		if (this.sendDocList) {
			this.sendDocList(response, peerId);
		}
	}

	private broadcastFileUpdate(file: TFile) {
		if (!this.sendUpdate || !this.isSharing) return;

		// Clear any pending update for this file
		const existingTimeout = this.pendingUpdates.get(file.path);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
		}

		// Schedule debounced update
		const timeout = setTimeout(async () => {
			this.pendingUpdates.delete(file.path);

			if (!this.sendUpdate || !this.isSharing) return;

			try {
				const content = await this.app.vault.read(file);
				const update: UpdatePayload = {
					path: file.path,
					content,
				};

				// Broadcast to all peers
				this.sendUpdate(update);
				console.log(`Broadcasted update for: ${file.path}`);
			} catch (error) {
				console.error(`Failed to broadcast update for ${file.path}:`, error);
			}
		}, UPDATE_DEBOUNCE_MS);

		this.pendingUpdates.set(file.path, timeout);
	}

	private async stopSharing() {
		if (!this.isSharing) return;

		// Clear all pending update timers
		for (const timeout of this.pendingUpdates.values()) {
			clearTimeout(timeout);
		}
		this.pendingUpdates.clear();

		if (this.room) {
			this.room.leave();
			this.room = null;
		}

		this.sendDoc = null;
		this.sendDocList = null;
		this.sendUpdate = null;

		this.isSharing = false;
		this.updateRibbonIcon();
		new Notice('Document sharing stopped');
		console.log('Trystero sharing stopped');
	}

	private updateRibbonIcon() {
		if (this.ribbonIcon) {
			if (this.isSharing) {
				this.ribbonIcon.addClass('is-active');
				this.ribbonIcon.setAttribute('aria-label', 'Stop document sharing');
			} else {
				this.ribbonIcon.removeClass('is-active');
				this.ribbonIcon.setAttribute('aria-label', 'Start document sharing');
			}
		}
	}
}
