// Vercel serverless function to fetch YouTube transcripts
// This runs on the backend, avoiding CORS issues

import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { videoId } = req.query;

  if (!videoId || typeof videoId !== 'string') {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  // Check if TRANSCRIPT_API_KEY is available
  const transcriptApiKey = process.env.TRANSCRIPT_API_KEY;
  console.log('TRANSCRIPT_API_KEY check:', transcriptApiKey ? `Available (${transcriptApiKey.substring(0, 10)}...)` : 'MISSING!');

  try {
    const errors: string[] = [];

    // Method 1: Use your paid RapidAPI transcript service (PRIMARY)
    const sources = [
      {
        name: 'RapidAPI YouTube Transcript (PAID)',
        url: `https://youtube-transcript3.p.rapidapi.com/api/transcript`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': transcriptApiKey || '',
          'X-RapidAPI-Host': 'youtube-transcript3.p.rapidapi.com'
        },
        body: JSON.stringify({ video_id: videoId, lang: 'en' })
      },
      {
        name: 'Kofiscrib API',
        url: `https://api.kofiscrib.com/api/yt/transcript?videoId=${videoId}`,
        method: 'GET'
      },
      {
        name: 'YouTube Transcript Deno',
        url: `https://youtube-transcript-api.deno.dev/${videoId}`,
        method: 'GET'
      },
      {
        name: 'Direct YouTube API',
        url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`,
        method: 'GET'
      }
    ];

    for (const source of sources) {
      try {
        console.log(`Trying ${source.name}...`);

        const fetchOptions: any = {
          method: source.method,
        };

        if (source.headers) {
          fetchOptions.headers = source.headers;
        }

        if (source.body) {
          fetchOptions.body = source.body;
        }

        const response = await fetch(source.url, fetchOptions);

        console.log(`${source.name} HTTP status:`, response.status);

        if (response.ok) {
          const data = await response.json();
          console.log(`${source.name} response:`, JSON.stringify(data).substring(0, 200));

          // Normalize the data format
          let transcript;

          // Handle different API response formats
          if (Array.isArray(data)) {
            transcript = data;
          } else if (data.transcript && Array.isArray(data.transcript)) {
            transcript = data.transcript;
          } else if (data.events && Array.isArray(data.events)) {
            // YouTube timedtext format
            transcript = data.events
              .filter((e: any) => e.segs)
              .flatMap((e: any) => e.segs.map((s: any) => ({
                text: s.utf8 || '',
                start: e.tStartMs / 1000,
                duration: (e.dDurationMs || 0) / 1000
              })));
          } else if (data.captions && Array.isArray(data.captions)) {
            transcript = data.captions;
          } else {
            errors.push(`${source.name}: Unexpected format`);
            continue;
          }

          // Convert to our format
          const segments = transcript.map((item: any) => ({
            text: item.text || item.utf8 || '',
            start: parseFloat(item.offset || item.start || item.tStartMs || 0) / (item.tStartMs ? 1 : 1000),
            duration: parseFloat(item.duration || item.dur || item.dDurationMs || 0) / (item.dDurationMs ? 1 : 1000)
          })).filter((s: any) => s.text.trim());

          if (segments.length > 0) {
            console.log(`✓ ${source.name} succeeded with ${segments.length} segments`);
            return res.status(200).json({ transcript: segments });
          }
        } else {
          // Log the error response body
          const errorText = await response.text();
          console.error(`${source.name} failed with ${response.status}:`, errorText);
          errors.push(`${source.name}: HTTP ${response.status} - ${errorText.substring(0, 100)}`);
        }
      } catch (e: any) {
        errors.push(`${source.name}: ${e.message}`);
        console.error(`Error with ${source.name}:`, e);
      }
    }

    console.error('All transcript sources failed:', errors);
    return res.status(404).json({
      error: 'No English captions available for this video. Please try a video with captions enabled.',
      details: errors
    });
  } catch (error: any) {
    console.error('Error fetching transcript:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
