// Simple backend-based transcript fetching
// Uses our own Vercel serverless function to avoid CORS

export interface TranscriptSegment {
    text: string;
    start: number;
    duration: number;
}

export interface TranscriptResponse {
    transcript: TranscriptSegment[];
    duration: number;
}

const getVideoId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
        return match[2];
    }
    return null;
};

export const getTranscriptAndDuration = async (videoUrl: string): Promise<TranscriptResponse> => {
    const videoId = getVideoId(videoUrl);

    if (!videoId) {
        throw new Error('Invalid YouTube URL. Please provide a valid YouTube video link.');
    }

    console.log('Fetching transcript for video ID:', videoId);

    try {
        // Use our own backend API (deployed on Vercel)
        // This avoids CORS issues since it's server-side
        const response = await fetch(`/api/transcript?videoId=${videoId}`);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('No English captions available for this video. Please try a video with captions enabled.');
            }
            throw new Error(`Failed to fetch transcript: ${response.status}`);
        }

        const data = await response.json();

        if (!data || !data.transcript || !Array.isArray(data.transcript) || data.transcript.length === 0) {
            throw new Error('No transcript data received');
        }

        const segments: TranscriptSegment[] = data.transcript;
        const lastSegment = segments[segments.length - 1];
        const totalDuration = lastSegment.start + lastSegment.duration;

        console.log(`✓ Successfully fetched transcript: ${segments.length} segments, ${Math.floor(totalDuration/60)} minutes`);

        return {
            transcript: segments,
            duration: totalDuration
        };

    } catch (error) {
        console.error('Error fetching transcript:', error);

        if (error instanceof Error) {
            throw error;
        }

        throw new Error('Unable to fetch transcript for this video. Please ensure the video has English captions or auto-generated subtitles enabled.');
    }
};
