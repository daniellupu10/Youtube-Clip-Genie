// ← AWS LAMBDA FAST CLIPPING — REPLACES ALL LOCAL PROCESSING — WORKS INSTANTLY
// Vercel serverless function to invoke AWS Lambda for video clipping
// Alternative: You can call the Lambda Function URL directly from the frontend

import { NextApiRequest, NextApiResponse } from 'next';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

// Initialize Lambda client (uses AWS credentials from environment variables)
const lambda = new LambdaClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

const LAMBDA_FUNCTION_NAME = process.env.LAMBDA_FUNCTION_NAME || 'clip-youtube-video';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { videoId, startTime, endTime, title } = req.body;

    // Validate input
    if (!videoId || !startTime || !endTime) {
      return res.status(400).json({
        error: 'Missing required fields: videoId, startTime, endTime',
      });
    }

    console.log(`📹 Processing clip request: ${videoId} (${startTime} → ${endTime})`);

    // OPTION 1: Invoke Lambda using AWS SDK
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      console.log(`🚀 Invoking Lambda function: ${LAMBDA_FUNCTION_NAME}`);

      const command = new InvokeCommand({
        FunctionName: LAMBDA_FUNCTION_NAME,
        InvocationType: 'RequestResponse', // Synchronous
        Payload: JSON.stringify({
          videoId,
          startTime,
          endTime,
          title: title || 'clip',
        }),
      });

      const response = await lambda.send(command);

      if (!response.Payload) {
        throw new Error('Lambda returned no payload');
      }

      const payloadStr = new TextDecoder().decode(response.Payload);
      const lambdaResponse = JSON.parse(payloadStr);

      // Check if Lambda execution was successful
      if (lambdaResponse.statusCode !== 200) {
        const errorBody = JSON.parse(lambdaResponse.body);
        throw new Error(errorBody.error || 'Lambda execution failed');
      }

      const result = JSON.parse(lambdaResponse.body);
      console.log(`✓ Clip created: ${result.downloadUrl}`);

      return res.status(200).json(result);
    }

    // OPTION 2: Call Lambda Function URL directly (if configured)
    else if (process.env.LAMBDA_FUNCTION_URL) {
      console.log(`🚀 Calling Lambda Function URL: ${process.env.LAMBDA_FUNCTION_URL}`);

      const response = await fetch(process.env.LAMBDA_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          startTime,
          endTime,
          title: title || 'clip',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Lambda returned ${response.status}`);
      }

      const result = await response.json();
      console.log(`✓ Clip created: ${result.downloadUrl}`);

      return res.status(200).json(result);
    }

    // No AWS credentials configured
    else {
      throw new Error(
        'AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or LAMBDA_FUNCTION_URL in environment variables.'
      );
    }

  } catch (error: any) {
    console.error('❌ Clip generation failed:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate clip',
      details: error.toString(),
    });
  }
}

// Optional: Configure API route timeout (Vercel Pro: 60s, Hobby: 10s)
export const config = {
  maxDuration: 60, // seconds (requires Vercel Pro)
};
