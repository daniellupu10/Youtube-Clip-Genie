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
 * BULLETPROOF JSON PARSER - Handles all Gemini malformed JSON cases
 * Multi-layer fallback system prevents crashes from missing commas, trailing commas,
 * unescaped quotes, markdown blocks, etc.
 * @param text The text response from the AI.
 * @returns A parsed array of clip objects.
 */
const extractJsonArray = (text: string): Omit<Clip, 'videoId' | 'transcript'>[] => {
  console.log("Raw AI response (first 500 chars):", text.substring(0, 500));

  // LAYER 1: Aggressive initial cleanup
  let raw = (text || '').trim();

  // Remove markdown code blocks
  if (raw.startsWith('```json')) {
    raw = raw.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  }
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  console.log("After markdown cleanup (first 500 chars):", raw.substring(0, 500));

  let clips: any[] = [];

  // LAYER 2: Try direct parse (best case - Gemini returned perfect JSON)
  try {
    clips = JSON.parse(raw);
    console.log("✓ Direct parse succeeded");

    // Validate it's an array
    if (Array.isArray(clips) && clips.length > 0) {
      if (clips[0].title && clips[0].startTime && clips[0].endTime) {
        console.log(`✓ Successfully parsed ${clips.length} clips (direct parse)`);
        return clips;
      }
    }
  } catch (directError) {
    console.log("Direct parse failed, trying regex extraction...", directError);
  }

  // LAYER 3: Extract first [...] block with regex (handles garbage before/after)
  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    console.error("No JSON array found in response");
    throw new Error("The AI returned a response that did not contain a valid JSON array.");
  }

  let jsonString = arrayMatch[0];
  console.log("Extracted JSON array (first 500 chars):", jsonString.substring(0, 500));

  // LAYER 4: Try parsing extracted array
  try {
    clips = JSON.parse(jsonString);
    if (Array.isArray(clips) && clips.length > 0) {
      if (clips[0].title && clips[0].startTime && clips[0].endTime) {
        console.log(`✓ Successfully parsed ${clips.length} clips (regex extraction)`);
        return clips;
      }
    }
  } catch (extractError) {
    console.log("Extracted array parse failed, applying fixes...", extractError);
  }

  // LAYER 5: Nuclear fallback - fix common JSON issues manually
  try {
    console.log("Attempting nuclear fallback with manual JSON repair...");

    let fixed = jsonString
      // Remove trailing commas before ] or }
      .replace(/,(\s*[\]}])/g, '$1')
      // Fix single quotes to double quotes
      .replace(/'/g, '"')
      // Fix unquoted property names (title: -> "title":)
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
      // Remove any markdown artifacts that slipped through
      .replace(/```json/g, '')
      .replace(/```/g, '')
      // Remove control characters except newlines
      .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '')
      // Fix missing commas between properties on different lines
      .replace(/"\s*\n\s*"/g, '",\n"')
      // Fix unquoted string values (only simple cases)
      .replace(/:\s*([a-zA-Z][a-zA-Z0-9\s]*[a-zA-Z0-9])\s*([,}\]])/g, ': "$1"$2');

    console.log("Nuclear fixed JSON (first 500 chars):", fixed.substring(0, 500));

    clips = JSON.parse(fixed);

    if (Array.isArray(clips) && clips.length > 0) {
      if (clips[0].title && clips[0].startTime && clips[0].endTime) {
        console.log(`✓ Successfully parsed ${clips.length} clips (nuclear fallback)`);
        return clips;
      }
    }
  } catch (nuclearError) {
    console.error("Nuclear fallback also failed:", nuclearError);
    console.error("Final attempted JSON:", jsonString.substring(0, 1000));
    throw new Error(`The AI returned malformed JSON that could not be repaired. Error: ${nuclearError instanceof Error ? nuclearError.message : 'Unknown error'}. Please try again.`);
  }

  // LAYER 6: Final validation - must be non-empty array with required fields
  if (!Array.isArray(clips) || clips.length === 0) {
    throw new Error("Gemini returned empty or invalid clips array");
  }

  // Check first clip has required fields
  if (!clips[0].title || !clips[0].startTime || !clips[0].endTime) {
    throw new Error("Parsed clips are missing required fields (title, startTime, endTime)");
  }

  console.log(`✓ Successfully parsed ${clips.length} clips`);
  return clips;
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
