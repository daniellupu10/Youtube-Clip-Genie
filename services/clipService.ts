// ← SUPABASE: Database integration for clips and videos
import type { Clip } from '../types';
import { supabase } from './supabaseClient';

/**
 * Saves or retrieves a user video record in Supabase
 * @param youtubeUrl The full YouTube URL
 * @param videoId The YouTube video ID
 * @param videoTitle Optional video title
 * @param duration Optional video duration in seconds
 * @param thumbnailUrl Optional thumbnail URL
 * @returns The user_video_id (UUID) from Supabase
 */
export const saveUserVideo = async (
  youtubeUrl: string,
  videoId: string,
  videoTitle?: string,
  duration?: number,
  thumbnailUrl?: string
): Promise<string | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return null;
    }

    // Check if video already exists for this user
    const { data: existingVideo, error: fetchError } = await supabase
      .from('user_videos')
      .select('id')
      .eq('user_id', user.id)
      .eq('youtube_url', youtubeUrl)
      .single();

    if (existingVideo) {
      return existingVideo.id;
    }

    // Insert new video record
    const { data, error } = await supabase
      .from('user_videos')
      .insert({
        user_id: user.id,
        youtube_url: youtubeUrl,
        video_id: videoId,
        video_title: videoTitle || null,
        duration: duration || null,
        thumbnail_url: thumbnailUrl || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error saving user video:', error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('Exception saving user video:', error);
    return null;
  }
};

/**
 * Saves a batch of clips to Supabase for a specific video
 * @param userVideoId The user_video UUID from user_videos table
 * @param newClips Array of Clip objects to save
 * @returns Success boolean
 */
export const saveClips = async (userVideoId: string, newClips: Clip[]): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return false;
    }

    // Convert clips to database format
    const clipsToInsert = newClips.map(clip => ({
      user_video_id: userVideoId,
      start_time: timeStringToSeconds(clip.startTime),
      end_time: timeStringToSeconds(clip.endTime),
      title: clip.title,
      description: clip.description || null,
      tags: clip.tags || [],
      transcript: clip.transcript || null,
      thumbnail_url: `https://img.youtube.com/vi/${clip.videoId}/maxresdefault.jpg`,
    }));

    // Insert all clips (ignore duplicates based on unique constraints if any)
    const { error } = await supabase
      .from('clips')
      .insert(clipsToInsert);

    if (error) {
      console.error('Error saving clips:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception saving clips:', error);
    return false;
  }
};

/**
 * Retrieves all clips for the current user from Supabase
 * @returns An array of Clip objects with videoId included
 */
export const getClips = async (): Promise<Clip[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return [];
    }

    // Query clips with their associated video information
    const { data, error } = await supabase
      .from('clips')
      .select(`
        id,
        start_time,
        end_time,
        title,
        description,
        tags,
        transcript,
        thumbnail_url,
        clip_url,
        created_at,
        user_videos!inner(video_id, youtube_url, user_id)
      `)
      .eq('user_videos.user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading clips:', error);
      return [];
    }

    // Convert database format to Clip format
    return (data || []).map(row => ({
      videoId: (row.user_videos as any).video_id,
      title: row.title,
      description: row.description || '',
      tags: row.tags || [],
      startTime: secondsToTimeString(row.start_time),
      endTime: secondsToTimeString(row.end_time),
      transcript: row.transcript || '',
    }));
  } catch (error) {
    console.error('Exception loading clips:', error);
    return [];
  }
};

/**
 * Retrieves clips for a specific video
 * @param videoId The YouTube video ID
 * @returns An array of Clip objects
 */
export const getClipsByVideoId = async (videoId: string): Promise<Clip[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return [];
    }

    const { data, error } = await supabase
      .from('clips')
      .select(`
        id,
        start_time,
        end_time,
        title,
        description,
        tags,
        transcript,
        thumbnail_url,
        clip_url,
        user_videos!inner(video_id, user_id)
      `)
      .eq('user_videos.video_id', videoId)
      .eq('user_videos.user_id', user.id)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error loading clips by video ID:', error);
      return [];
    }

    return (data || []).map(row => ({
      videoId: (row.user_videos as any).video_id,
      title: row.title,
      description: row.description || '',
      tags: row.tags || [],
      startTime: secondsToTimeString(row.start_time),
      endTime: secondsToTimeString(row.end_time),
      transcript: row.transcript || '',
    }));
  } catch (error) {
    console.error('Exception loading clips by video ID:', error);
    return [];
  }
};

/**
 * Deletes all clips for the current user (use with caution!)
 * @returns Success boolean
 */
export const clearClips = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return false;
    }

    // Delete all user videos (clips will be cascade deleted)
    const { error } = await supabase
      .from('user_videos')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error clearing clips:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception clearing clips:', error);
    return false;
  }
};

/**
 * Gets all videos processed by the current user
 * @returns Array of video metadata
 */
export const getUserVideos = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return [];
    }

    const { data, error } = await supabase
      .from('user_videos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading user videos:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception loading user videos:', error);
    return [];
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Converts time string (MM:SS or HH:MM:SS) to total seconds
 */
function timeStringToSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

/**
 * Converts seconds to time string (MM:SS or HH:MM:SS)
 */
function secondsToTimeString(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}
