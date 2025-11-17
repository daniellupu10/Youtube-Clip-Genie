// Fetch YouTube transcripts using TranscriptAPI through AllOrigins proxy
// This uses a proper transcript API instead of scraping YouTube pages

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

// The transcript API key (safe to use - read-only access to public YouTube data)
const TRANSCRIPT_API_KEY = 'sk_gq7px1hBiSN-WGP5tLTp7aLwx5IBoeNocTdfZxRjXUY';

export const getTranscriptAndDuration = async (videoUrl: string): Promise<TranscriptResponse> => {
    const videoId = getVideoId(videoUrl);

    if (!videoId) {
        throw new Error('Invalid YouTube URL. Please provide a valid YouTube video link.');
    }

    try {
        console.log('Fetching transcript for video ID:', videoId);

        // Build the transcript API URL
        const apiUrl = new URL('https://transcriptapi.com/api/v2/youtube/transcript');
        apiUrl.searchParams.append('video_url', videoUrl);
        apiUrl.searchParams.append('format', 'json');

        // Use AllOrigins to proxy the request and bypass CORS
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl.toString())}`;

        console.log('Fetching transcript through AllOrigins proxy...');

        const response = await fetch(proxyUrl, {
            headers: {
                'Authorization': `Bearer ${TRANSCRIPT_API_KEY}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch transcript (Status: ${response.status})`);
        }

        const data = await response.json();

        // AllOrigins wraps the response in a "contents" field
        let transcriptData;
        try {
            transcriptData = JSON.parse(data.contents);
        } catch (e) {
            console.error('Failed to parse transcript data:', e);
            throw new Error('Invalid response from transcript service');
        }

        const transcriptSegments = transcriptData.transcript as TranscriptSegment[];

        if (!Array.isArray(transcriptSegments) || transcriptSegments.length === 0) {
            throw new Error('No captions/transcripts available for this video. Please try a video with captions enabled.');
        }

        // Calculate total duration
        const lastSegment = transcriptSegments[transcriptSegments.length - 1];
        const totalDuration = lastSegment.start + lastSegment.duration;

        console.log(`✓ Successfully fetched transcript: ${transcriptSegments.length} segments, ${Math.floor(totalDuration/60)} minutes`);

        return {
            transcript: transcriptSegments,
            duration: totalDuration
        };

    } catch (error) {
        console.error('Error fetching transcript:', error);

        if (error instanceof Error) {
            // Provide helpful error messages
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Network error: Unable to connect to the transcript service. Please check your internet connection and try again.');
            }
            if (error.message.includes('No captions')) {
                throw error; // Pass through caption-specific errors
            }
            throw new Error(`Transcript error: ${error.message}`);
        }

        throw new Error('An unknown error occurred while fetching the transcript.');
    }
};
