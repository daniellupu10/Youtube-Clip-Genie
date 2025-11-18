// Service for uploading video clips to S3 via backend API

export interface UploadClipResponse {
  success: boolean;
  url: string;
  fileName: string;
}

/**
 * Upload a video clip to S3
 * @param clipBlob The video clip as a Blob
 * @param videoId The YouTube video ID
 * @param clipIndex The index of the clip (for naming)
 * @returns Upload response with public URL
 */
export const uploadClipToS3 = async (
  clipBlob: Blob,
  videoId: string,
  clipIndex: number
): Promise<UploadClipResponse> => {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${videoId}_clip_${clipIndex}_${timestamp}.mp4`;

    // Convert Blob to base64
    const base64Data = await blobToBase64(clipBlob);

    // Call backend API to upload to S3
    const response = await fetch('/api/upload-clip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clipData: base64Data,
        fileName,
        contentType: 'video/mp4',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to upload clip');
    }

    const data: UploadClipResponse = await response.json();
    console.log(`✓ Clip uploaded successfully: ${data.url}`);

    return data;
  } catch (error) {
    console.error('Error uploading clip to S3:', error);
    throw error;
  }
};

/**
 * Convert Blob to base64 string
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Test S3 connection by uploading a small test file
 */
export const testS3Connection = async (): Promise<boolean> => {
  try {
    const testBlob = new Blob(['test'], { type: 'text/plain' });
    const result = await uploadClipToS3(testBlob, 'test', 0);
    console.log('✓ S3 connection test successful:', result.url);
    return true;
  } catch (error) {
    console.error('✗ S3 connection test failed:', error);
    return false;
  }
};
