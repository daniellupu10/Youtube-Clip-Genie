// WARNING: Hardcoding API keys in client-side code is a security risk.
// This key will be visible to anyone inspecting the website's code.
// For a production application, this call should be made from a backend server.
const TRANSCRIPT_API_KEY = 'sk_gq7px1hBiSN-WGP5tLTp7aLwx5IBoeNocTdfZxRjXUY';
const API_BASE_URL = 'https://transcriptapi.com/api/v2/youtube/transcript';

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
    url.searchParams.append('format', 'json'); // We need JSON for segments and duration calculation
    
    try {
        const response = await window.fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${TRANSCRIPT_API_KEY}`
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

        return {
            transcript: transcriptSegments,
            duration: totalDuration,
        };

    } catch (error) {
        console.error('Error fetching transcript:', error);
        // Re-throw a more user-friendly error. Network errors from the browser are often CORS-related.
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
             throw new Error('A network error occurred while fetching the transcript. This could be a CORS issue, as this API may not be callable directly from the browser.');
        }
        if (error instanceof Error) {
            throw new Error(error.message);
        }
        throw new Error('An unknown error occurred while fetching the transcript.');
    }
};