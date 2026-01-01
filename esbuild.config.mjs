import esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
	entryPoints: ['main.ts'],
	bundle: true,
	outfile: 'main.js',
	external: ['obsidian'],
	format: 'cjs',
	target: 'es2022',
	// Use browser platform so trystero uses native WebRTC instead of node-datachannel
	platform: 'browser',
	sourcemap: 'inline',
	logLevel: 'info',
	// Provide import.meta.url shim that works on both desktop (Node.js) and mobile (no Node.js)
	banner: {
		js: `var __import_meta_url = (typeof require !== 'undefined' && typeof __filename !== 'undefined') ? require('url').pathToFileURL(__filename).href : 'file:///plugin.js';`,
	},
	define: {
		'import.meta.url': '__import_meta_url',
		// Ensure global is available (Electron has it but browser platform doesn't assume it)
		'global': 'globalThis',
	},
};

async function build() {
	if (isWatch) {
		const ctx = await esbuild.context(buildOptions);
		await ctx.watch();
		console.log('Watching for changes...');
	} else {
		await esbuild.build(buildOptions);
		console.log('Build complete');
	}
}

build().catch((err) => {
	console.error(err);
	process.exit(1);
});
