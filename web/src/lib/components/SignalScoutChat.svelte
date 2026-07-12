<script lang="ts">
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import { getI18n } from '$lib/i18n';
	import { cn } from '$lib/utils';
	import BotIcon from '@lucide/svelte/icons/bot';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import MessageCircleIcon from '@lucide/svelte/icons/message-circle';
	import SendIcon from '@lucide/svelte/icons/send';
	import XIcon from '@lucide/svelte/icons/x';
	import { onMount, tick } from 'svelte';

	type ChatMessage = {
		role: 'user' | 'assistant';
		content: string;
	};

	type ChatResponse = {
		reply?: string;
		error?: string;
	};

	type InlinePart = {
		text: string;
		strong: boolean;
	};

	type RichLine = {
		kind: 'blank' | 'ordered' | 'paragraph' | 'unordered';
		marker?: string;
		parts: InlinePart[];
	};

	const i18n = getI18n();
	const STORAGE_KEY = 'macrosignal-signalscout-chat';
	const DASHBOARD_STORAGE_KEY = 'macrosignal-dashboard';
	const MAX_MESSAGES = 16;
	const TYPEWRITER_STEP_MS = 12;
	const TYPEWRITER_CHARS_PER_STEP = 3;

	let open = $state(false);
	let input = $state('');
	let loading = $state(false);
	let error = $state('');
	let viewport = $state<HTMLDivElement | null>(null);
	let typingMessageIndex = $state<number | null>(null);
	let typingRunId = 0;
	let messages = $state.raw<ChatMessage[]>([
		{
			role: 'assistant',
			content: i18n.t('chat.welcome')
		}
	]);

	function persistMessages() {
		if (!browser) return;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
	}

	function readDashboardContext() {
		if (!browser) return {};
		try {
			const raw = JSON.parse(localStorage.getItem(DASHBOARD_STORAGE_KEY) ?? '{}');
			const activeIndex = raw.activeSimulationIndex ?? 0;
			const activeSimulation = Array.isArray(raw.simulations) ? raw.simulations[activeIndex] : raw;
			return {
				language: i18n.lang,
				activeSimulationIndex: activeIndex,
				dataSource: activeSimulation?.dataSource,
				ticker: activeSimulation?.ticker,
				portfolioId: activeSimulation?.portfolioId,
				period: activeSimulation?.period,
				interval: activeSimulation?.interval,
				strategy: activeSimulation?.strategy,
				windowSize: activeSimulation?.windowSize,
				startingCapital: activeSimulation?.startingCapital,
				feeRate: activeSimulation?.feeRate,
				hasResult: Boolean(activeSimulation?.result),
				portfolios: Array.isArray(raw.portfolios)
					? raw.portfolios.map((portfolio: { name?: string; assets?: unknown[] }) => ({
							name: portfolio.name,
							assetCount: Array.isArray(portfolio.assets) ? portfolio.assets.length : 0
						}))
					: []
			};
		} catch {
			return { language: i18n.lang };
		}
	}

	async function scrollToBottom() {
		await tick();
		if (viewport) viewport.scrollTop = viewport.scrollHeight;
	}

	function parseInline(text: string): InlinePart[] {
		const parts: InlinePart[] = [];
		let rest = text;
		let strong = false;
		while (rest.length) {
			const markerIndex = rest.indexOf('**');
			if (markerIndex === -1) {
				parts.push({ text: rest, strong });
				break;
			}
			if (markerIndex > 0) parts.push({ text: rest.slice(0, markerIndex), strong });
			strong = !strong;
			rest = rest.slice(markerIndex + 2);
		}
		return parts.filter((part) => part.text.length > 0);
	}

	function renderMessageContent(content: string): RichLine[] {
		return content.split('\n').map((rawLine) => {
			const line = rawLine.trimEnd();
			if (!line.trim()) return { kind: 'blank', parts: [] };

			const ordered = line.match(/^(\d+\.)\s+(.*)$/);
			if (ordered) {
				return {
					kind: 'ordered',
					marker: ordered[1],
					parts: parseInline(ordered[2])
				};
			}

			const unordered = line.match(/^[-*]\s+(.*)$/);
			if (unordered) {
				return {
					kind: 'unordered',
					marker: '•',
					parts: parseInline(unordered[1])
				};
			}

			return { kind: 'paragraph', parts: parseInline(line) };
		});
	}

	function sleep(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async function typeAssistantReply(reply: string) {
		const runId = ++typingRunId;
		const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
		messages = [...messages, assistantMessage].slice(-MAX_MESSAGES);
		typingMessageIndex = messages.length - 1;
		await scrollToBottom();

		const chars = Array.from(reply || i18n.t('chat.emptyReply'));
		for (
			let index = TYPEWRITER_CHARS_PER_STEP;
			index < chars.length;
			index += TYPEWRITER_CHARS_PER_STEP
		) {
			if (typingRunId !== runId || typingMessageIndex === null) return;
			const content = chars.slice(0, index).join('');
			messages = messages.map((message, messageIndex) =>
				messageIndex === typingMessageIndex ? { ...message, content } : message
			);
			await sleep(TYPEWRITER_STEP_MS);
		}

		if (typingRunId !== runId || typingMessageIndex === null) return;
		messages = messages.map((message, messageIndex) =>
			messageIndex === typingMessageIndex ? { ...message, content: chars.join('') } : message
		);
		typingMessageIndex = null;
		persistMessages();
	}

	async function sendMessage() {
		const text = input.trim();
		if (!text || loading || typingMessageIndex !== null) return;
		const userMessage: ChatMessage = { role: 'user', content: text };
		error = '';
		input = '';
		messages = [...messages, userMessage].slice(-MAX_MESSAGES);
		loading = true;
		persistMessages();
		await scrollToBottom();

		try {
			const response = await fetch('/assistant/chat', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					messages,
					context: readDashboardContext()
				})
			});
			const data = (await response.json().catch(() => ({}))) as ChatResponse;
			if (!response.ok) throw new Error(data.error ?? i18n.t('chat.error'));
			loading = false;
			await typeAssistantReply(data.reply ?? i18n.t('chat.emptyReply'));
		} catch (err) {
			typingMessageIndex = null;
			error = err instanceof Error ? err.message : i18n.t('chat.error');
		} finally {
			loading = false;
		}
	}

	function clearChat() {
		typingRunId += 1;
		typingMessageIndex = null;
		messages = [{ role: 'assistant', content: i18n.t('chat.welcome') }];
		error = '';
		persistMessages();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter' || e.shiftKey) return;
		e.preventDefault();
		void sendMessage();
	}

	onMount(() => {
		if (!browser) return;
		try {
			const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
			if (Array.isArray(stored) && stored.length) {
				messages = stored
					.filter(
						(message) =>
							message &&
							(message.role === 'user' || message.role === 'assistant') &&
							typeof message.content === 'string'
					)
					.slice(-MAX_MESSAGES);
			}
		} catch {
			// ignore malformed chat history
		}
	});
</script>

<div class="fixed right-3 bottom-3 z-[60] sm:right-5 sm:bottom-5">
	{#if open}
		<section
			class="surface-shell border-border mb-3 flex h-[min(34rem,calc(100vh-6rem))] w-[calc(100vw-1.5rem)] max-w-[24rem] flex-col overflow-hidden rounded-lg border shadow-2xl"
			aria-label={i18n.t('chat.title')}
		>
			<header class="border-border flex items-center justify-between gap-3 border-b px-3 py-2.5">
				<div class="flex min-w-0 items-center gap-2">
					<div
						class="bg-primary/15 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg"
					>
						<BotIcon class="size-4" />
					</div>
					<div class="min-w-0">
						<h2 class="truncate text-sm font-semibold">{i18n.t('chat.title')}</h2>
						<p class="text-muted-foreground truncate text-xs">{i18n.t('chat.subtitle')}</p>
					</div>
				</div>
				<div class="flex items-center gap-1">
					<Button variant="ghost" size="sm" title={i18n.t('chat.clear')} onclick={clearChat}
						>{i18n.t('chat.clear')}</Button
					>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={i18n.t('chat.close')}
						title={i18n.t('chat.close')}
						onclick={() => (open = false)}
					>
						<XIcon class="size-4" />
					</Button>
				</div>
			</header>

			<div bind:this={viewport} class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
				{#each messages as message, index (`${message.role}-${index}`)}
					<div class={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
						<div
							class={cn(
								'max-w-[88%] rounded-lg px-3 py-2 text-sm leading-relaxed',
								message.role === 'user'
									? 'bg-primary text-primary-foreground'
									: 'bg-muted/70 text-foreground'
							)}
						>
							{#if message.role === 'user'}
								<div class="whitespace-pre-line">{message.content}</div>
							{:else if message.content}
								<div class="space-y-2">
									{#each renderMessageContent(message.content) as line, lineIndex (`${index}-${lineIndex}`)}
										{#if line.kind === 'blank'}
											<div class="h-1"></div>
										{:else if line.kind === 'ordered' || line.kind === 'unordered'}
											<div class="grid grid-cols-[1.5rem_1fr] gap-1">
												<span class="text-muted-foreground tabular-nums">{line.marker}</span>
												<span>
													{#each line.parts as part}
														{#if part.strong}
															<strong class="font-semibold">{part.text}</strong>
														{:else}
															{part.text}
														{/if}
													{/each}
												</span>
											</div>
										{:else}
											<p>
												{#each line.parts as part}
													{#if part.strong}
														<strong class="font-semibold">{part.text}</strong>
													{:else}
														{part.text}
													{/if}
												{/each}
											</p>
										{/if}
									{/each}
									{#if typingMessageIndex === index}
										<span
											class="bg-primary ml-0.5 inline-block h-4 w-1 animate-pulse align-[-0.125rem]"
										></span>
									{/if}
								</div>
							{:else}
								<span class="bg-primary inline-block h-4 w-1 animate-pulse align-[-0.125rem]"
								></span>
							{/if}
						</div>
					</div>
				{/each}
				{#if loading}
					<div class="text-muted-foreground flex items-center gap-2 text-sm">
						<Loader2Icon class="size-4 animate-spin" />
						{i18n.t('chat.thinking')}
					</div>
				{/if}
			</div>

			{#if error}
				<div class="border-border bg-destructive/10 text-destructive border-t px-3 py-2 text-xs">
					{error}
				</div>
			{/if}

			<form
				class="border-border flex items-end gap-2 border-t p-3"
				onsubmit={(e) => {
					e.preventDefault();
					void sendMessage();
				}}
			>
				<textarea
					bind:value={input}
					rows="2"
					class="border-input bg-input/40 focus-visible:border-ring focus-visible:ring-ring/50 min-h-10 flex-1 resize-none rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
					placeholder={i18n.t('chat.placeholder')}
					onkeydown={handleKeydown}
				></textarea>
				<Button
					size="icon-lg"
					aria-label={i18n.t('chat.send')}
					title={i18n.t('chat.send')}
					disabled={loading || typingMessageIndex !== null || !input.trim()}
				>
					{#if loading}
						<Loader2Icon class="size-4 animate-spin" />
					{:else}
						<SendIcon class="size-4" />
					{/if}
				</Button>
			</form>
		</section>
	{/if}

	<Button
		size="icon-lg"
		class="size-12 rounded-lg shadow-2xl"
		aria-label={i18n.t('chat.open')}
		title={i18n.t('chat.open')}
		onclick={() => {
			open = !open;
			if (!open) return;
			void scrollToBottom();
		}}
	>
		<MessageCircleIcon class="size-5" />
	</Button>
</div>
