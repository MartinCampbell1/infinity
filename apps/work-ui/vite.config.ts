import { sveltekit } from '@sveltejs/kit/vite';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

import { viteStaticCopy } from 'vite-plugin-static-copy';

const onnxRuntimeDistDir = path.join(process.cwd(), 'node_modules', 'onnxruntime-web', 'dist');
const hasOnnxRuntimeJsepAssets =
	existsSync(onnxRuntimeDistDir) &&
	readdirSync(onnxRuntimeDistDir).some((file) => file.includes('.jsep.'));

export default defineConfig({
	plugins: [
		sveltekit(),
		viteStaticCopy({
			targets: hasOnnxRuntimeJsepAssets
				? [
						{
							src: 'node_modules/onnxruntime-web/dist/*.jsep.*',
							dest: 'wasm'
						}
					]
				: []
		})
	],
	define: {
		APP_VERSION: JSON.stringify(process.env.npm_package_version),
		APP_BUILD_HASH: JSON.stringify(process.env.APP_BUILD_HASH || 'dev-build')
	},
	build: {
		sourcemap: true
	},
	worker: {
		format: 'es'
	},
	esbuild: {
		pure: process.env.ENV === 'dev' ? [] : ['console.log', 'console.debug', 'console.error']
	}
});
