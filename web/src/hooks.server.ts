import type { Handle } from '@sveltejs/kit';

const apiOrigin = process.env.API_ORIGIN ?? 'http://127.0.0.1:41793';

// ponytail: prod API proxy — Bun adapter has no Vite proxy
export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	if (path.startsWith('/api') || path === '/health') {
		const target = new URL(path + event.url.search, apiOrigin);
		const headers = new Headers(event.request.headers);
		headers.delete('host');
		const init: RequestInit = {
			method: event.request.method,
			headers
		};
		if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
			init.body = await event.request.arrayBuffer();
		}
		const response = await fetch(target, init);
		return new Response(response.body, {
			status: response.status,
			headers: response.headers
		});
	}
	return resolve(event);
};
