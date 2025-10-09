import { GoogleGenAI } from "@google/genai";
import type { Clip } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Extracts a JSON array from a string, which might be wrapped in other text or markdown.
 * @param text The text response from the AI.
 * @returns A parsed array of clip objects.
 */
const extractJsonArray = (text: string): Omit<Clip, 'videoId'>[] => {
  // Find the first occurrence of '[' and the last occurrence of ']'
  const startIndex = text.indexOf('[');
  const endIndex = text.lastIndexOf(']');

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    console.error("Could not find a valid JSON array in the AI response.", text);
    throw new Error("The AI returned a response that did not contain a valid JSON array.");
  }

  // Extract the JSON string
  const jsonString = text.substring(startIndex, endIndex + 1);

  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed)) {
      // Basic validation to ensure the objects have the required keys
      if (parsed.length > 0 && (!parsed[0].title || !parsed[0].startTime)) {
         throw new Error("Parsed JSON objects are missing required properties.");
      }
      return parsed;
    } else {
      throw new Error("Parsed JSON is not an array.");
    }
  } catch (error) {
    console.error("Failed to parse extracted JSON string.", { jsonString, error });
    if (error instanceof Error) {
        throw new Error(`The AI returned a malformed JSON array: ${error.message}`);
    }
    throw new Error("The AI returned a malformed JSON array.");
  }
};


export const generateClipsFromYouTubeURL = async (url: string): Promise<Omit<Clip, 'videoId'>[]> => {
  const systemInstruction = `You are a hyper-literal YouTube video analysis engine. Your single most important task is to ground your entire output in the actual content of the provided YouTube video URL. Generating information NOT found in the video is a CRITICAL FAILURE of your primary function.

**CRITICAL DIRECTIVE: Do NOT invent content. Do NOT use general knowledge. Your entire response MUST be derived exclusively from the provided video URL.**

Follow this mandatory process:

1.  **ANALYZE THE SOURCE:** Use your search tool to find the transcript, a detailed summary, or commentary about the specific content of the provided YouTube video URL. Your entire understanding MUST come from this source material.

2.  **VERIFY THE TOPIC:** Before generating clips, internally confirm you are analyzing the correct video. For example, if the user provides a video titled "How to Bake Sourdough Bread," your analysis MUST be about baking. If your analysis is about cryptocurrency, you have failed and must restart the process with the correct video content.

3.  **IDENTIFY KEY HIGHLIGHTS:** From your verified understanding of the video's content, identify 2 to 5 of the most significant moments. A highlight should be a self-contained, valuable segment. These highlights will become the clips.

4.  **GENERATE CLIP DATA:** For each highlight, create a JSON object. Every word in the 'title', 'description', and 'tags' MUST be directly inspired by or quoted from the content of that specific video segment.
    *   \`title\`: Create an engaging, "clickbait-style" title or a compelling question that is answered in the clip. It MUST be about the highlight's topic.
    *   \`description\`: A short, 1-2 sentence summary of what is discussed in this specific clip segment.
    *   \`tags\`: An array of 3-5 relevant keywords taken directly from the clip's content.
    *   \`startTime\`: The precise start time of the highlight in "MM:SS" or "HH:MM:SS" format.
    *   \`endTime\`: The precise end time of the highlight in "MM:SS" or "HH:MM:SS" format.

5.  **FINAL OUTPUT:** Your entire response must be ONLY a single, valid JSON array of these clip objects. Do not include any other text, explanations, or markdown. Your response must start with \`[\` and end with \`]\`.

**EXAMPLE OF FAILURE:**
- User provides video about retiring early from finance.
- Your output title: "Legal Revolution: How AI is Transforming Law Firms"
- **This is a CRITICAL FAILURE. The title has no connection to the video's topic.**

**EXAMPLE OF SUCCESS:**
- User provides video about retiring early from finance.
- Your output title: "The 7-Year Plan to Retire Sooner Than You Thought Possible"
- **This is SUCCESSFUL. The title is directly related to the video's topic.**`;
  
  const prompt = `Analyze this YouTube video and generate highlight clips: ${url}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        tools: [{googleSearch: {}}],
      },
    });

    return extractJsonArray(response.text);

  } catch (error) {
    console.error("Error generating clips:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate clips from Gemini API: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating clips.");
  }
};