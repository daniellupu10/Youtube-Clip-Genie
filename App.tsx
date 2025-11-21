// ← SUPABASE: Full integration - loads and saves clips from Supabase database
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import URLInputForm from './components/URLInputForm';
import ClipResult from './components/ClipResult';
import type { Clip } from './types';
import { generateClipsFromTranscript } from './services/geminiService';
import { getTranscriptAndDuration, TranscriptSegment } from './services/transcriptService';
import { useAuth } from './contexts/AuthContext';
import AuthModal from './components/AuthModal';
import PricingModal from './components/PricingModal';
import { PLAN_LIMITS } from './contexts/AuthContext';
import { getClips, saveClips, saveUserVideo } from './services/clipService';


const Toast: React.FC<{ message: string; onDismiss: () => void }> = ({ message, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 3000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-cyan-500 text-slate-900 px-6 py-3 rounded-full shadow-lg text-sm font-semibold z-50">
            {message}
        </div>
    );
};

const getYoutubeVideoId = (url: string): string | null => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
        return match[2];
    }
    return null;
};

const App: React.FC = () => {
  const [clips, setClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('The Genie is working its magic...');

  const { user, loading: authLoading, recordUsage } = useAuth();
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [isPricingModalOpen, setPricingModalOpen] = useState(false);

  // Check for Gemini API key on mount
  useEffect(() => {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!geminiKey || geminiKey === 'undefined' || geminiKey === 'null') {
      console.error('⚠️ GEMINI_API_KEY is not configured!');
      console.error('📝 To fix this:');
      console.error('   1. Create a .env file in the project root');
      console.error('   2. Add: GEMINI_API_KEY=your_actual_api_key');
      console.error('   3. Get your key from: https://makersuite.google.com/app/apikey');
      console.error('   4. Restart the dev server');
    } else {
      console.log('✅ Gemini API key detected');
    }
  }, []);
  
  useEffect(() => {
    const loadClipsFromDatabase = async () => {
      if (user.loggedIn && !authLoading) {
        try {
          const userClips = await getClips();
          setClips(userClips);
        } catch (error) {
          console.error('Error loading clips:', error);
          // Gracefully handle missing database - user can still generate new clips
          console.warn('Could not load clips from database. Database tables may not be set up yet.');
          console.warn('See MUST_RUN_FIRST.md for setup instructions.');
          setClips([]); // Start with empty clips, but app still works
        }
      } else {
        setClips([]); // Clear clips on logout
      }
    };

    loadClipsFromDatabase();
  }, [user.loggedIn, authLoading]);

  const handleUrlChange = useCallback((url: string) => {
    const videoId = getYoutubeVideoId(url);
    setCurrentVideoId(videoId);
    if (videoId) {
      setThumbnailUrl(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
    } else {
      setThumbnailUrl(null);
    }
  }, []);

  const handleGenerateClips = async (url: string) => {
    if (!user.loggedIn) {
      setAuthModalOpen(true);
      return;
    }

    if (!currentVideoId) {
      setError("Please enter a valid YouTube URL.");
      return;
    }
    setIsLoading(true);
    setError(null);

    let transcriptSegments: TranscriptSegment[] = [];
    let databaseAvailable = true;

    try {
      // Step 1: Get transcript and duration
      setLoadingMessage("Fetching video transcript...");
      const { transcript, duration } = await getTranscriptAndDuration(url);
      transcriptSegments = transcript;

      const videoMinutes = Math.ceil(duration / 60);

      // Step 1.5: Validate against plan limits
      let durationLimitExceeded = false;
      let limit = 0;
      if (user.plan === 'free') {
        limit = PLAN_LIMITS.free.videoDuration;
        durationLimitExceeded = videoMinutes > limit;
      } else if (user.plan === 'casual') {
        limit = PLAN_LIMITS.casual.videoDuration;
        durationLimitExceeded = videoMinutes > limit;
      }

      if (durationLimitExceeded) {
          setError(`Your plan is limited to videos under ${limit} minutes. This video is ${videoMinutes} minutes long.`);
          setPricingModalOpen(true);
          setIsLoading(false);
          return;
      }

      // ← SUPABASE: Step 2: Save video metadata to database (graceful failure)
      let userVideoId: string | null = null;
      try {
        console.log('📊 Attempting to save video metadata to database...');
        setLoadingMessage("Saving video metadata...");

        // Add timeout to prevent hanging - if database takes >5s, skip it
        const saveVideoPromise = saveUserVideo(
          url,
          currentVideoId,
          undefined, // video title (optional, can fetch from YouTube API)
          duration,
          thumbnailUrl || undefined
        );

        const timeoutPromise = new Promise<string | null>((resolve) => {
          setTimeout(() => {
            console.warn('⏱️ Database operation timed out after 5 seconds - continuing without database');
            resolve(null);
          }, 5000);
        });

        userVideoId = await Promise.race([saveVideoPromise, timeoutPromise]);

        if (!userVideoId) {
          console.warn('⚠️ Database tables not set up yet. See MUST_RUN_FIRST.md');
          console.warn('📝 App will continue to generate clips without database persistence');
          databaseAvailable = false;
        } else {
          console.log('✅ Video metadata saved to database (ID:', userVideoId, ')');
        }
      } catch (dbError) {
        console.error('❌ Database error (tables may not exist):', dbError);
        console.warn('📝 Continuing without database persistence. See MUST_RUN_FIRST.md');
        databaseAvailable = false;
      }

      console.log('🎬 Proceeding to clip generation (database available:', databaseAvailable, ')');

      // Step 3: Format transcript for Gemini
      const fullTranscriptText = transcriptSegments.map(segment => segment.text).join(' ');

      // Step 4: Generate clips from transcript (ALWAYS runs regardless of database)
      console.log('🚀 About to call Gemini API for clip generation...');
      setLoadingMessage("Analyzing transcript & generating clips...");
      const generatedClips = await generateClipsFromTranscript(fullTranscriptText, transcriptSegments, user.plan);
      const clipsWithId = generatedClips.map(clip => ({ ...clip, videoId: currentVideoId }));

      // ← SUPABASE: Step 5: Save clips to database (graceful failure)
      if (databaseAvailable && userVideoId) {
        try {
          setLoadingMessage("Saving clips to your account...");
          const saveSuccess = await saveClips(userVideoId, clipsWithId);

          if (!saveSuccess) {
            console.warn('Failed to save clips to database');
            databaseAvailable = false;
          }
        } catch (dbError) {
          console.error('Error saving clips:', dbError);
          databaseAvailable = false;
        }
      }

      // Step 6: Record usage (graceful failure)
      if (databaseAvailable) {
        try {
          await recordUsage(videoMinutes);
        } catch (usageError) {
          console.error('Error recording usage:', usageError);
        }
      }

      // Step 7: Display clips (either from database or locally generated)
      if (databaseAvailable) {
        try {
          const updatedClips = await getClips();
          setClips(updatedClips);
        } catch (dbError) {
          console.error('Error loading clips from database:', dbError);
          // Fallback: display locally generated clips
          setClips(clipsWithId);
        }
      } else {
        // Database not available - display locally generated clips
        setClips(clipsWithId);
      }

      // Show appropriate success/warning message
      if (databaseAvailable) {
        setToastMessage(`Successfully generated ${clipsWithId.length} clips!`);
      } else {
        setToastMessage(`Generated ${clipsWithId.length} clips (not saved - database setup required)`);
        console.warn('⚠️ IMPORTANT: Clips generated but NOT saved to database.');
        console.warn('⚠️ Run the SQL schema in Supabase. See MUST_RUN_FIRST.md for instructions.');
      }

    } catch (e) {
      if (e instanceof Error) {
        setError(`An error occurred: ${e.message}`);
      } else {
        setError("An unknown error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
  };

  const dismissToast = () => {
    setToastMessage(null);
  };

  const mainContent = () => {
    // Show loading during auth check
    if (authLoading) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 my-16">
          <div className="w-16 h-16 border-4 border-cyan-400 border-dashed rounded-full animate-spin"></div>
          <p className="text-slate-400 text-lg">Loading...</p>
        </div>
      );
    }

    if (!user.loggedIn && !isLoading) {
      return (
        <div className="text-center text-slate-400 mt-16 bg-slate-800/30 rounded-lg p-10 max-w-2xl mx-auto border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-4">Welcome to Clip Genie!</h2>
          <p className="text-lg">Please log in or sign up to start generating clips.</p>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="mt-6 px-8 py-3 bg-cyan-500 text-slate-900 font-bold rounded-full hover:bg-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 transition-all duration-300 ease-in-out"
          >
            Get Started
          </button>
        </div>
      );
    }

    // Case 1: Loading
    if (isLoading) {
      return (
        <div className="max-w-2xl mx-auto">
          {thumbnailUrl ? (
            <div className="relative rounded-lg overflow-hidden shadow-lg">
              <img
                src={thumbnailUrl}
                alt="YouTube video thumbnail"
                className="w-full opacity-30 transition-opacity duration-300"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/60 p-4">
                <div className="w-16 h-16 border-4 border-cyan-400 border-dashed rounded-full animate-spin"></div>
                <p className="text-slate-200 text-lg mt-4 font-semibold text-center">{loadingMessage}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4 my-16">
              <div className="w-16 h-16 border-4 border-cyan-400 border-dashed rounded-full animate-spin"></div>
              <p className="text-slate-400 text-lg">{loadingMessage}</p>
            </div>
          )}
        </div>
      );
    }

    // Case 2: Not Loading - Display results, error, or initial states
    return (
      <>
        {error && (
          <div className="text-center text-red-400 bg-red-900/50 border border-red-700 p-4 rounded-lg max-w-2xl mx-auto">{error}</div>
        )}

        {!error && clips.length > 0 && (
            <ClipResult clips={clips} showToast={showToast} />
        )}

        {!error && clips.length === 0 && (
          <>
            {thumbnailUrl && user.loggedIn ? (
              <div className="max-w-2xl mx-auto rounded-lg overflow-hidden shadow-lg">
                <img src={thumbnailUrl} alt="YouTube video thumbnail" className="w-full" />
              </div>
            ) : (
              !user.loggedIn || (
                <div className="text-center text-slate-500 mt-16">
                  <p className="text-xl">Your generated clips will appear here.</p>
                  <p className="text-slate-600">Enter a YouTube URL above to get started.</p>
                </div>
              )
            )}
          </>
        )}
      </>
    );
  };


  return (
    <div className="min-h-screen flex flex-col justify-between p-4">
       {isAuthModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
       {isPricingModalOpen && <PricingModal onClose={() => setPricingModalOpen(false)} />}
      <main className="container mx-auto px-4 flex-grow">
        <Header onLoginClick={() => setAuthModalOpen(true)} />
        <div className="mt-8">
          <URLInputForm onSubmit={handleGenerateClips} isLoading={isLoading} onUrlChange={handleUrlChange} onLimitExceeded={() => setPricingModalOpen(true)} />
           <p className="text-center text-slate-500 text-sm mt-3 max-w-2xl mx-auto">
            The Genie will analyze your video and extract key segments between 1 and 10 minutes long.
          </p>
        </div>

        <div className="mt-8">
          {mainContent()}
        </div>
      </main>
      <Footer />
      {toastMessage && <Toast message={toastMessage} onDismiss={dismissToast} />}
    </div>
  );
};

export default App;
