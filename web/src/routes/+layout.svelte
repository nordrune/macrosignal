<script lang="ts">
	import { browser } from '$app/environment';
	import SignalScoutChat from '$lib/components/SignalScoutChat.svelte';
	import { createI18n, setI18n } from '$lib/i18n';
	import { FAVICON, META_THEME_COLOR, PWA_ICON } from '$lib/theme';
	import '../app.css';

	let { children } = $props();

	const i18n = createI18n();
	setI18n(i18n);

	const title = $derived(i18n.t('app.title'));

	$effect(() => {
		if (!browser) return;
		document.documentElement.lang = i18n.lang;
	});
</script>

<svelte:head>
	<meta
		name="description"
		content="Educational trading strategy backtester with a web dashboard."
	/>
	<meta name="theme-color" content={META_THEME_COLOR} />
	<meta name="apple-mobile-web-app-title" content="MacroSignal" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<link rel="manifest" href="/site.webmanifest" />
	<link rel="icon" href={FAVICON.ico} sizes="any" />
	<link rel="icon" type="image/png" href={FAVICON.png} sizes="192x192" />
	<link rel="apple-touch-icon" href={PWA_ICON.apple} />
	<title>{title}</title>
</svelte:head>

<div class="min-h-screen overflow-x-clip">
	{@render children()}
	<SignalScoutChat />
</div>
