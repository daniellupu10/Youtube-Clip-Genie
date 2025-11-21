import { GoogleGenAI } from "@google/genai";
import type { Clip } from '../types';
import type { UserPlan } from '../types';
import type { TranscriptSegment } from './transcriptService';


// Initialize Gemini API - check at runtime, not module load
let ai: any = null;

const getGeminiClient = () => {
    // Check for GEMINI_API_KEY first (Vercel), then fallback to API_KEY
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey) {
        console.error("GEMINI API_KEY is missing! Please check your Vercel environment variables.");
        throw new Error("GEMINI_API_KEY environment variable is not set. Please configure it in Vercel environment variables.");
    }

    if (!ai) {
        // SECURITY: Never log API keys - only log confirmation
        console.log("✅ Gemini API initialized successfully");
        ai = new GoogleGenAI({ apiKey });
    }

    return ai;
};

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
  console.log("Raw AI response (first 500 chars):", text.substring(0, 500));

  const startIndex = text.indexOf('[');
  const endIndex = text.lastIndexOf(']');

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    console.error("Could not find a valid JSON array in the AI response.", text);
    throw new Error("The AI returned a response that did not contain a valid JSON array.");
  }

  let jsonString = text.substring(startIndex, endIndex + 1);
  console.log("Extracted JSON (first 500 chars):", jsonString.substring(0, 500));

  // Clean up common JSON formatting issues from AI responses
  jsonString = jsonString
    // Remove trailing commas before closing braces/brackets
    .replace(/,(\s*[}\]])/g, '$1')
    // Remove any markdown code fence artifacts
    .replace(/```json/g, '')
    .replace(/```/g, '')
    // Remove any control characters except newlines
    .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '')
    // Fix property names without quotes (e.g., title: -> "title":)
    .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
    // Fix missing commas between properties on different lines
    .replace(/"\s*\n\s*"/g, '",\n"')
    // Ensure spaces after colons and commas
    .replace(/:\s*/g, ': ')
    .replace(/,\s*/g, ', ');

  console.log("Cleaned JSON (first 500 chars):", jsonString.substring(0, 500));

  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed)) {
      if (parsed.length > 0 && (!parsed[0].title || !parsed[0].startTime)) {
         throw new Error("Parsed JSON objects are missing required properties.");
      }
      console.log(`✓ Successfully parsed ${parsed.length} clips`);
      return parsed;
    } else {
      throw new Error("Parsed JSON is not an array.");
    }
  } catch (error) {
    console.error("Failed to parse extracted JSON string.", {
      error,
      jsonPreview: jsonString.substring(0, 200)
    });

    // Try even more aggressive cleanup
    try {
      console.log("Attempting aggressive cleanup...");

      // Remove all single quotes and replace with double quotes carefully
      let fixedJson = jsonString
        // First, protect already quoted strings
        .replace(/"([^"]*)"/g, (match) => {
          return match.replace(/'/g, '\u0001'); // Temporary placeholder
        })
        // Replace remaining single quotes with double quotes
        .replace(/'/g, '"')
        // Restore protected single quotes
        .replace(/\u0001/g, "'")
        // Fix any remaining structural issues
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

      console.log("Aggressively cleaned JSON (first 500 chars):", fixedJson.substring(0, 500));

      const retryParsed = JSON.parse(fixedJson);
      if (Array.isArray(retryParsed)) {
        console.log("✓ Successfully parsed JSON after aggressive cleanup");
        return retryParsed;
      }
    } catch (retryError) {
      console.error("Aggressive cleanup also failed:", retryError);
    }

    if (error instanceof Error) {
        throw new Error(`The AI returned a malformed JSON array: ${error.message}. Please try again.`);
    }
    throw new Error("The AI returned a malformed JSON array. Please try again.");
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

5.  **FINAL OUTPUT:** Your entire response must be ONLY a single, valid JSON array of these clip objects. Do not include any other text, explanations, or markdown. Your response must start with \`[\` and end with \`]\`.

**CRITICAL JSON FORMATTING RULES - FOLLOW EXACTLY:**
- ALL property names MUST be in double quotes: "title", "description", "tags", "startTime", "endTime"
- ALL string values MUST be in double quotes
- NEVER use single quotes anywhere
- Each property must be separated by a comma: "title": "...", "description": "..."
- Do NOT put trailing commas before closing braces or brackets
- Tags must be an array with double quotes: "tags": ["tag1", "tag2"]
- Times must be strings in quotes: "startTime": "01:30"
- Test your JSON is valid before responding
- Output ONLY the JSON array, absolutely no text before or after

**EXAMPLE OF CORRECT FORMAT:**
\`\`\`
[{"title": "Amazing Discovery", "description": "This reveals something incredible.", "tags": ["discovery", "science"], "startTime": "01:30", "endTime": "05:45"}]
\`\`\``;
}


export const generateClipsFromTranscript = async (transcript: string, transcriptSegments: TranscriptSegment[], plan: UserPlan): Promise<Omit<Clip, 'videoId'>[]> => {
  const systemInstruction = getSystemInstruction(plan);

  const prompt = `Analyze the following YouTube video transcript and generate the highlight clips as a JSON array:\n\nTRANSCRIPT:\n"""\n${transcript}\n"""`;

  try {
    const response = await getGeminiClient().models.generateContent({
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
