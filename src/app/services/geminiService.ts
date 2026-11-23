// src/app/services/geminiService.ts

export interface GeminiMessage {
  role: 'user' | 'model';
  text: string;
}

export interface GeminiRequestOptions {
  systemInstruction?: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

let runtimeApiKey = '';
let stickyModel: string | null = null;

const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
];
const IMAGE_EDIT_MODELS = [
  'gemini-3.1-flash-lite-image',
  'gemini-3.1-flash-image',
];

const DEFAULT_TIMEOUT_MS = 24000;
const MAX_ATTEMPT_TIMEOUT_MS = 10000;
const MAX_HISTORY_TURNS = 10;
let stickyImageModel: string | null = null;

function readLocalSecretsKey(): string {
  try {
    const localModule = require('../config/secrets.local');
    const key =
      localModule?.GEMINI_API_KEY ||
      localModule?.LOCAL_GEMINI_KEY ||
      '';
    return typeof key === 'string' ? key.trim() : '';
  } catch {
    return '';
  }
}

function resolveApiKey(): string {
  if (runtimeApiKey.trim()) {
    return runtimeApiKey.trim();
  }

  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  const envObj = runtime.process?.env || {};

  const fromEnv =
    envObj.GEMINI_API_KEY ||
    envObj.EXPO_PUBLIC_GEMINI_API_KEY ||
    envObj.GOOGLE_API_KEY ||
    '';

  if (String(fromEnv).trim()) {
    return String(fromEnv).trim();
  }

  return readLocalSecretsKey();
}

export function setGeminiRuntimeApiKey(key: string): void {
  runtimeApiKey = (key || '').trim();
}

export function hasGeminiApiKey(): boolean {
  return resolveApiKey().length > 0;
}

export function buildUserDirectedImageEditPrompt(
  userRequirements: string,
  optionalStyle?: string
): string {
  const requirements = userRequirements.trim();
  if (!requirements) {
    throw new Error('Describe the photo edit you want.');
  }

  return [
    'Edit the supplied photo itself and return the edited image.',
    `The user's requested changes are the highest priority. Apply these requirements: ${requirements}`,
    optionalStyle
      ? `Optional style preference: ${optionalStyle}. Apply it only when it does not conflict with the user's requirements.`
      : '',
    'Preserve the original subject, identity, scene, and composition unless the user explicitly requests a change.',
    'Do not add, remove, or replace objects or apply an unrelated visual style unless the user asks for it.',
    'Return the edited image with a brief description of the changes.',
  ]
    .filter(Boolean)
    .join('\n');
}

function getOrderedModels(): string[] {
  if (!stickyModel) return CANDIDATE_MODELS;
  return [stickyModel, ...CANDIDATE_MODELS.filter((m) => m !== stickyModel)];
}

function getOrderedImageModels(): string[] {
  if (!stickyImageModel) return IMAGE_EDIT_MODELS;
  return [
    stickyImageModel,
    ...IMAGE_EDIT_MODELS.filter((model) => model !== stickyImageModel),
  ];
}

function isImageQuotaError(status: number, message: string): boolean {
  return (
    status === 429 &&
    /quota|free.?tier|limit:\s*0|resource_exhausted/i.test(message)
  );
}

function extractReplyText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

async function fetchWithTimeout(
  url: string,
  payload: Record<string, any>,
  timeoutMs: number,
  apiKey: string,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

export async function sendMessageToGemini(
  history: GeminiMessage[],
  systemInstructionOrOptions?: string | GeminiRequestOptions
): Promise<string> {
  const options: GeminiRequestOptions =
    typeof systemInstructionOrOptions === 'string'
      ? { systemInstruction: systemInstructionOrOptions }
      : systemInstructionOrOptions || {};

  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error(
      'Gemini API key is missing. Add GEMINI_API_KEY to src/app/config/secrets.local.ts or set GEMINI_API_KEY.'
    );
  }

  const normalizedHistory = history
    .filter(
      (item) =>
        item && typeof item.text === 'string' && item.text.trim().length > 0
    )
    .slice(-MAX_HISTORY_TURNS)
    .map((item) => ({
      role: item.role === 'model' ? 'model' : 'user',
      parts: [{ text: item.text.trim() }],
    }));

  while (normalizedHistory[0]?.role === 'model') {
    normalizedHistory.shift();
  }

  if (normalizedHistory.length === 0) {
    throw new Error('Please enter a message before sending.');
  }

  if (normalizedHistory[normalizedHistory.length - 1].role !== 'user') {
    normalizedHistory.push({
      role: 'user',
      parts: [{ text: 'Please respond clearly and concisely.' }],
    });
  }

  const payload: Record<string, any> = {
    contents: normalizedHistory,
    generationConfig: {
      maxOutputTokens: options.maxOutputTokens ?? 1024,
    },
  };

  if (options.systemInstruction && options.systemInstruction.trim().length > 0) {
    payload.systemInstruction = {
      parts: [{ text: options.systemInstruction.trim() }],
    };
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastError: Error = new Error('Unable to get response from Gemini.');
  const models = getOrderedModels();
  const startedAt = Date.now();

  for (const model of models) {
    if (options.signal?.aborted) {
      throw new Error('Request cancelled.');
    }

    const remainingMs = timeoutMs - (Date.now() - startedAt);
    if (remainingMs <= 0) {
      break;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    let response: Response;

    try {
      response = await fetchWithTimeout(
        endpoint,
        payload,
        Math.min(MAX_ATTEMPT_TIMEOUT_MS, remainingMs),
        apiKey,
        options.signal
      );
    } catch (err: unknown) {
      if (options.signal?.aborted) {
        throw new Error('Request cancelled.');
      }
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new Error(
          'Request timed out. Check your connection and tap Retry.'
        );
      } else if (err instanceof Error) {
        lastError = err;
      } else {
        lastError = new Error('Network error while contacting AI service.');
      }
      continue;
    }

    if (response.ok) {
      let data: any;
      try {
        data = await response.json();
      } catch {
        lastError = new Error('Gemini returned an unreadable response.');
        continue;
      }

      const reply = extractReplyText(data);
      if (!reply) {
        lastError = new Error('Gemini returned no text.');
        continue;
      }

      stickyModel = model;
      return reply;
    }

    let detail = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) {
        detail = errJson.error.message;
      }
    } catch {}

    if (response.status === 401 || response.status === 403) {
      throw new Error(`Gemini rejected the API key: ${detail}`);
    }

    lastError = new Error(detail);
    if (response.status === 404) {
      if (stickyModel === model) {
        stickyModel = null;
      }
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      continue;
    }

    throw lastError;
  }

  throw lastError;
}

export async function imageUriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Unable to read the selected image.');
  }

  const imageBlob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to read the selected image.'));
        return;
      }
      const base64 = reader.result.split(',')[1];
      if (!base64) {
        reject(new Error('Unable to read the selected image.'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.readAsDataURL(imageBlob);
  });
}

export async function editImageWithGemini(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  signal?: AbortSignal
): Promise<{ imageUri: string; description: string }> {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error(
      'Gemini API key is missing. Add GEMINI_API_KEY to src/app/config/secrets.local.ts or set GEMINI_API_KEY.'
    );
  }

  if (!imageBase64.trim() || !prompt.trim()) {
    throw new Error('An image and edit instruction are required.');
  }
  if (signal?.aborted) {
    throw new Error('Request cancelled.');
  }

  const startedAt = Date.now();
  let lastError: Error = new Error('Gemini did not return an edited image.');
  let quotaExceeded = false;
  let rateLimited = false;

  for (const model of getOrderedImageModels()) {
    if (signal?.aborted) {
      throw new Error('Request cancelled.');
    }

    const remainingMs = DEFAULT_TIMEOUT_MS - (Date.now() - startedAt);
    if (remainingMs <= 0) {
      break;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      Math.min(MAX_ATTEMPT_TIMEOUT_MS, remainingMs)
    );
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener('abort', onExternalAbort, { once: true });

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: prompt.trim() },
                  { inlineData: { mimeType, data: imageBase64 } },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
            },
          }),
          signal: controller.signal,
        }
      );
    } catch (error: unknown) {
      if (signal?.aborted) {
        throw new Error('Request cancelled.');
      }
      lastError =
        error instanceof Error && error.name === 'AbortError'
          ? new Error('Request timed out. Check your connection and try again.')
          : error instanceof Error
            ? error
            : new Error('Network error while contacting Gemini.');
      continue;
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onExternalAbort);
    }

    if (response.ok) {
      let data: any;
      try {
        data = await response.json();
      } catch {
        lastError = new Error('Gemini returned an unreadable image response.');
        continue;
      }

      const parts = data?.candidates?.[0]?.content?.parts;
      const imagePart = Array.isArray(parts)
        ? parts.find(
            (part: any) =>
              typeof part?.inlineData?.data === 'string' &&
              typeof part?.inlineData?.mimeType === 'string'
          )
        : undefined;

      if (!imagePart) {
        lastError = new Error('Gemini did not return an edited image.');
        continue;
      }

      stickyImageModel = model;
      return {
        imageUri: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
        description: parts
          .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
          .join('')
          .trim(),
      };
    }

    let detail = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) {
        detail = errJson.error.message;
      }
    } catch {}

    if (response.status === 401 || response.status === 403) {
      throw new Error(`Gemini rejected the API key: ${detail}`);
    }

    if (response.status === 429) {
      rateLimited = true;
      quotaExceeded = quotaExceeded || isImageQuotaError(response.status, detail);
    }
    lastError = new Error(detail);

    if (
      response.status === 404 ||
      response.status === 429 ||
      response.status >= 500
    ) {
      if (stickyImageModel === model) {
        stickyImageModel = null;
      }
      continue;
    }

    throw lastError;
  }

  if (quotaExceeded) {
    throw new Error(
      'Gemini image-edit quota is unavailable for this API key. Enable billing or wait for the image quota to reset, then try again.'
    );
  }
  if (rateLimited) {
    throw new Error(
      'Gemini image models are temporarily rate-limited. Wait a moment and try again.'
    );
  }

  throw lastError;
}

export async function generateImageCreativeSpec(
  userPrompt: string,
  style: string,
  aspectRatio: string,
  signal?: AbortSignal
): Promise<string> {
  return sendMessageToGemini(
    [
      {
        role: 'user',
        text: `Prompt: "${userPrompt.trim()}"\nStyle: ${style}\nAspect Ratio: ${aspectRatio}\nProvide a concise enhanced prompt plus lighting, composition, and color palette notes.`,
      },
    ],
    {
      systemInstruction:
        'You are a fast visual prompt director. Respond concisely with actionable image generation details.',
      maxOutputTokens: 512,
      signal,
    }
  );
}

export async function generateNanoBananaEditPlan(
  editInstruction: string,
  presetName?: string,
  signal?: AbortSignal
): Promise<string> {
  const contextLine = presetName ? `Preset: ${presetName}\n` : '';
  return sendMessageToGemini(
    [
      {
        role: 'user',
        text: `${contextLine}Photo Edit Request: "${editInstruction.trim()}"\nProvide clear step-by-step adjustments for exposure, color tone, sharpness, and visual refinement.`,
      },
    ],
    {
      systemInstruction:
        'You are a fast photo-editing assistant. Give clear, concise editing instructions without filler.',
      maxOutputTokens: 512,
      signal,
    }
  );
}