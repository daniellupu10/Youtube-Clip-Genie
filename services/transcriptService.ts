// Fetch YouTube transcripts using AllOrigins CORS proxy
// This is a more reliable, widely-used free proxy service

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

// Parse YouTube's XML transcript format
const parseTranscriptXML = (xml: string): TranscriptSegment[] => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'text/xml');
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
            .replace(/\\n/g, ' ')
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

// Fetch transcript using AllOrigins CORS proxy
export const getTranscriptAndDuration = async (videoUrl: string): Promise<TranscriptResponse> => {
    const videoId = getVideoId(videoUrl);

    if (!videoId) {
        throw new Error('Invalid YouTube URL. Please provide a valid YouTube video link.');
    }

    try {
        console.log('Fetching transcript for video ID:', videoId);

        // Use AllOrigins to bypass CORS
        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(youtubeUrl)}`;

        console.log('Fetching video page through AllOrigins proxy...');
        const pageResponse = await fetch(proxyUrl);

        if (!pageResponse.ok) {
            throw new Error('Failed to fetch video page. The video might be private or unavailable.');
        }

        const pageHtml = await pageResponse.text();

        // Extract caption tracks from the page
        const captionTracksMatch = pageHtml.match(/"captionTracks":(\[.*?\])/);

        if (!captionTracksMatch) {
            throw new Error('No captions/transcripts available for this video. Please try a video with auto-generated or manual captions enabled.');
        }

        const captionTracks = JSON.parse(captionTracksMatch[1]);

        if (!captionTracks || captionTracks.length === 0) {
            throw new Error('No caption tracks found for this video.');
        }

        // Prefer English captions, or use the first available
        let captionTrack = captionTracks.find((track: any) =>
            track.languageCode === 'en' || track.languageCode === 'en-US' || track.languageCode === 'en-GB'
        );

        if (!captionTrack) {
            captionTrack = captionTracks[0];
        }

        const language = captionTrack.languageCode || 'auto-generated';
        console.log('Using caption track:', language);

        // Fetch the transcript XML through AllOrigins
        const transcriptUrl = captionTrack.baseUrl;
        const transcriptProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(transcriptUrl)}`;

        console.log('Fetching transcript data...');
        const transcriptResponse = await fetch(transcriptProxyUrl);

        if (!transcriptResponse.ok) {
            throw new Error('Failed to fetch transcript data from YouTube.');
        }

        const transcriptXML = await transcriptResponse.text();
        const segments = parseTranscriptXML(transcriptXML);

        if (segments.length === 0) {
            throw new Error('Transcript is empty or could not be parsed.');
        }

        // Calculate total duration
        const lastSegment = segments[segments.length - 1];
        const totalDuration = lastSegment.start + lastSegment.duration;

        console.log(`✓ Successfully fetched transcript: ${segments.length} segments, ${Math.floor(totalDuration/60)} minutes (${language})`);

        return {
            transcript: segments,
            duration: totalDuration
        };

    } catch (error) {
        console.error('Error fetching transcript:', error);

        if (error instanceof Error) {
            // Provide helpful error messages
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Network error: Unable to connect to the transcript service. Please check your internet connection and try again.');
            }
            throw error;
        }

        throw new Error('An unknown error occurred while fetching the transcript.');
    }
};
