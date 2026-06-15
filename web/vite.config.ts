import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const apiOrigin = process.env.API_ORIGIN ?? 'http://127.0.0.1:41793';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		port: Number(process.env.WEB_PORT ?? 5173),
		allowedHosts: ['macrosignal.berserkresults.com'],
		proxy: {
			// ponytail: dev-only proxy; prod uses hooks.server.ts
			'/api': { target: apiOrigin, changeOrigin: true },
			'/health': { target: apiOrigin, changeOrigin: true }
		}
	}
});
