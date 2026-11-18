jest.mock('../src/app/config/gemini', () => ({
  GEMINI_API_KEY: 'test-gemini-api-key',
}));

import { sendMessageToGemini } from '../src/app/services/geminiService';

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
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
  expect(url).toContain('models/gemini-3.8-flash:generateContent');
  expect(url).toContain('key=test-gemini-api-key');
  expect(JSON.parse(options.body).contents).toHaveLength(3);
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
