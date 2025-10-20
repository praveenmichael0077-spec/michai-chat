import { GoogleGenAI, Chat, Content } from "@google/genai";

// Ensure the API key is available in the environment variables
if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// The systemInstruction should be a string, not an object. The object format is used for chat history.
const systemInstruction = "You are Michai, a friendly, cool, and slightly witty AI friend. Your personality is like a helpful dude. Keep your responses casual and relatively short, like you're texting a friend.";

export function createChatSession(history: Content[] = []): Chat {
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    history,
    config: {
      systemInstruction,
    }
  });
}