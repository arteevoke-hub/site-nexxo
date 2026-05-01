const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'What is the weather in Boston?',
      tools: [{
          functionDeclarations: [{
              name: 'get_current_weather',
              description: 'Get the current weather in a given location',
              parameters: {
                  type: "OBJECT",
                  properties: {
                      location: {
                          type: "STRING",
                          description: 'The city and state, e.g. San Francisco, CA',
                      },
                  },
                  required: ['location'],
              },
          }],
      }],
  });
  console.log('candidates:', JSON.stringify(response.candidates?.[0]));
}
test();
