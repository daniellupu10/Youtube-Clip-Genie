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

  try {
    // Try multiple transcript sources
    const sources = [
      `https://api.kofiscrib.com/api/yt/transcript?videoId=${videoId}`,
      `https://youtube-transcript-api.deno.dev/${videoId}`,
    ];

    for (const source of sources) {
      try {
        const response = await fetch(source);
        if (response.ok) {
          const data = await response.json();

          // Normalize the data format
          let transcript;
          if (Array.isArray(data)) {
            transcript = data;
          } else if (data.transcript && Array.isArray(data.transcript)) {
            transcript = data.transcript;
          } else {
            continue;
          }

          // Convert to our format
          const segments = transcript.map((item: any) => ({
            text: item.text || '',
            start: parseFloat(item.offset || item.start || 0) / 1000,
            duration: parseFloat(item.duration || item.dur || 0) / 1000
          }));

          if (segments.length > 0) {
            return res.status(200).json({ transcript: segments });
          }
        }
      } catch (e) {
        continue;
      }
    }

    return res.status(404).json({ error: 'No transcript found' });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
