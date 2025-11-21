// ← SUPABASE: Storage integration for video clips
import { supabase } from './supabaseClient';

export interface UploadClipResponse {
  success: boolean;
  url: string;
  fileName: string;
}

/**
 * Upload a video clip to Supabase Storage
 * @param clipBlob The video clip as a Blob
 * @param videoId The YouTube video ID
 * @param clipIndex The index of the clip (for naming)
 * @returns Upload response with public URL
 */
export const uploadClipToSupabase = async (
  clipBlob: Blob,
  videoId: string,
  clipIndex: number
): Promise<UploadClipResponse> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${videoId}_clip_${clipIndex}_${timestamp}.mp4`;

    // File path: {userId}/{videoId}/{fileName}
    const filePath = `${user.id}/${videoId}/${fileName}`;

    // Upload to Supabase Storage bucket 'clips'
    const { data, error } = await supabase.storage
      .from('clips')
      .upload(filePath, clipBlob, {
        contentType: 'video/mp4',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Supabase Storage error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL for the uploaded file
    const { data: publicUrlData } = supabase.storage
      .from('clips')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    console.log(`✓ Clip uploaded successfully to Supabase: ${publicUrl}`);

    return {
      success: true,
      url: publicUrl,
      fileName: fileName,
    };
  } catch (error) {
    console.error('Error uploading clip to Supabase:', error);
    throw error;
  }
};

/**
 * Upload a video clip to S3 (legacy fallback if Supabase Storage not available)
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
    console.log(`✓ Clip uploaded successfully to S3: ${data.url}`);

    return data;
  } catch (error) {
    console.error('Error uploading clip to S3:', error);
    throw error;
  }
};

/**
 * Upload clip - tries Supabase first, falls back to S3
 * @param clipBlob The video clip as a Blob
 * @param videoId The YouTube video ID
 * @param clipIndex The index of the clip (for naming)
 * @returns Upload response with public URL
 */
export const uploadClip = async (
  clipBlob: Blob,
  videoId: string,
  clipIndex: number
): Promise<UploadClipResponse> => {
  try {
    // Try Supabase Storage first
    return await uploadClipToSupabase(clipBlob, videoId, clipIndex);
  } catch (supabaseError) {
    console.warn('Supabase upload failed, falling back to S3:', supabaseError);
    // Fallback to S3
    return await uploadClipToS3(clipBlob, videoId, clipIndex);
  }
};

/**
 * Delete a clip from Supabase Storage
 * @param filePath The file path in the storage bucket
 */
export const deleteClipFromSupabase = async (filePath: string): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from('clips')
      .remove([filePath]);

    if (error) {
      console.error('Error deleting clip from Supabase:', error);
      return false;
    }

    console.log(`✓ Clip deleted successfully: ${filePath}`);
    return true;
  } catch (error) {
    console.error('Exception deleting clip:', error);
    return false;
  }
};

/**
 * Get a signed URL for a clip (for private buckets)
 * @param filePath The file path in the storage bucket
 * @param expiresIn Expiration time in seconds (default: 1 hour)
 */
export const getSignedUrl = async (filePath: string, expiresIn: number = 3600): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from('clips')
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Exception creating signed URL:', error);
    return null;
  }
};

/**
 * Convert Blob to base64 string (for S3 fallback)
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
 * Test Supabase Storage connection
 */
export const testSupabaseStorage = async (): Promise<boolean> => {
  try {
    const testBlob = new Blob(['test'], { type: 'text/plain' });
    const result = await uploadClipToSupabase(testBlob, 'test', 0);
    console.log('✓ Supabase Storage test successful:', result.url);
    return true;
  } catch (error) {
    console.error('✗ Supabase Storage test failed:', error);
    return false;
  }
};

/**
 * Test S3 connection (legacy)
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
