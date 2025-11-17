import { GoogleGenAI } from "@google/genai";
import type { Clip } from '../types';
import type { UserPlan } from '../types';
import type { TranscriptSegment } from './transcriptService';


if (!process.env.API_KEY) {
    console.error("GEMINI API_KEY is missing! Please check your environment variables.");
    throw new Error("API_KEY environment variable is not set. Please configure GEMINI_API_KEY in your GitHub repository secrets.");
}

console.log("Gemini API initialized successfully");
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const timeToSeconds = (time: string): number => {
    if (!time || !time.includes(':')) return NaN;
    const parts = time.split(':').map(Number);
    if (parts.some(isNaN)) return NaN;

    if (parts.length === 2) { // MM:SS
        return (parts[0] * 60) + parts[1];
    }
    if (parts.length === 3) { // HH:MM:SS
        return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    }
    return NaN;
};


/**
 * Extracts a JSON array from a string, which might be wrapped in other text or markdown.
 * @param text The text response from the AI.
 * @returns A parsed array of clip objects.
 */
const extractJsonArray = (text: string): Omit<Clip, 'videoId' | 'transcript'>[] => {
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

const getSystemInstruction = (plan: UserPlan): string => {
  let planSpecificInstruction: string;

  switch (plan) {
    case 'free':
      planSpecificInstruction = `You MUST NOT generate more than 5 clips. This is a strict limit.`;
      break;
    case 'casual':
      planSpecificInstruction = `You can generate up to 20 clips if there are that many distinct segments.`;
      break;
    case 'mastermind':
      planSpecificInstruction = `You can generate up to 50 clips if there are that many distinct segments.`;
      break;
    default:
        planSpecificInstruction = `You MUST NOT generate more than 5 clips. This is a strict limit.`;
  }


  return `You are an expert YouTube video producer. Your task is to analyze a video transcript and identify and extract meaningful, self-contained segments.

**CRITICAL DIRECTIVE: Ground your entire output in the provided transcript. Do NOT invent content or use outside knowledge.**

Follow this mandatory process:

1.  **IDENTIFY KEY SEGMENTS:** Scan the transcript to find distinct sections where a complete topic, story, or idea is discussed. These will become your clips.

2.  **ENFORCE DURATION RULE:** Each segment you select **MUST** have a duration between **1 minute (01:00)** and **10 minutes (10:00)**. This is a strict requirement. Do not generate clips shorter than 1 minute or longer than 10 minutes.

3.  **PLAN-BASED CLIP LIMIT:** ${planSpecificInstruction}

4.  **GENERATE CLIP DATA:** For each valid segment, create a JSON object with the following properties:
    *   \`title\`: Create an irresistible, "clickbait" title that accurately reflects the content of the segment. It MUST be either a **shocking statement** or an **intriguing question** that the clip answers.
        *   *Example Style 1 (Question):* "Why is This Common Advice Actually Wrong?"
        *   *Example Style 2 (Statement):* "You've Been Wasting Your Money on This All Along."
        *   *AVOID BORING TITLES* like "Segment on Topic X".
    *   \`description\`: A short, 1-2 sentence summary of what is revealed or discussed in this specific clip.
    *   \`tags\`: An array of 3-5 relevant keywords taken directly from the clip's content.
    *   \`startTime\` & \`endTime\`: These MUST be precise timestamps marking the beginning and end of the identified segment. The total duration between these timestamps must adhere to the 1-10 minute rule.

5.  **FINAL OUTPUT:** Your entire response must be ONLY a single, valid JSON array of these clip objects. Do not include any other text, explanations, or markdown. Your response must start with \`[\` and end with \`]\`.`;
}


export const generateClipsFromTranscript = async (transcript: string, transcriptSegments: TranscriptSegment[], plan: UserPlan): Promise<Omit<Clip, 'videoId'>[]> => {
  const systemInstruction = getSystemInstruction(plan);
  
  const prompt = `Analyze the following YouTube video transcript and generate the highlight clips as a JSON array:\n\nTRANSCRIPT:\n"""\n${transcript}\n"""`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
      },
    });

    const clipsFromAi = extractJsonArray(response.text);
    
    const clipsWithTranscripts = clipsFromAi.map(clip => {
        const startSeconds = timeToSeconds(clip.startTime);
        const endSeconds = timeToSeconds(clip.endTime);

        if (isNaN(startSeconds) || isNaN(endSeconds)) {
            return { ...clip, transcript: "Could not extract transcript due to invalid timestamps." };
        }

        const relevantSegments = transcriptSegments.filter(segment => {
            const segmentEnd = segment.start + segment.duration;
            // Find segments that overlap with the clip's time range
            return segment.start < endSeconds && segmentEnd > startSeconds;
        });

        const transcriptText = relevantSegments.map(s => s.text).join(' ').trim();
        
        return { ...clip, transcript: transcriptText || "Transcript for this segment could not be found." };
    });


    return clipsWithTranscripts;

  } catch (error) {
    console.error("Error generating clips:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate clips from Gemini API: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating clips.");
  }
};
