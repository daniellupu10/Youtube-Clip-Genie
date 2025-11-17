// Multi-method transcript fetching with fallbacks
// Tries multiple reliable services until one works

export interface TranscriptSegment {
    text: string;
    start: number;
    duration: number;
}

export interface TranscriptResponse {
    transcript: TranscriptSegment[];
    duration: number;
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

// Method 1: Use YT Transcript API (most reliable)
const fetchViaYTTranscriptAPI = async (videoUrl: string): Promise<TranscriptResponse> => {
    const videoId = getVideoId(videoUrl);
    if (!videoId) throw new Error('Invalid video ID');

    console.log('Method 1: Trying YT Transcript API...');

    // This is a free public API specifically for YouTube transcripts
    const apiUrl = `https://yt-transcript-api.vercel.app/api/transcript?url=${encodeURIComponent(videoUrl)}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('No transcript data returned');
    }

    // Convert to our format
    const segments: TranscriptSegment[] = data.map((item: any) => ({
        text: item.text || '',
        start: item.offset / 1000, // Convert ms to seconds
        duration: item.duration / 1000 // Convert ms to seconds
    }));

    const lastSegment = segments[segments.length - 1];
    const totalDuration = lastSegment.start + lastSegment.duration;

    console.log(`✓ Success with YT Transcript API: ${segments.length} segments`);

    return {
        transcript: segments,
        duration: totalDuration
    };
};

// Method 2: Use youtube-caption-extractor API
const fetchViaYouTubeCaptionExtractor = async (videoUrl: string): Promise<TranscriptResponse> => {
    const videoId = getVideoId(videoUrl);
    if (!videoId) throw new Error('Invalid video ID');

    console.log('Method 2: Trying YouTube Caption Extractor...');

    const apiUrl = `https://youtube-caption-extractor.vercel.app/api/transcript?videoId=${videoId}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('No transcript data returned');
    }

    // Convert to our format
    const segments: TranscriptSegment[] = data.map((item: any) => ({
        text: item.text || '',
        start: parseFloat(item.start || 0),
        duration: parseFloat(item.dur || item.duration || 0)
    }));

    const lastSegment = segments[segments.length - 1];
    const totalDuration = lastSegment.start + lastSegment.duration;

    console.log(`✓ Success with Caption Extractor: ${segments.length} segments`);

    return {
        transcript: segments,
        duration: totalDuration
    };
};

// Method 3: Use direct fetch with CORS.SH proxy (paid service, very reliable)
const fetchViaDirectWithProxy = async (videoUrl: string): Promise<TranscriptResponse> => {
    const videoId = getVideoId(videoUrl);
    if (!videoId) throw new Error('Invalid video ID');

    console.log('Method 3: Trying direct fetch via proxy...');

    // Try YouTube's timedtext API through a reliable proxy
    const languages = ['en', 'en-US', 'en-GB', 'a.en'];

    for (const lang of languages) {
        try {
            const ytUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}`;
            const proxyUrl = `https://proxy.cors.sh/${ytUrl}`;

            const response = await fetch(proxyUrl, {
                headers: {
                    'x-cors-api-key': 'temp_6b3e7f4c8d2a1e9f5b8c3d7a4e1f6b2c' // Free tier
                }
            });

            if (!response.ok) continue;

            const xmlText = await response.text();

            if (!xmlText || !xmlText.includes('<text')) continue;

            // Parse XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
            const textElements = xmlDoc.getElementsByTagName('text');

            const segments: TranscriptSegment[] = [];
            for (let i = 0; i < textElements.length; i++) {
                const element = textElements[i];
                const start = parseFloat(element.getAttribute('start') || '0');
                const duration = parseFloat(element.getAttribute('dur') || '0');
                const text = element.textContent || '';

                const decodedText = text
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .trim();

                if (decodedText) {
                    segments.push({ text: decodedText, start, duration });
                }
            }

            if (segments.length > 0) {
                const lastSegment = segments[segments.length - 1];
                const totalDuration = lastSegment.start + lastSegment.duration;

                console.log(`✓ Success with proxy method: ${segments.length} segments`);

                return {
                    transcript: segments,
                    duration: totalDuration
                };
            }
        } catch (e) {
            continue;
        }
    }

    throw new Error('No captions found with proxy method');
};

export const getTranscriptAndDuration = async (videoUrl: string): Promise<TranscriptResponse> => {
    const videoId = getVideoId(videoUrl);

    if (!videoId) {
        throw new Error('Invalid YouTube URL. Please provide a valid YouTube video link.');
    }

    console.log('Fetching transcript for video ID:', videoId);
    console.log('Trying multiple methods...');

    const methods = [
        { name: 'YT Transcript API', fn: fetchViaYTTranscriptAPI },
        { name: 'Caption Extractor', fn: fetchViaYouTubeCaptionExtractor },
        { name: 'Direct with Proxy', fn: fetchViaDirectWithProxy }
    ];

    let lastError: Error | null = null;

    // Try each method in order
    for (const method of methods) {
        try {
            const result = await method.fn(videoUrl);
            console.log(`✓ Successfully fetched transcript using: ${method.name}`);
            return result;
        } catch (error) {
            console.log(`✗ ${method.name} failed:`, error instanceof Error ? error.message : error);
            lastError = error instanceof Error ? error : new Error('Unknown error');
            // Continue to next method
        }
    }

    // If all methods failed
    console.error('All transcript fetching methods failed');
    throw new Error(
        'Unable to fetch transcript for this video. The video may not have English captions or auto-generated subtitles available. ' +
        'Please try a different video or make sure the video has captions enabled.'
    );
};
