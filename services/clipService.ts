import type { Clip } from '../types';

const getStorageKey = (email: string) => `YOUTUBE_CLIP_GENIE_CLIPS_${email}`;

/**
 * Retrieves all clips for a specific user from local storage.
 * @param email The user's email to identify their data.
 * @returns An array of Clip objects.
 */
export const getClips = (email: string): Clip[] => {
    if (!email) return [];
    try {
        const item = window.localStorage.getItem(getStorageKey(email));
        if (item) {
            const clips = JSON.parse(item);
            if (Array.isArray(clips)) {
                return clips;
            }
        }
    } catch (error) {
        console.error("Error reading clips from localStorage", error);
    }
    return [];
};

/**
 * Saves a new set of clips for a specific user, appending them to their existing clips.
 * @param newClips An array of new Clip objects to save.
 * @param email The user's email to identify their data.
 */
export const saveClips = (newClips: Clip[], email: string): void => {
    if (!email) return;
    try {
        const existingClips = getClips(email);
        // A simple way to avoid duplicates if generation is re-run on the same video
        const existingUrls = new Set(existingClips.map(c => `${c.videoId}-${c.startTime}`));
        const uniqueNewClips = newClips.filter(c => !existingUrls.has(`${c.videoId}-${c.startTime}`));

        const allClips = [...existingClips, ...uniqueNewClips];
        window.localStorage.setItem(getStorageKey(email), JSON.stringify(allClips));
    } catch (error) {
        console.error("Error saving clips to localStorage", error);
    }
};

/**
 * Clears all clips for a specific user from local storage.
 * @param email The user's email to identify their data.
 */
export const clearClips = (email: string): void => {
     if (!email) return;
     try {
        window.localStorage.removeItem(getStorageKey(email));
    } catch (error) {
        console.error("Error clearing clips from localStorage", error);
    }
}
