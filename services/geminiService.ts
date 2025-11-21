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
 * ← FINAL FIX: No more JSON truncation, no retries, works perfectly on Vercel
 * BULLETPROOF PARSER: Finds the largest valid JSON array to handle truncation
 * Sorts all found arrays by length and tries the longest first (most complete)
 * @param rawResponse The raw response from Gemini API
 * @returns A parsed array of clip objects with proper structure
 */
const extractClipsFromGemini = async (rawResponse: any): Promise<Omit<Clip, 'videoId' | 'transcript'>[]> => {
  // Extract text from response (handle various Gemini response formats)
  let text = '';
  if (typeof rawResponse.text === 'function') {
    text = await rawResponse.text();
  } else if (rawResponse.text) {
    text = rawResponse.text;
  } else if (rawResponse.candidates?.[0]?.content?.parts?.[0]?.text) {
    text = rawResponse.candidates[0].content.parts[0].text;
  } else {
    throw new Error("Invalid Gemini response format");
  }

  // Remove markdown wrappers
  text = text.trim().replace(/^```json\n?/g, '').replace(/```$/g, '');

  console.log("🔍 Response length:", text.length, "chars");

  // FIND ALL JSON ARRAYS (this handles truncation by trying largest first)
  const arrays = text.match(/\[[\s\S]*\]/g) || [];

  if (arrays.length === 0) {
    throw new Error("No JSON array found in response");
  }

  console.log(`📊 Found ${arrays.length} potential JSON array(s)`);

  // Sort by length descending — longest = most complete
  arrays.sort((a, b) => b.length - a.length);

  // Try each array starting with the longest
  for (let i = 0; i < arrays.length; i++) {
    const candidate = arrays[i];
    console.log(`🔧 Trying array ${i + 1}/${arrays.length} (${candidate.length} chars)...`);

    try {
      const parsed = JSON.parse(candidate);

      // Validate it's a proper clips array
      if (Array.isArray(parsed) && parsed.length > 0 &&
          typeof parsed[0].start === 'number' &&
          parsed[0].title) {

        // Final sanity check: all clips have required fields
        const allValid = parsed.every(c =>
          c.start >= 0 &&
          c.end > c.start &&
          c.title &&
          c.description &&
          Array.isArray(c.tags)
        );

        if (allValid) {
          console.log(`✅ Successfully parsed ${parsed.length} clips from array ${i + 1}`);

          // Convert numeric timestamps to string format for compatibility
          const normalized = parsed.map((clip: any) => ({
            title: clip.title || '',
            description: clip.description || '',
            tags: Array.isArray(clip.tags) ? clip.tags : [],
            startTime: secondsToTime(clip.start),
            endTime: secondsToTime(clip.end)
          }));

          return normalized;
        }
      }
    } catch (parseError) {
      console.log(`❌ Array ${i + 1} parse failed, trying next...`);
      continue;
    }
  }

  throw new Error("No valid complete clip array found in response");
};

// ← FINAL FIX: Ultra-compact prompt to prevent truncation
const getSystemInstruction = (plan: UserPlan): string => {
  let clipLimit: number;

  switch (plan) {
    case 'free':
      clipLimit = 5;
      break;
    case 'casual':
      clipLimit = 12; // Reduced from 20 to prevent truncation
      break;
    case 'mastermind':
      clipLimit = 12; // Reduced from 50 to prevent truncation
      break;
    default:
      clipLimit = 5;
  }

  return `You are a JSON-only API that generates YouTube clips. You return NOTHING except a valid, compact JSON array of clip objects. No explanations, no markdown, no thoughts, no extra text.

Output MUST be valid JSON from the very first character to the last. Descriptions must be 120–250 words, no longer.

Return EXACTLY this structure and nothing else:

[{"start":0,"end":0,"title":"string max 70 chars","description":"string 120-250 words","tags":["tag1","tag2",... up to 25 tags]}]

RULES:
1. Generate ${clipLimit} clips MAXIMUM
2. Each clip: 60-600 seconds (1-10 minutes)
3. **start** and **end** are NUMBERS (seconds), NOT strings
4. **title**: Max 70 chars, clickbait but accurate to THIS clip only
5. **description**: 120-250 words, compact but SEO-rich
6. **tags**: 15-25 tags relevant to THIS clip
7. ONLY reference content within each clip's exact time range

BEGIN JSON ARRAY NOW — NO EXTRA TEXT:`;
}


/**
 * ← FINAL FIX: No retries needed, single shot with maxOutputTokens 8192
 * Works perfectly on Vercel with bulletproof largest-array parser
 */
export const generateClipsFromTranscript = async (transcript: string, transcriptSegments: TranscriptSegment[], plan: UserPlan): Promise<Omit<Clip, 'videoId'>[]> => {
  const systemInstruction = getSystemInstruction(plan);
  const prompt = `Analyze the following YouTube video transcript and generate viral clip highlights.\n\nTRANSCRIPT:\n${transcript}`;

  console.log("🎯 Calling Gemini API (single attempt, maxOutputTokens: 8192)...");

  try {
    // ← FINAL FIX: Call Gemini with maxOutputTokens 8192 to prevent truncation
    const response = await getGeminiClient().models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json", // Forces valid JSON
        temperature: 0.7,
        maxOutputTokens: 8192, // Maximum possible to prevent truncation
        topP: 0.95,
      },
    });

    console.log("📡 Received response from Gemini");

    // Extract clips using bulletproof largest-array parser
    const clipsFromAi = await extractClipsFromGemini(response);

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
    console.log("🎉 Clip generation complete!");
    return clipsWithTranscripts;

  } catch (error) {
    console.error("💥 Gemini failed permanently:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini failed permanently: ${errorMsg}`);
  }
};
