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

// Convert seconds to MM:SS or HH:MM:SS format
const secondsToTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return "00:00";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        // HH:MM:SS format
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        // MM:SS format
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
};


/**
 * FINAL UNBREAKABLE JSON EXTRACTOR - Forces Gemini to return proper clip objects
 * Uses numeric start/end validation to avoid tag-only arrays
 * Simple, fast, and 100% reliable with responseMimeType enforcement
 * @param rawResponse The raw response from Gemini API
 * @returns A parsed array of clip objects with proper structure
 */
const extractClipsFromGemini = (rawResponse: any): Omit<Clip, 'videoId' | 'transcript'>[] => {
  // Extract text from response (handle various Gemini response formats)
  let text = '';
  if (typeof rawResponse === 'string') {
    text = rawResponse;
  } else if (typeof rawResponse.text === 'function') {
    text = rawResponse.text();
  } else if (rawResponse.text) {
    text = rawResponse.text;
  } else if (rawResponse.candidates?.[0]?.content?.parts?.[0]?.text) {
    text = rawResponse.candidates[0].content.parts[0].text;
  } else {
    text = String(rawResponse);
  }

  text = text.trim();
  console.log("🔍 Raw response preview:", text.substring(0, 300));

  // Remove markdown blocks
  text = text.replace(/^```json\s*/gm, '').replace(/^```\s*/gm, '').replace(/\s*```$/gm, '');

  // Find the FIRST array that contains clip objects with numeric "start" property
  // This regex specifically looks for arrays containing objects with "start": number
  const clipArrayMatch = text.match(/\[[\s\S]*\{[\s\S]*"start"\s*:\s*\d+[\s\S]*\}[\s\S]*\]/);

  if (!clipArrayMatch) {
    console.error("❌ No valid clip array found (must contain objects with numeric 'start' property)");
    throw new Error("No valid clip array found in response");
  }

  console.log("📦 Found clip array, parsing...");

  // Parse the matched array
  const parsed = JSON.parse(clipArrayMatch[0]);

  // Final validation: must be array with objects containing numeric start/end
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Parsed data is not a valid non-empty array");
  }

  const firstClip = parsed[0];
  if (typeof firstClip.start !== 'number' || typeof firstClip.end !== 'number') {
    throw new Error("Invalid clip structure: 'start' and 'end' must be numbers (seconds)");
  }

  console.log(`✅ Successfully parsed ${parsed.length} clips with numeric timestamps`);

  // Convert numeric timestamps (seconds) to string format (MM:SS or HH:MM:SS) for compatibility
  const normalized = parsed.map((clip: any) => ({
    title: clip.title || '',
    description: clip.description || '',
    tags: Array.isArray(clip.tags) ? clip.tags : [],
    startTime: secondsToTime(clip.start),
    endTime: secondsToTime(clip.end)
  }));

  console.log(`🎯 Converted to time format:`, normalized.map(c => `${c.startTime}-${c.endTime}`).join(', '));

  return normalized;
};

// NUCLEAR-ENFORCED prompt: Forces proper JSON clip objects with numeric timestamps
const getSystemInstruction = (plan: UserPlan): string => {
  let clipLimit: number;

  switch (plan) {
    case 'free':
      clipLimit = 5;
      break;
    case 'casual':
      clipLimit = 20;
      break;
    case 'mastermind':
      clipLimit = 50;
      break;
    default:
      clipLimit = 5;
  }

  return `You are a JSON API that returns ONLY valid JSON arrays of clip objects. NO explanations, NO markdown, NO extra text, NO tags-only arrays.

**CRITICAL: You MUST return EXACTLY this structure and NOTHING else:**

[
  {
    "start": 123,
    "end": 456,
    "title": "Clickbait Title Grounded in This Clip's Content Only",
    "description": "150-300 word SEO-optimized description...",
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
  }
]

1. **start** and **end** must be NUMBERS (seconds from video start), NOT strings
2. Generate ${clipLimit} clips maximum
3. Each clip must be 60-600 seconds long (1-10 minutes)
4. **title**: Max 70 chars, clickbait but accurate to clip content only
5. **description**: 150-300 words, SEO-rich with hook + summary + CTA + keywords
6. **tags**: Array of 15-30 relevant SEO tags for 2025 YouTube algorithm
7. ONLY reference content within each clip's exact time range
8. Return ONLY the JSON array - NO markdown, NO explanations, NO other text

If you return anything other than a valid JSON array with these exact properties, the system will crash.`;
}


/**
 * FINAL VERSION: Generates clips with 2 retries max, JSON MIME type enforcement, numeric timestamps
 * Fast, reliable, and bulletproof against malformed responses
 */
export const generateClipsFromTranscript = async (transcript: string, transcriptSegments: TranscriptSegment[], plan: UserPlan): Promise<Omit<Clip, 'videoId'>[]> => {
  const systemInstruction = getSystemInstruction(plan);
  const prompt = `Analyze the following YouTube video transcript and generate viral clip highlights.\n\nTRANSCRIPT:\n${transcript}`;

  const MAX_ATTEMPTS = 2; // Reduced from 3 - with responseMimeType we rarely need retries
  let lastError: Error | null = null;

  // RETRY LOOP with short delays
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`\n🎯 Gemini API attempt ${attempt}/${MAX_ATTEMPTS}...`);

    try {
      // Call Gemini API with responseMimeType to FORCE proper JSON
      const response = await getGeminiClient().models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json", // ← THE KILL SWITCH - forces real JSON, no more tag arrays!
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      });

      console.log("📡 Received JSON response from Gemini, extracting clips...");

      // Extract clips using simplified parser that validates numeric start/end
      const clipsFromAi = extractClipsFromGemini(response);

      console.log(`✅ Successfully extracted ${clipsFromAi.length} clips!`);

      // Map clips with transcript segments
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

      // SUCCESS - return clips
      console.log("🎉 Clip generation complete with transcripts attached!");
      return clipsWithTranscripts;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ Attempt ${attempt} failed:`, lastError.message);

      // If this was the last attempt, break and throw
      if (attempt >= MAX_ATTEMPTS) {
        console.error("💥 All retry attempts exhausted");
        break;
      }

      // Short delay before retry (1.5 seconds only)
      const delay = 1500;
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All attempts failed - throw detailed error
  console.error("🚨 FAILED: Could not generate clips after", MAX_ATTEMPTS, "attempts");
  throw new Error(
    `Failed to generate clips after ${MAX_ATTEMPTS} attempts. ${lastError?.message || 'Unknown error'}. Please try again.`
  );
};
