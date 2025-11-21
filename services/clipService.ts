// Simple localStorage-based clip service
// No database required - clips are stored per user in browser localStorage
import type { Clip } from '../types';

const CLIPS_STORAGE_KEY = 'youtube_clips';

/**
 * Get all clips for a specific user from localStorage
 * @param userEmail The user's email (used as key)
 * @returns Array of clips
 */
export const getClips = (userEmail: string): Clip[] => {
  try {
    const allClips = localStorage.getItem(CLIPS_STORAGE_KEY);
    if (!allClips) return [];

    const clipsData = JSON.parse(allClips);
    return clipsData[userEmail] || [];
  } catch (error) {
    console.error('Error loading clips from localStorage:', error);
    return [];
  }
};

/**
 * Save clips for a specific user to localStorage
 * @param clips Array of clips to save
 * @param userEmail The user's email (used as key)
 */
export const saveClips = (clips: Clip[], userEmail: string): void => {
  try {
    const allClips = localStorage.getItem(CLIPS_STORAGE_KEY);
    const clipsData = allClips ? JSON.parse(allClips) : {};

    clipsData[userEmail] = clips;

    localStorage.setItem(CLIPS_STORAGE_KEY, JSON.stringify(clipsData));
    console.log('✅ Saved', clips.length, 'clips to localStorage for', userEmail);
  } catch (error) {
    console.error('Error saving clips to localStorage:', error);
  }
};

/**
 * Clear all clips for a specific user
 * @param userEmail The user's email
 */
export const clearClips = (userEmail: string): void => {
  try {
    const allClips = localStorage.getItem(CLIPS_STORAGE_KEY);
    if (!allClips) return;

    const clipsData = JSON.parse(allClips);
    delete clipsData[userEmail];

    localStorage.setItem(CLIPS_STORAGE_KEY, JSON.stringify(clipsData));
    console.log('✅ Cleared clips for', userEmail);
  } catch (error) {
    console.error('Error clearing clips from localStorage:', error);
  }
};

/**
 * Get clips for a specific video
 * @param userEmail The user's email
 * @param videoId The YouTube video ID
 * @returns Array of clips for that video
 */
export const getClipsByVideoId = (userEmail: string, videoId: string): Clip[] => {
  const allClips = getClips(userEmail);
  return allClips.filter(clip => clip.videoId === videoId);
};

// Note: saveUserVideo is not needed for localStorage implementation
// We keep this stub for compatibility with App.tsx
export const saveUserVideo = async (): Promise<string | null> => {
  // No-op for localStorage version
  return null;
};
