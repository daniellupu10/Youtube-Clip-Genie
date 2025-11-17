// Using CORS proxy to access transcript API from browser
const TRANSCRIPT_API_KEY = process.env.TRANSCRIPT_API_KEY || '';
const API_BASE_URL = 'https://transcriptapi.com/api/v2/youtube/transcript';
// CORS proxy to allow browser requests
const CORS_PROXY = 'https://corsproxy.io/?';

if (!TRANSCRIPT_API_KEY) {
    console.error("TRANSCRIPT_API_KEY is missing! Transcript fetching will fail.");
} else {
    console.log("Transcript API key configured successfully");
}

export interface TranscriptSegment {
    text: string;
    start: number;
    duration: number;
}

export interface TranscriptResponse {
    transcript: TranscriptSegment[];
    duration: number; // in seconds
}

export const getTranscriptAndDuration = async (videoUrl: string): Promise<TranscriptResponse> => {
    const url = new URL(API_BASE_URL);
    url.searchParams.append('video_url', videoUrl);
    url.searchParams.append('format', 'json');

    // Use CORS proxy to bypass browser restrictions
    const proxiedUrl = CORS_PROXY + encodeURIComponent(url.toString());

    try {
        console.log("Fetching transcript for:", videoUrl);
        const response = await window.fetch(proxiedUrl, {
            headers: {
                'Authorization': `Bearer ${TRANSCRIPT_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(`Transcript API error (${response.status}): ${errorData.detail || response.statusText}`);
        }

        const data = await response.json();
        const transcriptSegments = data.transcript as TranscriptSegment[];

        if (!Array.isArray(transcriptSegments) || transcriptSegments.length === 0) {
            throw new Error("Transcript is not available or is empty for this video.");
        }

        const lastSegment = transcriptSegments[transcriptSegments.length - 1];
        const totalDuration = lastSegment.start + lastSegment.duration;

        console.log(`✓ Successfully fetched transcript: ${transcriptSegments.length} segments, ${Math.floor(totalDuration/60)} minutes`);

        return {
            transcript: transcriptSegments,
            duration: totalDuration,
        };

    } catch (error) {
        console.error('Error fetching transcript:', error);
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
             throw new Error('Network error: Unable to fetch transcript. Please check your internet connection and try again.');
        }
        if (error instanceof Error) {
            throw new Error(error.message);
        }
        throw new Error('An unknown error occurred while fetching the transcript.');
    }
};
