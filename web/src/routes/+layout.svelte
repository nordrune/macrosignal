<script lang="ts">
	import { browser } from '$app/environment';
	import { createI18n, setI18n } from '$lib/i18n';
	import '../app.css';

	let { children } = $props();

	const i18n = createI18n();
	setI18n(i18n);

	const title = $derived(i18n.t('app.title'));

	// ponytail: documentElement sync is an external DOM boundary — $effect is appropriate
	$effect(() => {
		if (!browser) return;
		document.documentElement.classList.add('dark');
		document.documentElement.lang = i18n.lang;
	});

	// ponytail: minimal PWA — manifest + shell service worker
	$effect(() => {
		if (!browser || !('serviceWorker' in navigator)) return;
		navigator.serviceWorker.register('/sw.js').catch(() => {});
	});
</script>

<svelte:head>
	<meta
		name="description"
		content="Educational trading strategy backtester with a web dashboard."
	/>
	<meta name="theme-color" content="#08090d" />
	<meta name="apple-mobile-web-app-title" content="MacroSignal" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<link rel="manifest" href="/site.webmanifest" />
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="icon" href="/favicon.ico" sizes="any" />
	<link rel="icon" type="image/png" href="/favicon.png" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<title>{title}</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="min-h-screen overflow-x-clip">
	{@render children()}
</div>
