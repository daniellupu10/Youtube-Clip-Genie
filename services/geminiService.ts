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
  const startIndex = text.indexOf('[');
  const endIndex = text.lastIndexOf(']');

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    console.error("Could not find a valid JSON array in the AI response.", text);
    throw new Error("The AI returned a response that did not contain a valid JSON array.");
  }

  const jsonString = text.substring(startIndex, endIndex + 1);

  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed)) {
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

export const generateClipsFromTranscript = async (transcript: string): Promise<Omit<Clip, 'videoId'>[]> => {
  const systemInstruction = `You are a YouTube content strategist. Your primary function is to analyze a video transcript and generate data for several short, engaging clips based on the video's most significant moments.

**CRITICAL DIRECTIVE: Ground your entire output in the provided transcript. Do NOT invent content or use outside knowledge.**

Follow this mandatory process:

1.  **ANALYZE THE TRANSCRIPT:** You will be given a full text transcript of a YouTube video.

2.  **IDENTIFY KEY HIGHLIGHTS:** From the transcript, identify 2 to 5 of the most significant moments. A highlight should be a self-contained, valuable segment. These highlights will become the clips.

3.  **GENERATE CLIP DATA:** For each highlight, create a JSON object. The 'title', 'description', and 'tags' MUST be directly inspired by the content of that specific video segment.
    *   \`title\`: Create an engaging, "clickbait-style" title or a compelling question that is answered in the clip.
    *   \`description\`: A short, 1-2 sentence summary of what is discussed in this specific clip segment.
    *   \`tags\`: An array of 3-5 relevant keywords taken directly from the clip's content.
    *   \`startTime\`: The precise start time of the highlight in "MM:SS" or "HH:MM:SS" format. This must be accurate.
    *   \`endTime\`: The precise end time of the highlight in "MM:SS" or "HH:MM:SS" format. This must be accurate.

4.  **FINAL OUTPUT:** Your entire response must be ONLY a single, valid JSON array of these clip objects. Do not include any other text, explanations, or markdown. Your response must start with \`[\` and end with \`]\`.`;
  
  const prompt = `Analyze the following YouTube video transcript and generate the highlight clips as a JSON array:\n\nTRANSCRIPT:\n"""\n${transcript}\n"""`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
      },
    });

    const clips = extractJsonArray(response.text);
    return clips;

  } catch (error) {
    console.error("Error generating clips:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate clips from Gemini API: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating clips.");
  }
};
