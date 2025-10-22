
import React from 'react';
import type { Clip } from '../types';
import { ClipboardIcon, CheckIcon, ClockIcon, DownloadIcon, SpinnerIcon } from './icons';
import { API_CONFIG } from '../services/config';

interface ClipCardProps {
  clip: Clip;
  showToast: (message: string) => void;
  onSelect: () => void;
  isSelected: boolean;
}

const CopyButton: React.FC<{ textToCopy: string, onCopy: (message: string) => void, fieldName: string }> = ({ textToCopy, onCopy, fieldName }) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card selection when clicking copy button
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopied(true);
            onCopy(`${fieldName} copied to clipboard!`);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-slate-600/50 transition-colors"
            aria-label={`Copy ${fieldName}`}
        >
            {copied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5 text-slate-400" />}
        </button>
    );
};

const timeToSeconds = (time: string): number => {
    if (!time || !time.includes(':')) return 0;
    const parts = time.split(':').map(Number);
    if (parts.some(isNaN)) return 0;

    if (parts.length === 2) { // MM:SS
        return (parts[0] * 60) + parts[1];
    }
    if (parts.length === 3) { // HH:MM:SS
        return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    }
    return 0;
};


const ClipCard: React.FC<ClipCardProps> = ({ clip, showToast, onSelect, isSelected }) => {
  const [isDownloading, setIsDownloading] = React.useState(false);
  
  const startSeconds = timeToSeconds(clip.startTime);
  const endSeconds = timeToSeconds(clip.endTime);
  const embedUrl = `https://www.youtube.com/embed/${clip.videoId}?start=${startSeconds}&end=${endSeconds}&rel=0&modestbranding=1&iv_load_policy=3`;
  
  const areTimestampsValid = clip.startTime && clip.endTime;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    showToast("Preparing your clip on the server... This may take a moment.");
    
    try {
        // FIX: Explicitly use window.fetch to avoid bundler issues that cause "require is not defined" error.
        const response = await window.fetch(
            API_CONFIG.EXPORT_MP4_ENDPOINT,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    videoId: clip.videoId,
                    startTime: clip.startTime,
                    endTime: clip.endTime,
                    title: clip.title,
                }),
            }
        );

        if (!response.ok) {
            let errorMsg = `Server responded with status ${response.status}`;
            try {
                // Try to parse a specific error message from the backend
                const errorData = await response.json();
                if (errorData && errorData.error) {
                    errorMsg = errorData.error;
                }
            } catch (e) {
                // If the body isn't JSON, use the status text as a fallback
                errorMsg = response.statusText || errorMsg;
            }
            throw new Error(errorMsg);
        }
        
        const data = await response.json();
        // Trigger the download by opening the S3 link
        window.open(data.downloadUrl, "_blank");

    } catch (error) {
        console.error("Download failed:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown network error occurred.";
        showToast(`Download failed: ${errorMessage}`);
    } finally {
        setIsDownloading(false);
    }
  };


  return (
    <div 
        className={`bg-slate-800/50 border rounded-2xl overflow-hidden shadow-lg transform transition-all duration-300 cursor-pointer ${isSelected ? 'scale-[1.02] shadow-cyan-500/30 border-cyan-500' : 'border-slate-700 hover:border-slate-500'}`}
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
    >
      <div className="aspect-w-16 aspect-h-9 bg-slate-900 flex items-center justify-center">
        {areTimestampsValid ? (
            <iframe
                src={embedUrl}
                title={`YouTube video player: ${clip.title}`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full pointer-events-none" // Make iframe non-interactive to allow parent click
            ></iframe>
        ) : (
            <div className="text-center text-red-400 p-4">
                <p>Invalid timestamp provided for this clip.</p>
            </div>
        )}
      </div>
      <div className="p-6">
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-xl font-bold text-cyan-400 flex-1 pr-2">{clip.title || "No Title"}</h3>
            <CopyButton textToCopy={clip.title} onCopy={showToast} fieldName="Title" />
        </div>
        
        <div className="flex items-center justify-start mb-4">
            <div className="flex items-center gap-2 text-slate-400 bg-slate-700/50 px-3 py-1.5 rounded-full">
                <ClockIcon className="w-5 h-5" />
                <span className="font-mono text-sm">{clip.startTime || "??:??"} - {clip.endTime || "??:??"}</span>
            </div>
        </div>

        <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
                <h4 className="font-semibold text-slate-300">Description</h4>
                <CopyButton textToCopy={clip.description} onCopy={showToast} fieldName="Description" />
            </div>
            <p className="text-slate-400 text-sm max-h-24 overflow-y-auto pr-2">{clip.description || "No description provided."}</p>
        </div>
        
        <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-slate-300">Tags</h4>
                <CopyButton textToCopy={(clip.tags || []).join(', ')} onCopy={showToast} fieldName="Tags" />
            </div>
            <div className="flex flex-wrap gap-2">
            {(clip.tags && clip.tags.length > 0) ? clip.tags.map((tag, index) => (
                <span key={index} className="bg-slate-700 text-cyan-300 text-xs font-medium px-2.5 py-1 rounded-full">
                {tag}
                </span>
            )) : (<p className="text-slate-500 text-sm">No tags provided.</p>)}
            </div>
        </div>

        <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-slate-700 text-cyan-300 font-bold rounded-lg hover:bg-slate-600 focus:outline-none focus:ring-4 focus:ring-slate-600/50 transition-all duration-300 ease-in-out disabled:bg-slate-700/50 disabled:cursor-wait"
        >
          {isDownloading ? (
              <>
                <SpinnerIcon className="w-5 h-5" />
                <span>Preparing Clip...</span>
              </>
          ) : (
              <>
                <DownloadIcon className="w-5 h-5" />
                <span>Download Clip</span>
              </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ClipCard;
