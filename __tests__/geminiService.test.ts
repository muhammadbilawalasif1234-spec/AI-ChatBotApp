jest.mock('../src/app/config/secrets.local', () => ({
  GEMINI_API_KEY: 'test-gemini-api-key',
}));

import {
  buildUserDirectedImageEditPrompt,
  editImageWithGemini,
  sendMessageToGemini,
} from '../src/app/services/geminiService';

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

test('does not inject a default style into a user-directed photo edit', () => {
  const prompt = buildUserDirectedImageEditPrompt('Remove the background.');

  expect(prompt).toContain(
    "The user's requested changes are the highest priority. Apply these requirements: Remove the background."
  );
  expect(prompt).not.toContain('professional photo editing');
});

test('sends conversation history and returns Gemini text', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: 'Hello' }, { text: ' there!' }] } }],
    }),
  });

  await expect(
    sendMessageToGemini([
      { role: 'user', text: 'Hi' },
      { role: 'model', text: 'Hello' },
      { role: 'user', text: 'How are you?' },
    ]),
  ).resolves.toBe('Hello there!');

  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toContain('models/gemini-3.5-flash-lite:generateContent');
  expect(options.headers['x-goog-api-key']).toBe('test-gemini-api-key');
  expect(url).not.toContain('test-gemini-api-key');
  expect(JSON.parse(options.body).contents).toHaveLength(3);
  expect(JSON.parse(options.body).generationConfig.maxOutputTokens).toBe(1024);
});

test('uses the fallback model only when the preferred model is unavailable', async () => {
  fetchMock
    .mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: { message: 'Model not found' } }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Fallback answer' }] } }],
      }),
    });

  await expect(
    sendMessageToGemini([{ role: 'user', text: 'Hello' }])
  ).resolves.toBe('Fallback answer');

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[0][0]).toContain('models/gemini-3.5-flash-lite:generateContent');
  expect(fetchMock.mock.calls[1][0]).toContain('models/gemini-3.8-flash:generateContent');
});

test('sends card guidance as a system instruction', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: 'Helpful answer' }] } }],
    }),
  });

  await sendMessageToGemini(
    [{ role: 'user', text: 'Help me plan a campaign.' }],
    'Act as a marketing assistant.'
  );

  const [, options] = fetchMock.mock.calls[0];
  expect(JSON.parse(options.body).systemInstruction).toEqual({
    parts: [{ text: 'Act as a marketing assistant.' }],
  });
});

test('starts a request with the first user turn when recent chat begins with an AI reply', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: 'Follow-up answer' }] } }],
    }),
  });

  await sendMessageToGemini([
    { role: 'model', text: 'Initial card greeting' },
    { role: 'user', text: 'Tell me more.' },
  ]);

  const [, options] = fetchMock.mock.calls[0];
  expect(JSON.parse(options.body).contents).toEqual([
    { role: 'user', parts: [{ text: 'Tell me more.' }] },
  ]);
});

test('edits the supplied image and returns Gemini image data', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [
              { text: 'Applied brighter natural lighting.' },
              { inlineData: { mimeType: 'image/png', data: 'edited-image' } },
            ],
          },
        },
      ],
    }),
  });

  await expect(
    editImageWithGemini('source-image', 'image/jpeg', 'Brighten this photo.')
  ).resolves.toEqual({
    imageUri: 'data:image/png;base64,edited-image',
    description: 'Applied brighter natural lighting.',
  });

  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toContain('models/gemini-3.1-flash-lite-image:generateContent');
  expect(options.headers['x-goog-api-key']).toBe('test-gemini-api-key');
  expect(url).not.toContain('test-gemini-api-key');
  const body = JSON.parse(options.body);
  expect(body.contents[0].parts).toEqual([
    { text: 'Brighten this photo.' },
    { inlineData: { mimeType: 'image/jpeg', data: 'source-image' } },
  ]);
  expect(body.generationConfig.responseModalities).toEqual(['TEXT', 'IMAGE']);
});

test('falls back to another image model when Gemini rejects the first model quota', async () => {
  fetchMock
    .mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({
        error: {
          message: 'Quota exceeded for free tier requests, limit: 0.',
        },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                { text: 'Edited.' },
                { inlineData: { mimeType: 'image/png', data: 'fallback-image' } },
              ],
            },
          },
        ],
      }),
    });

  await expect(
    editImageWithGemini('source-image', 'image/jpeg', 'Remove the background.')
  ).resolves.toEqual({
    imageUri: 'data:image/png;base64,fallback-image',
    description: 'Edited.',
  });

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[0][0]).toContain(
    'models/gemini-3.1-flash-lite-image:generateContent'
  );
  expect(fetchMock.mock.calls[1][0]).toContain(
    'models/gemini-3.1-flash-image:generateContent'
  );
});

test('explains that Gemini image editing requires billing when image quota is zero', async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    status: 429,
    json: async () => ({
      error: { message: 'Quota exceeded for free tier requests, limit: 0.' },
    }),
  });

  await expect(
    editImageWithGemini('source-image', 'image/jpeg', 'Remove the background.')
  ).rejects.toThrow(
    'Gemini image editing is unavailable because image models have no free-tier quota for this API project. Enable billing on the Google Cloud project linked to this API key, then try again.'
  );

  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('does not report success when Gemini omits an edited image', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: 'I could not edit this image.' }] } }],
    }),
  });

  await expect(
    editImageWithGemini('source-image', 'image/jpeg', 'Edit this photo.')
  ).rejects.toThrow('Gemini did not return an edited image');
});

test('reports invalid API keys instead of returning an error as a chat answer', async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({ error: { message: 'Forbidden' } }),
  });

  await expect(
    sendMessageToGemini([{ role: 'user', text: 'Hi' }]),
  ).rejects.toThrow('Gemini rejected the API key');
});

test('reports when Gemini returns no text', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [] } }] }),
  });

  await expect(
    sendMessageToGemini([{ role: 'user', text: 'Hi' }]),
  ).rejects.toThrow('Gemini returned no text');
});
