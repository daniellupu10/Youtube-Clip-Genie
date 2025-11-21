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
        console.log("Gemini API initialized successfully with key:", apiKey.substring(0, 10) + "...");
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
 * ULTIMATE UNBREAKABLE JSON EXTRACTOR - Handles ALL Gemini response formats
 * Multi-array attempt system with ultra-aggressive cleaning
 * This function NEVER gives up until all possibilities are exhausted
 * @param rawResponse The raw response from Gemini API
 * @returns A parsed array of clip objects
 */
const extractValidClipsArrayFromGemini = (rawResponse: any): Omit<Clip, 'videoId' | 'transcript'>[] => {
  // Extract text from various response formats
  let text = typeof rawResponse === 'string' ? rawResponse : rawResponse.text || rawResponse.content || '';
  text = text.trim();

  console.log("🔍 Raw Gemini response (first 500 chars):", text.substring(0, 500));

  // STEP 1: Remove all markdown wrappers aggressively
  text = text
    .replace(/^```json\s*/g, '')
    .replace(/^```\s*/g, '')
    .replace(/\s*```$/g, '')
    .replace(/```json/g, '')
    .replace(/```/g, '');

  console.log("📝 After markdown removal (first 500 chars):", text.substring(0, 500));

  // STEP 2: Find ALL potential JSON arrays in the response (handles multiple attempts, explanatory text, etc.)
  const arrayRegex = /\[[\s\S]*?\]/g;
  const allMatches = text.match(arrayRegex);

  if (!allMatches || allMatches.length === 0) {
    console.error("❌ No JSON arrays found in response");
    throw new Error("No JSON array found in Gemini response - please try again");
  }

  console.log(`📊 Found ${allMatches.length} potential JSON array(s) in response`);

  // STEP 3: Sort arrays by length (longest = most complete, try first)
  const sortedArrays = allMatches.sort((a, b) => b.length - a.length);

  // STEP 4: Try parsing each array with ultra-aggressive cleaning
  for (let i = 0; i < sortedArrays.length; i++) {
    const jsonStr = sortedArrays[i];
    console.log(`\n🔧 Attempting to parse array ${i + 1}/${sortedArrays.length} (${jsonStr.length} chars)...`);

    try {
      // ULTRA-AGGRESSIVE CLEANING SEQUENCE
      let cleaned = jsonStr
        // Fix escaped characters that might be broken
        .replace(/\\n/g, ' ')  // Replace escaped newlines with spaces
        .replace(/\\r/g, ' ')
        .replace(/\\t/g, ' ')
        .replace(/\\b/g, '')
        .replace(/\\f/g, '')
        // Fix trailing commas (most common issue)
        .replace(/,(\s*[\]}])/g, '$1')
        // Fix single quotes to double quotes
        .replace(/'/g, '"')
        // Fix unquoted property names (title: -> "title":)
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        // Remove control characters
        .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
        // Fix missing commas between properties
        .replace(/"\s*\n\s*"/g, '",\n"')
        .replace(/}[\s\n]*{/g, '},{')
        // Fix unquoted string values (more aggressive)
        .replace(/:\s*([^"{\[\d\-truefalsenull][^,\]}]*?)(\s*[,}\]])/g, (match, value, ending) => {
          const trimmed = value.trim();
          if (trimmed && trimmed !== 'true' && trimmed !== 'false' && trimmed !== 'null') {
            return `: "${trimmed}"${ending}`;
          }
          return match;
        })
        // Remove any remaining markdown
        .replace(/```/g, '')
        // Fix multiple spaces
        .replace(/\s+/g, ' ');

      console.log("✨ Cleaned JSON (first 300 chars):", cleaned.substring(0, 300));

      // Attempt parse
      const parsed = JSON.parse(cleaned);

      // Validate it's a proper clips array
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Check if it has required clip properties
        const firstClip = parsed[0];
        if (firstClip &&
            (firstClip.title || firstClip.Title) &&
            (firstClip.startTime || firstClip.start || firstClip.StartTime) &&
            (firstClip.endTime || firstClip.end || firstClip.EndTime)) {

          // Normalize property names if needed
          const normalized = parsed.map(clip => ({
            title: clip.title || clip.Title || '',
            description: clip.description || clip.Description || '',
            tags: clip.tags || clip.Tags || [],
            startTime: clip.startTime || clip.start || clip.StartTime || '',
            endTime: clip.endTime || clip.end || clip.EndTime || ''
          }));

          console.log(`✅ SUCCESS! Parsed ${normalized.length} clips from array ${i + 1}`);
          return normalized;
        }
      }

      console.log(`⚠️ Array ${i + 1} parsed but didn't contain valid clips, trying next...`);
    } catch (parseError) {
      console.log(`❌ Array ${i + 1} parse failed:`, parseError instanceof Error ? parseError.message : 'Unknown error');
      // Continue to next array
      continue;
    }
  }

  // FINAL FALLBACK: If we get here, nothing worked
  console.error("💥 CRITICAL: All parsing attempts failed");
  console.error("Last attempted arrays:", sortedArrays.map(a => a.substring(0, 200)));
  throw new Error("UNRECOVERABLE_JSON_FALLBACK_TRIGGERED: Could not extract valid clips from any array in the response. Please try again.");
};

// UPDATED: New YouTube SEO-optimized prompt for viral clip generation
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


  return `You are a world-class YouTube clip creator specializing in viral content, controversial debates, educational videos, and highly engaging short-form content optimized for maximum reach in 2025.

**YOUR MISSION:** Analyze the provided video transcript and identify the BEST self-contained segments that will perform exceptionally well as standalone YouTube clips.

**CRITICAL RULES - NEVER BREAK THESE:**

1. **CONTENT ACCURACY - MOST IMPORTANT RULE:**
   - For EACH clip you generate, you may ONLY use information that appears within that specific clip's time range (between its startTime and endTime).
   - NEVER reference names, events, claims, topics, or context from outside the clip's exact time boundaries.
   - If a name is mentioned at 5:00 but your clip is 10:00-12:00, DO NOT include that name in the title/description/tags.
   - Every word in the title, description, and tags MUST be directly traceable to what is spoken within that specific clip's time range.
   - This is the #1 rule - violating it makes the clip misleading and unusable.

2. **DURATION REQUIREMENTS:**
   - Each clip MUST be between 1 minute (01:00) and 10 minutes (10:00).
   - Prefer clips in the 2-5 minute range for optimal engagement.

3. **CLIP LIMIT:**
   - ${planSpecificInstruction}

4. **GENERATE PERFECT YOUTUBE METADATA FOR EACH CLIP:**

   **TITLE (max 70 characters):**
   - Must be instantly clickable using curiosity, shock value, or strong value proposition
   - Use power words: "Exposed", "Revealed", "Proof", "Caught", "Secret", "Truth", "Warning", "Never", "Always", "Shocking"
   - Use numbers when relevant: "3 Reasons Why...", "The #1 Mistake..."
   - Use questions that create curiosity: "Why Does...", "What Happens When...", "Is This Really..."
   - Use controversy/conflict when present: "He Admits...", "They're Lying About...", "The Real Reason..."
   - But remember: ONLY use these if the content actually appears in THIS SPECIFIC CLIP
   - Examples of GOOD titles:
     * "He Just Admitted This on Camera – Watch What Happens"
     * "The #1 Reason This Argument Failed"
     * "Caught Lying About This Obvious Fact"
     * "Why This Simple Question Broke His Logic"
   - AVOID generic titles like "Discussion on Topic X" or "Interesting Segment"

   **DESCRIPTION (150-350 words - longer is better for SEO):**
   Structure the description like this:

   [HOOK - First 2-3 lines, extremely engaging]
   Write an irresistible opening that matches the title's energy. Make the viewer desperate to watch.

   [DETAILED SUMMARY - Main body, 100-250 words]
   Provide a rich, natural-language summary of everything that happens in this specific clip:
   - Who is speaking (if mentioned in the clip)
   - What claims are made
   - Key arguments or points
   - Important quotes (use quotation marks)
   - Any conflict, revelation, or surprising moments
   - Questions raised and answered
   - Use timestamps within the clip if helpful (e.g., "At 0:15, he reveals...", "By 2:30, the discussion shifts to...")

   [MINI TIMESTAMPS - if the clip has clear sections]
   00:00 Intro/Setup
   00:15 Main claim revealed
   01:30 Counter-argument presented
   02:45 Shocking conclusion

   [CALL TO ACTION + SEO KEYWORDS - Final 2-3 lines]
   - Ask a question to boost comments: "What do you think about this? Let us know below!"
   - Naturally weave in searchable keywords related to the clip's content
   - Encourage likes/shares: "Subscribe for more content like this!"
   - Include relevant 2025 context if timely

   REMEMBER: Every detail in the description must come from THIS CLIP ONLY.

   **TAGS (15-30 tags for maximum SEO reach):**
   Generate a comprehensive list including:
   - Main topic keywords (broad): "debate", "religion", "philosophy", "podcast"
   - Specific topic variations: "religious debate 2025", "christian vs muslim", "apologetics"
   - Long-tail search phrases: "why do people believe", "evidence for god", "best debate moments"
   - Speaker names ONLY if mentioned in this clip: "speaker name debate", "speaker name exposed"
   - Viral trigger words (when relevant): "exposed", "debunked", "proof", "caught lying", "shocking truth"
   - Question-based tags: "is god real", "does the bible say", "what is the proof"
   - Related controversy keywords: "religious debate", "atheist vs christian", "logic vs faith"
   - Year/timeliness: "2025", "latest debate", "recent"
   - Format tags: "clip", "short", "highlight", "best moments"
   - Emotion tags: "shocking", "mind blowing", "must watch", "viral"
   - Common misspellings of popular terms if they rank
   - Niche community tags relevant to the content

   IMPORTANT: Only use tags that are directly relevant to what's discussed in THIS SPECIFIC CLIP.

5. **OUTPUT FORMAT - VALID JSON ONLY:**
   Your entire response must be a single valid JSON array. No explanations, no markdown, no extra text.

   Start with [ and end with ]

   Each clip object must have exactly these properties:
   {
     "title": "string (max 70 chars)",
     "description": "string (150-350 words with hook, summary, timestamps, CTA, keywords)",
     "tags": ["tag1", "tag2", ..., "tag15-30"],
     "startTime": "MM:SS or HH:MM:SS",
     "endTime": "MM:SS or HH:MM:SS"
   }

**CRITICAL JSON FORMATTING RULES:**
- ALL property names in double quotes: "title", "description", "tags", "startTime", "endTime"
- ALL string values in double quotes
- NEVER use single quotes
- Separate properties with commas
- NO trailing commas before closing braces or brackets
- Tags must be a proper JSON array: "tags": ["tag1", "tag2", "tag3"]
- Times as strings: "startTime": "01:30"
- Escape quotes inside strings: "He said \\"this\\" on camera"
- Validate your JSON before responding

**EXAMPLE OUTPUT:**
\`\`\`json
[
  {
    "title": "He Admits He Can't Answer This Simple Question",
    "description": "Watch what happens when a seemingly simple question completely derails this entire argument. In this clip, the speaker is confronted with a basic logical challenge that exposes a fundamental flaw in his reasoning.\\n\\nThe exchange begins with a straightforward question about evidence and methodology. At first, he tries to dodge by changing the subject, but the questioner persists. By 1:30, the tension is palpable as he realizes he's backed into a corner. At 2:15, he finally admits he doesn't have an answer – a stunning moment of honesty that undermines his previous confidence.\\n\\nThis is a masterclass in debate tactics and logical reasoning. Whether you're interested in philosophy, critical thinking, or just love watching intellectual exchanges, this clip delivers.\\n\\nTIMESTAMPS:\\n00:00 The question is asked\\n00:45 First dodge attempt\\n01:30 Pressure builds\\n02:15 The admission\\n\\nWhat do you think – was this a fair question or a trap? Drop your thoughts below and subscribe for more debate highlights!\\n\\n#debate #logic #philosophy #criticalthinking #exposed #2025",
    "tags": ["debate", "logic", "critical thinking", "philosophy", "exposed", "caught", "admits wrong", "can't answer", "simple question", "debate tactics", "intellectual debate", "argument breakdown", "logical fallacy", "debate highlights 2025", "best debate moments", "viral debate", "debate clip", "shocking admission", "honest moment", "philosophy debate", "reasoning", "evidence", "methodology", "question dodging", "debate strategy", "mind blowing debate", "must watch debate", "debate short", "debate highlight", "2025 debate"],
    "startTime": "05:30",
    "endTime": "08:45"
  }
]
\`\`\`

**FINAL REMINDERS:**
- Quality over quantity - only select clips with genuinely engaging content
- Each clip must be self-contained and make sense without seeing the rest of the video
- Titles must be accurate but irresistible
- Descriptions must be long and SEO-rich (aim for 250+ words)
- Tags must be comprehensive (aim for 20-25 tags per clip)
- NEVER reference content outside the clip's specific time range
- Output ONLY valid JSON, nothing else`;
}


/**
 * Generates clips from transcript with RETRY LOGIC and EXPONENTIAL BACKOFF
 * This ensures we never fail due to transient Gemini issues or JSON parsing problems
 */
export const generateClipsFromTranscript = async (transcript: string, transcriptSegments: TranscriptSegment[], plan: UserPlan): Promise<Omit<Clip, 'videoId'>[]> => {
  const systemInstruction = getSystemInstruction(plan);
  const prompt = `Analyze the following YouTube video transcript and generate the highlight clips as a JSON array:\n\nTRANSCRIPT:\n"""\n${transcript}\n"""`;

  const MAX_ATTEMPTS = 3;
  let attempts = 0;
  let lastError: Error | null = null;

  // RETRY LOOP with exponential backoff
  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    console.log(`\n🎯 Gemini API attempt ${attempts}/${MAX_ATTEMPTS}...`);

    try {
      // Call Gemini API
      const response = await getGeminiClient().models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      console.log("📡 Received response from Gemini, extracting clips...");

      // Extract clips using ULTIMATE UNBREAKABLE parser
      const clipsFromAi = extractValidClipsArrayFromGemini(response);

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
      console.error(`❌ Attempt ${attempts} failed:`, lastError.message);

      // If this was the last attempt, throw the error
      if (attempts >= MAX_ATTEMPTS) {
        console.error("💥 All retry attempts exhausted");
        break;
      }

      // Check if it's an unrecoverable error
      if (lastError.message.includes("UNRECOVERABLE_JSON_FALLBACK_TRIGGERED")) {
        console.log("⚠️ Unrecoverable JSON error detected, retrying with fresh request...");
      }

      // Exponential backoff: 2s, 4s, 8s
      const delay = 2000 * Math.pow(2, attempts - 1);
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All attempts failed - throw detailed error
  console.error("🚨 CRITICAL: Failed to generate clips after all retry attempts");
  throw new Error(
    `Failed to generate clips from Gemini API after ${MAX_ATTEMPTS} attempts. Last error: ${lastError?.message || 'Unknown error'}. Please try again or contact support if the issue persists.`
  );
};
