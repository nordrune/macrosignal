import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';
import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

type ChatMessage = {
	role: 'user' | 'assistant';
	content: string;
};

type ChatRequest = {
	messages?: ChatMessage[];
	context?: Record<string, unknown>;
};

type GeminiInteractionResponse = {
	output_text?: string;
	error?: { code?: number; message?: string; status?: string };
	steps?: Array<{
		output?: Array<{ type?: string; text?: string }>;
	}>;
};

type VertexGenerateContentResponse = {
	error?: { code?: number; message?: string; status?: string };
	candidates?: Array<{
		content?: {
			parts?: Array<{ text?: string }>;
		};
	}>;
};

type OAuthTokenResponse = {
	access_token?: string;
	expires_in?: number;
	error?: string;
	error_description?: string;
};

type MetadataTokenResponse = OAuthTokenResponse;

type AdcCredentials = {
	type?: string;
	client_id?: string;
	client_secret?: string;
	refresh_token?: string;
	client_email?: string;
	private_key?: string;
	quota_project_id?: string;
	project_id?: string;
};

type ApiKeyAuth = {
	ok: true;
	headers: Record<string, string>;
	source: 'api-key';
};

type AdcAuth = {
	ok: true;
	headers: Record<string, string>;
	source: 'adc';
	projectId?: string;
};

type AuthResult =
	| ApiKeyAuth
	| AdcAuth
	| {
			ok: false;
			error: string;
	  };

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_VERTEX_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_VERTEX_LOCATION = 'us-central1';
const MAX_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 1600;
const ADC_SCOPES = 'https://www.googleapis.com/auth/cloud-platform';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const METADATA_BASE_URL = 'http://metadata.google.internal/computeMetadata/v1';

let adcTokenCache:
	| {
			accessToken: string;
			expiresAt: number;
			quotaProject?: string;
	  }
	| undefined;

const APP_CONTEXT = `
MacroSignal is an educational trading strategy backtester.
Core capabilities:
- Load historical market data for one asset through Yahoo Finance symbols.
- Search a curated preset catalog of stocks, ETFs, crypto, indices, forex, and commodities.
- Upload or paste CSV price data with date and close columns.
- Configure multiple simulation tabs; each tab keeps its own settings and results.
- Select a single asset or toggle a saved portfolio. Portfolio and asset are mutually exclusive for a run.
- Build multiple saved portfolios with assets and weights. Portfolio price series are calculated by loading each asset, aligning overlapping dates, normalizing every asset to 100 at its first point, then combining them by weight.
- Normalize portfolio weights to 100% while preserving ratios.
- Configure strategy type, window/parameter, start capital, transaction fee, period, interval, and auto-run.
- Strategies include SMA, EMA, RSI, MACD, Bollinger Bands, and SMA crossover.
- Results include capital, P/L, Sharpe ratio, max drawdown, win rate, buy-and-hold return, chart, trades, analysis, optimizer, and export.
Important boundaries:
- MacroSignal is educational. It does not provide live trading, broker execution, personalized investment advice, or guarantees.
- Explain concepts clearly, but avoid telling users exactly what to buy or sell.
- For app help, give concrete UI steps. For trading concepts, explain assumptions, risk, and limitations.
`;

function cleanMessage(message: ChatMessage): ChatMessage {
	return {
		role: message.role === 'assistant' ? 'assistant' : 'user',
		content: String(message.content ?? '').slice(0, MAX_MESSAGE_CHARS)
	};
}

function extractText(data: GeminiInteractionResponse): string {
	if (data.output_text) return data.output_text;
	for (const step of data.steps ?? []) {
		const text = step.output
			?.filter((part) => part.type === 'text' && part.text)
			.map((part) => part.text)
			.join('');
		if (text) return text;
	}
	return '';
}

function extractVertexText(data: VertexGenerateContentResponse): string {
	return (
		data.candidates
			?.flatMap((candidate) => candidate.content?.parts ?? [])
			.map((part) => part.text ?? '')
			.join('')
			.trim() ?? ''
	);
}

function parseGeminiResponse(raw: string): GeminiInteractionResponse {
	try {
		const parsed = JSON.parse(raw) as GeminiInteractionResponse | GeminiInteractionResponse[];
		if (Array.isArray(parsed)) return parsed.find((item) => item.error) ?? {};
		return parsed;
	} catch {
		return {};
	}
}

function formatGeminiError(
	data: GeminiInteractionResponse,
	raw: string,
	status: number,
	authSource: 'api-key'
): string {
	const base = data.error?.message || raw.slice(0, 300) || `Gemini request failed with ${status}.`;
	void authSource;
	return base;
}

function formatVertexError(
	data: VertexGenerateContentResponse,
	raw: string,
	status: number,
	projectId: string
): string {
	const base =
		data.error?.message || raw.slice(0, 300) || `Vertex AI request failed with ${status}.`;
	if (status === 403 && base.includes('disabled')) {
		return `${base} Öffne die API-Aktivierung für das Projekt ${projectId}: https://console.cloud.google.com/apis/library/aiplatform.googleapis.com?project=${projectId}`;
	}
	return base;
}

function buildInput(messages: ChatMessage[], context: Record<string, unknown> | undefined): string {
	const transcript = messages
		.slice(-MAX_MESSAGES)
		.map(cleanMessage)
		.map(
			(message) => `${message.role === 'assistant' ? 'SignalScout' : 'User'}: ${message.content}`
		)
		.join('\n');
	const appState = context
		? `\nCurrent UI state JSON:\n${JSON.stringify(context).slice(0, 2500)}`
		: '';
	return `${transcript}${appState}\nSignalScout:`;
}

function getAdcFilePath(): string {
	if (env.GOOGLE_APPLICATION_CREDENTIALS) return env.GOOGLE_APPLICATION_CREDENTIALS;
	if (process.platform === 'win32' && process.env.APPDATA) {
		return join(process.env.APPDATA, 'gcloud', 'application_default_credentials.json');
	}
	return join(homedir(), '.config', 'gcloud', 'application_default_credentials.json');
}

function getQuotaProject(credentials?: AdcCredentials): string | undefined {
	return (
		env.GOOGLE_CLOUD_PROJECT ||
		env.GCLOUD_PROJECT ||
		env.GOOGLE_PROJECT_ID ||
		credentials?.quota_project_id ||
		credentials?.project_id
	);
}

async function readAdcCredentials(): Promise<AdcCredentials | undefined> {
	try {
		return JSON.parse(await readFile(getAdcFilePath(), 'utf8')) as AdcCredentials;
	} catch {
		return undefined;
	}
}

async function fetchToken(params: URLSearchParams): Promise<OAuthTokenResponse> {
	const response = await fetch(OAUTH_TOKEN_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: params
	});
	return (await response.json().catch(() => ({}))) as OAuthTokenResponse;
}

async function refreshAuthorizedUserToken(
	credentials: AdcCredentials
): Promise<OAuthTokenResponse> {
	if (!credentials.client_id || !credentials.client_secret || !credentials.refresh_token) {
		return { error_description: 'ADC authorized_user credentials are incomplete.' };
	}
	return fetchToken(
		new URLSearchParams({
			client_id: credentials.client_id,
			client_secret: credentials.client_secret,
			refresh_token: credentials.refresh_token,
			grant_type: 'refresh_token'
		})
	);
}

function createServiceAccountAssertion(credentials: AdcCredentials): string | undefined {
	if (!credentials.client_email || !credentials.private_key) return undefined;
	const now = Math.floor(Date.now() / 1000);
	const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
	const payload = Buffer.from(
		JSON.stringify({
			iss: credentials.client_email,
			scope: ADC_SCOPES,
			aud: OAUTH_TOKEN_URL,
			iat: now,
			exp: now + 3600
		})
	).toString('base64url');
	const unsigned = `${header}.${payload}`;
	const signature = createSign('RSA-SHA256')
		.update(unsigned)
		.end()
		.sign(credentials.private_key)
		.toString('base64url');
	return `${unsigned}.${signature}`;
}

async function refreshServiceAccountToken(
	credentials: AdcCredentials
): Promise<OAuthTokenResponse> {
	const assertion = createServiceAccountAssertion(credentials);
	if (!assertion) return { error_description: 'ADC service_account credentials are incomplete.' };
	return fetchToken(
		new URLSearchParams({
			assertion,
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer'
		})
	);
}

async function readMetadata(path: string): Promise<unknown> {
	const response = await fetch(`${METADATA_BASE_URL}/${path}`, {
		headers: { 'Metadata-Flavor': 'Google' },
		signal: AbortSignal.timeout(1200)
	});
	if (!response.ok) return undefined;
	const contentType = response.headers.get('content-type') ?? '';
	if (contentType.includes('application/json')) return response.json();
	return response.text();
}

async function getMetadataAuth(): Promise<AuthResult | undefined> {
	try {
		const token = (await readMetadata(
			'instance/service-accounts/default/token'
		)) as MetadataTokenResponse;
		if (!token?.access_token) return undefined;
		const projectId =
			env.GOOGLE_CLOUD_PROJECT ||
			env.GCLOUD_PROJECT ||
			env.GOOGLE_PROJECT_ID ||
			((await readMetadata('project/project-id')) as string | undefined);
		adcTokenCache = {
			accessToken: token.access_token,
			expiresAt: Date.now() + Math.max((token.expires_in ?? 300) - 60, 60) * 1000,
			quotaProject: projectId
		};
		return buildBearerAuthHeaders(adcTokenCache.accessToken, adcTokenCache.quotaProject);
	} catch {
		return undefined;
	}
}

function buildBearerAuthHeaders(accessToken: string, quotaProject?: string): AuthResult {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${accessToken}`
	};
	if (quotaProject) headers['x-goog-user-project'] = quotaProject;
	return { ok: true, headers, source: 'adc', projectId: quotaProject };
}

async function getAdcAuthHeaders(): Promise<AuthResult> {
	if (adcTokenCache && adcTokenCache.expiresAt > Date.now()) {
		return buildBearerAuthHeaders(adcTokenCache.accessToken, adcTokenCache.quotaProject);
	}

	const credentials = await readAdcCredentials();
	if (!credentials) {
		const metadataAuth = await getMetadataAuth();
		return (
			metadataAuth ?? {
				ok: false,
				error:
					'Gemini is not configured. Set GEMINI_API_KEY or run Google Application Default Credentials setup, then restart the web server.'
			}
		);
	}

	let token: OAuthTokenResponse;
	if (credentials.type === 'authorized_user') {
		token = await refreshAuthorizedUserToken(credentials);
	} else if (credentials.type === 'service_account') {
		token = await refreshServiceAccountToken(credentials);
	} else {
		return {
			ok: false,
			error: `Unsupported ADC credential type "${credentials.type ?? 'unknown'}". Use gcloud application-default login or a service account JSON file.`
		};
	}

	if (!token.access_token) {
		return {
			ok: false,
			error:
				token.error_description || token.error || 'Could not create an ADC access token for Gemini.'
		};
	}

	adcTokenCache = {
		accessToken: token.access_token,
		expiresAt: Date.now() + Math.max((token.expires_in ?? 3600) - 60, 60) * 1000,
		quotaProject: getQuotaProject(credentials)
	};
	return buildBearerAuthHeaders(adcTokenCache.accessToken, adcTokenCache.quotaProject);
}

async function getGeminiAuthHeaders(): Promise<AuthResult> {
	if (env.GEMINI_API_KEY) {
		return {
			ok: true,
			source: 'api-key',
			headers: {
				'x-goog-api-key': env.GEMINI_API_KEY
			}
		};
	}
	return getAdcAuthHeaders();
}

async function callGeminiDeveloperApi(
	auth: ApiKeyAuth,
	messages: ChatMessage[],
	context: Record<string, unknown> | undefined
): Promise<Response> {
	const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			...auth.headers
		},
		body: JSON.stringify({
			model: env.GEMINI_MODEL || DEFAULT_MODEL,
			system_instruction: `You are SignalScout, the concise in-app help assistant for MacroSignal. Answer in the user language. Be practical, accurate, and explicit about uncertainty. Do not give personalized financial advice. If a question is about using MacroSignal, explain the exact app workflow.\n${APP_CONTEXT}`,
			input: buildInput(messages, context),
			generation_config: {
				thinking_level: 'low',
				temperature: 0.35,
				max_output_tokens: 700
			}
		})
	});

	const raw = await response.text();
	const data = parseGeminiResponse(raw);
	if (!response.ok) {
		return json(
			{ error: formatGeminiError(data, raw, response.status, auth.source) },
			{ status: response.status }
		);
	}

	const reply = extractText(data).trim();
	return json({
		reply:
			reply ||
			'Ich konnte gerade keine brauchbare Antwort generieren. Bitte stelle die Frage etwas konkreter.'
	});
}

async function callVertexAi(
	auth: AdcAuth,
	messages: ChatMessage[],
	context: Record<string, unknown> | undefined
): Promise<Response> {
	const projectId = env.VERTEX_PROJECT_ID || auth.projectId;
	if (!projectId) {
		return json(
			{
				error:
					'ADC is configured, but no Google Cloud project was found. Set VERTEX_PROJECT_ID or GOOGLE_CLOUD_PROJECT and restart the web server.'
			},
			{ status: 503 }
		);
	}

	const location = env.VERTEX_LOCATION || DEFAULT_VERTEX_LOCATION;
	const model = env.VERTEX_MODEL || env.GEMINI_MODEL || DEFAULT_VERTEX_MODEL;
	const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			...auth.headers
		},
		body: JSON.stringify({
			systemInstruction: {
				parts: [
					{
						text: `You are SignalScout, the concise in-app help assistant for MacroSignal. Answer in the user language. Be practical, accurate, and explicit about uncertainty. Do not give personalized financial advice. If a question is about using MacroSignal, explain the exact app workflow.\n${APP_CONTEXT}`
					}
				]
			},
			contents: [
				{
					role: 'user',
					parts: [{ text: buildInput(messages, context) }]
				}
			],
			generationConfig: {
				temperature: 0.35,
				maxOutputTokens: 700
			}
		})
	});

	const raw = await response.text();
	const data = JSON.parse(raw || '{}') as VertexGenerateContentResponse;
	if (!response.ok) {
		return json(
			{ error: formatVertexError(data, raw, response.status, projectId) },
			{ status: response.status }
		);
	}

	const reply = extractVertexText(data);
	return json({
		reply:
			reply ||
			'Ich konnte gerade keine brauchbare Antwort generieren. Bitte stelle die Frage etwas konkreter.'
	});
}

export const POST: RequestHandler = async ({ request }) => {
	const auth = await getGeminiAuthHeaders();
	if (!auth.ok) return json({ error: auth.error }, { status: 503 });

	const body = (await request.json().catch(() => ({}))) as ChatRequest;
	const messages = Array.isArray(body.messages) ? body.messages.map(cleanMessage) : [];
	const last = messages.at(-1);
	if (!last || last.role !== 'user' || last.content.trim().length === 0) {
		return json({ error: 'Send at least one user message.' }, { status: 400 });
	}

	return auth.source === 'api-key'
		? callGeminiDeveloperApi(auth, messages, body.context)
		: callVertexAi(auth, messages, body.context);
};
