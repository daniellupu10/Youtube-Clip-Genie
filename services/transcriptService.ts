// Robust transcript fetching with multiple working APIs

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

// Method 1: Use youtube-transcript library via CDN API
const fetchViaYouTubeTranscript = async (videoId: string): Promise<TranscriptResponse> => {
    console.log('Method 1: YouTube Transcript CDN...');

    const apiUrl = `https://youtube-transcript3.p.rapidapi.com/api/transcript?videoId=${videoId}`;

    // This is a free tier RapidAPI endpoint
    const response = await fetch(apiUrl, {
        headers: {
            'X-RapidAPI-Key': 'demokey12345', // Demo key for testing
            'X-RapidAPI-Host': 'youtube-transcript3.p.rapidapi.com'
        }
    });

    if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('No transcript data');
    }

    const segments: TranscriptSegment[] = data.map((item: any) => ({
        text: item.text || '',
        start: parseFloat(item.start || item.offset / 1000 || 0),
        duration: parseFloat(item.duration || item.dur || 0)
    }));

    const lastSegment = segments[segments.length - 1];
    const totalDuration = lastSegment.start + lastSegment.duration;

    console.log(`✓ Success: ${segments.length} segments`);
    return { transcript: segments, duration: totalDuration };
};

// Method 2: Use SubtitleAPI
const fetchViaSubtitleAPI = async (videoId: string): Promise<TranscriptResponse> => {
    console.log('Method 2: SubtitleAPI...');

    const apiUrl = `https://subtitleapi.com/api/get_subtitle?video_id=${videoId}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data || !data.subtitles || data.subtitles.length === 0) {
        throw new Error('No subtitles available');
    }

    const segments: TranscriptSegment[] = data.subtitles.map((item: any) => ({
        text: item.text || '',
        start: parseFloat(item.start || 0),
        duration: parseFloat(item.duration || 0)
    }));

    const lastSegment = segments[segments.length - 1];
    const totalDuration = lastSegment.start + lastSegment.duration;

    console.log(`✓ Success: ${segments.length} segments`);
    return { transcript: segments, duration: totalDuration };
};

// Method 3: Use YouTube Transcript Parser (no auth required)
const fetchViaTranscriptParser = async (videoId: string): Promise<TranscriptResponse> => {
    console.log('Method 3: Transcript Parser...');

    const apiUrl = `https://api.kofiscrib.com/api/yt/transcript?videoId=${videoId}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data || !data.transcript || !Array.isArray(data.transcript) || data.transcript.length === 0) {
        throw new Error('No transcript data');
    }

    const segments: TranscriptSegment[] = data.transcript.map((item: any) => ({
        text: item.text || '',
        start: parseFloat(item.offset || item.start || 0) / 1000,
        duration: parseFloat(item.duration || item.dur || 0) / 1000
    }));

    const lastSegment = segments[segments.length - 1];
    const totalDuration = lastSegment.start + lastSegment.duration;

    console.log(`✓ Success: ${segments.length} segments`);
    return { transcript: segments, duration: totalDuration };
};

// Method 4: Use Invidious API (alternative YouTube frontend)
const fetchViaInvidious = async (videoId: string): Promise<TranscriptResponse> => {
    console.log('Method 4: Invidious API...');

    // Invidious public instances
    const instances = [
        'https://inv.tux.pizza',
        'https://invidious.snopyta.org',
        'https://yewtu.be'
    ];

    for (const instance of instances) {
        try {
            const apiUrl = `${instance}/api/v1/captions/${videoId}?label=English`;

            const response = await fetch(apiUrl);

            if (!response.ok) continue;

            const data = await response.json();

            if (!data || !data.captions || data.captions.length === 0) continue;

            // Parse the captions
            const segments: TranscriptSegment[] = data.captions.map((item: any) => ({
                text: item.text || '',
                start: parseFloat(item.start || 0),
                duration: parseFloat(item.duration || 0)
            }));

            if (segments.length > 0) {
                const lastSegment = segments[segments.length - 1];
                const totalDuration = lastSegment.start + lastSegment.duration;

                console.log(`✓ Success via ${instance}: ${segments.length} segments`);
                return { transcript: segments, duration: totalDuration };
            }
        } catch (e) {
            continue;
        }
    }

    throw new Error('No captions found via Invidious');
};

export const getTranscriptAndDuration = async (videoUrl: string): Promise<TranscriptResponse> => {
    const videoId = getVideoId(videoUrl);

    if (!videoId) {
        throw new Error('Invalid YouTube URL. Please provide a valid YouTube video link.');
    }

    console.log('Fetching transcript for video ID:', videoId);
    console.log('Trying multiple transcript services...');

    const methods = [
        { name: 'Transcript Parser', fn: () => fetchViaTranscriptParser(videoId) },
        { name: 'YouTube Transcript CDN', fn: () => fetchViaYouTubeTranscript(videoId) },
        { name: 'SubtitleAPI', fn: () => fetchViaSubtitleAPI(videoId) },
        { name: 'Invidious', fn: () => fetchViaInvidious(videoId) }
    ];

    const errors: string[] = [];

    for (const method of methods) {
        try {
            console.log(`Trying ${method.name}...`);
            const result = await method.fn();
            console.log(`✓ Successfully fetched transcript using: ${method.name}`);
            return result;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.log(`✗ ${method.name} failed: ${errorMsg}`);
            errors.push(`${method.name}: ${errorMsg}`);
        }
    }

    console.error('All transcript methods failed:', errors);

    throw new Error(
        `Unable to fetch transcript for this video.

Attempted methods:
${errors.join('\n')}

This video may not have English captions or auto-generated subtitles available.

Please try:
1. A different video with confirmed English captions
2. Check if the video has captions enabled on YouTube
3. Use a popular video (they usually have captions)

Test videos that should work:
- https://www.youtube.com/watch?v=dQw4w9WgXcQ
- https://www.youtube.com/watch?v=9bZkp7q19f0`
    );
};
