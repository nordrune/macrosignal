<script lang="ts">
	import { browser } from '$app/environment';
	import favicon from '$lib/assets/favicon.svg';
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
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{title}</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

{@render children()}
