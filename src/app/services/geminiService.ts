// src/services/geminiService.ts

export interface GeminiMessage {
  role: 'user' | 'model';
  text: string;
}

const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY';

export async function sendMessageToGemini(messages: GeminiMessage[]): Promise<string> {
  try {
    const recentMessages = messages.slice(-8);

    const formattedContents = recentMessages.map((msg) => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    }));

    // Updated to the latest available flash model as requested by Google API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: formattedContents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });

    const data = await response.json();

    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }

    if (data?.error?.message) {
      throw new Error(data.error.message);
    }

    throw new Error('Invalid response from Gemini API');
  } catch (error: any) {
    console.warn('[GeminiService] Error:', error.message);
    throw error;
  }
}