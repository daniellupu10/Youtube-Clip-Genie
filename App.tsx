
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import URLInputForm from './components/URLInputForm';
import Loader from './components/Loader';
import ClipList from './components/ClipList';
import type { Clip } from './types';
import { generateClipsFromTranscript } from './services/geminiService';
import { getTranscriptAndDuration } from './services/transcriptService';

const Toast: React.FC<{ message: string; onDismiss: () => void }> = ({ message, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 3000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg text-sm font-semibold z-50">
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
    if (!currentVideoId) {
      setError("Please enter a valid YouTube URL.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setClips([]);

    try {
      // Step 1: Get transcript
      setLoadingMessage("Fetching video transcript...");
      const { transcript: transcriptSegments } = await getTranscriptAndDuration(url);
      
      // Step 2: Format transcript for Gemini
      const fullTranscriptText = transcriptSegments.map(segment => segment.text).join(' ');

      // Step 3: Generate clips from transcript
      setLoadingMessage("Analyzing transcript & generating clips...");
      const generatedClips = await generateClipsFromTranscript(fullTranscriptText);

      // Step 4: Finalize and set state
      const clipsWithId = generatedClips.map(clip => ({ ...clip, videoId: currentVideoId }));
      setClips(clipsWithId);

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

  return (
    <div className="min-h-screen flex flex-col justify-between p-4">
      <main className="container mx-auto px-4 flex-grow">
        <Header />
        <div className="mt-8">
          <URLInputForm onSubmit={handleGenerateClips} isLoading={isLoading} onUrlChange={handleUrlChange} />
           <p className="text-center text-slate-500 text-sm mt-3 max-w-2xl mx-auto">
            The Genie will analyze your video and extract key segments between 1 and 10 minutes long.
          </p>
        </div>
        
        <div className="mt-8">
          {/* Case 1: Loading */}
          {isLoading && (
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
          )}

          {/* Case 2: Not Loading - Display results, error, or initial states */}
          {!isLoading && (
            <>
              {error && (
                <div className="text-center text-red-400 bg-red-900/50 border border-red-700 p-4 rounded-lg max-w-2xl mx-auto">{error}</div>
              )}

              {!error && clips.length > 0 && (
                  <ClipList clips={clips} showToast={showToast} />
              )}

              {!error && clips.length === 0 && (
                <>
                  {thumbnailUrl ? (
                    <div className="max-w-2xl mx-auto rounded-lg overflow-hidden shadow-lg">
                      <img src={thumbnailUrl} alt="YouTube video thumbnail" className="w-full" />
                    </div>
                  ) : (
                    <div className="text-center text-slate-500 mt-16">
                      <p className="text-xl">Your generated clips will appear here.</p>
                      <p>Enter a YouTube URL above to get started.</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
      {toastMessage && <Toast message={toastMessage} onDismiss={dismissToast} />}
    </div>
  );
};

export default App;
