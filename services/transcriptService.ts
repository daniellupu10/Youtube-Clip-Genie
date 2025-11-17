// Fetch YouTube transcripts directly using YouTube's public timedtext API
// This API doesn't have CORS restrictions and works reliably

export interface TranscriptSegment {
    text: string;
    start: number;
    duration: number;
}

export interface TranscriptResponse {
    transcript: TranscriptSegment[];
    duration: number; // in seconds
}

// Extract video ID from YouTube URL
const getVideoId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
        return match[2];
    }
    return null;
};

// Parse YouTube's timedtext XML format
const parseTimedTextXML = (xml: string): TranscriptSegment[] => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'text/xml');

    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
        throw new Error('Failed to parse transcript XML');
    }

    const textElements = xmlDoc.getElementsByTagName('text');
    const segments: TranscriptSegment[] = [];

    for (let i = 0; i < textElements.length; i++) {
        const element = textElements[i];
        const start = parseFloat(element.getAttribute('start') || '0');
        const duration = parseFloat(element.getAttribute('dur') || '0');
        const text = element.textContent || '';

        // Decode HTML entities
        const decodedText = text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n/g, ' ')
            .trim();

        if (decodedText) {
            segments.push({
                text: decodedText,
                start,
                duration
            });
        }
    }

    return segments;
};

// Try multiple languages for captions
const CAPTION_LANGUAGES = ['en', 'en-US', 'en-GB', 'a.en', 'en-CA', 'en-AU'];

export const getTranscriptAndDuration = async (videoUrl: string): Promise<TranscriptResponse> => {
    const videoId = getVideoId(videoUrl);

    if (!videoId) {
        throw new Error('Invalid YouTube URL. Please provide a valid YouTube video link.');
    }

    console.log('Fetching transcript for video ID:', videoId);

    let lastError: Error | null = null;

    // Try each language option
    for (const lang of CAPTION_LANGUAGES) {
        try {
            console.log(`Trying to fetch captions with language: ${lang}`);

            // YouTube's public timedtext API - no CORS restrictions!
            const captionUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}`;

            const response = await fetch(captionUrl);

            if (!response.ok) {
                console.log(`Failed with language ${lang}: ${response.status}`);
                continue; // Try next language
            }

            const xmlText = await response.text();

            // Check if we got actual content (not an error message)
            if (!xmlText || xmlText.length < 100 || !xmlText.includes('<text')) {
                console.log(`No valid captions found for language ${lang}`);
                continue; // Try next language
            }

            const segments = parseTimedTextXML(xmlText);

            if (segments.length === 0) {
                console.log(`Empty transcript for language ${lang}`);
                continue; // Try next language
            }

            // Calculate total duration
            const lastSegment = segments[segments.length - 1];
            const totalDuration = lastSegment.start + lastSegment.duration;

            console.log(`✓ Successfully fetched transcript: ${segments.length} segments, ${Math.floor(totalDuration/60)} minutes (${lang})`);

            return {
                transcript: segments,
                duration: totalDuration
            };

        } catch (error) {
            console.log(`Error with language ${lang}:`, error);
            lastError = error instanceof Error ? error : new Error('Unknown error');
            continue; // Try next language
        }
    }

    // If we get here, none of the languages worked
    console.error('Failed to fetch transcript with any language option');

    throw new Error(
        'No captions/transcripts available for this video. Please try a different video with captions or auto-generated subtitles enabled. ' +
        'Note: The video must have English captions or auto-generated captions available.'
    );
};
