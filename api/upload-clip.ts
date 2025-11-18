// Vercel serverless function to upload video clips to S3
// This runs on the backend with AWS credentials

import { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate AWS credentials are configured
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.error('AWS credentials missing!');
      return res.status(500).json({ error: 'AWS credentials not configured' });
    }

    if (!process.env.AWS_REGION || !process.env.S3_BUCKET_NAME) {
      console.error('AWS region or S3 bucket name missing!');
      return res.status(500).json({ error: 'AWS configuration incomplete' });
    }

    const { clipData, fileName, contentType } = req.body;

    if (!clipData || !fileName) {
      return res.status(400).json({ error: 'Missing clip data or file name' });
    }

    // Initialize S3 client
    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    // Convert base64 to Buffer if needed
    let fileBuffer: Buffer;
    if (clipData.startsWith('data:')) {
      // Extract base64 data from data URL
      const base64Data = clipData.split(',')[1];
      fileBuffer = Buffer.from(base64Data, 'base64');
    } else {
      fileBuffer = Buffer.from(clipData, 'base64');
    }

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `clips/${fileName}`,
      Body: fileBuffer,
      ContentType: contentType || 'video/mp4',
      ACL: 'public-read', // Make clips publicly accessible
    });

    await s3Client.send(command);

    // Generate public URL
    const publicUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/clips/${fileName}`;

    console.log(`✓ Successfully uploaded clip to S3: ${publicUrl}`);

    return res.status(200).json({
      success: true,
      url: publicUrl,
      fileName,
    });

  } catch (error: any) {
    console.error('Error uploading to S3:', error);
    return res.status(500).json({
      error: 'Failed to upload clip to S3',
      details: error.message,
    });
  }
}
