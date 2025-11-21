// REFACTORED: Added thumbnail with play button overlay, embedded playable video
// Removed selection logic, enhanced card styling for vertical list layout

import React from 'react';
import type { Clip } from '../types';
import { ClipboardIcon, CheckIcon, ClockIcon, DownloadIcon, SpinnerIcon } from './icons';
import { API_CONFIG } from '../services/config';

interface ClipCardProps {
  clip: Clip;
  showToast: (message: string) => void;
}

const CopyButton: React.FC<{ textToCopy: string, onCopy: (message: string) => void, fieldName: string }> = ({ textToCopy, onCopy, fieldName }) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
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


const ClipCard: React.FC<ClipCardProps> = ({ clip, showToast }) => {
  // State for video player visibility and interactions
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [isEditingTime, setIsEditingTime] = React.useState(false);
  const [editedStartTime, setEditedStartTime] = React.useState(clip.startTime);
  const [editedEndTime, setEditedEndTime] = React.useState(clip.endTime);

  const currentStartTime = isEditingTime ? editedStartTime : clip.startTime;
  const currentEndTime = isEditingTime ? editedEndTime : clip.endTime;

  const startSeconds = timeToSeconds(currentStartTime);
  const endSeconds = timeToSeconds(currentEndTime);

  // YouTube embed URL with autoplay when playing
  const embedUrl = `https://www.youtube.com/embed/${clip.videoId}?start=${startSeconds}&end=${endSeconds}&rel=0&modestbranding=1&iv_load_policy=3${isPlaying ? '&autoplay=1' : ''}`;

  // YouTube thumbnail URL (high quality)
  const thumbnailUrl = `https://img.youtube.com/vi/${clip.videoId}/hqdefault.jpg`;

  const areTimestampsValid = currentStartTime && currentEndTime;

  const handlePlayClick = () => {
    setIsPlaying(true);
  };

  const handleSaveTime = (e: React.MouseEvent) => {
    e.stopPropagation();
    clip.startTime = editedStartTime;
    clip.endTime = editedEndTime;
    setIsEditingTime(false);
    showToast("Timestamps updated!");
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedStartTime(clip.startTime);
    setEditedEndTime(clip.endTime);
    setIsEditingTime(false);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTime(true);
  };

  // ← AWS LAMBDA FAST CLIPPING — REPLACES ALL LOCAL PROCESSING — WORKS INSTANTLY
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    showToast("🚀 Processing your clip with AWS Lambda... This takes 5-20 seconds.");

    try {
        // Call AWS Lambda via API Gateway (serverless video clipping with FFMPEG + yt-dlp)
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
                const errorData = await response.json();
                if (errorData && errorData.error) {
                    errorMsg = errorData.error;
                }
            } catch (e) {
                errorMsg = response.statusText || errorMsg;
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();

        // Lambda returns direct S3 public URL - trigger instant download
        if (data.downloadUrl) {
            showToast("✓ Clip ready! Starting download...");

            // Create temporary link and trigger download
            const link = document.createElement('a');
            link.href = data.downloadUrl;
            link.download = `${clip.title || 'clip'}.mp4`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast(`✓ Download started! (${data.duration || ''}s clip)`);
        } else {
            throw new Error('No download URL received from server');
        }

    } catch (error) {
        console.error("Download failed:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown network error occurred.";
        showToast(`❌ Download failed: ${errorMessage}`);
    } finally {
        setIsDownloading(false);
    }
  };


  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl hover:shadow-cyan-500/20 hover:border-slate-600 transform transition-all duration-300">
      {/* Video Player Section with Thumbnail and Play Button */}
      <div className="relative aspect-video bg-slate-900">
        {areTimestampsValid ? (
          <>
            {!isPlaying ? (
              // Thumbnail with play button overlay
              <div className="relative w-full h-full group cursor-pointer" onClick={handlePlayClick}>
                <img
                  src={thumbnailUrl}
                  alt={clip.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to default thumbnail if high quality doesn't exist
                    e.currentTarget.src = `https://img.youtube.com/vi/${clip.videoId}/mqdefault.jpg`;
                  }}
                />
                {/* Dark overlay on hover */}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-all duration-300"></div>

                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center group-hover:bg-red-700 group-hover:scale-110 transition-all duration-300 shadow-2xl">
                    <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>

                {/* Duration badge */}
                <div className="absolute bottom-3 right-3 bg-black/80 text-white text-xs font-semibold px-2 py-1 rounded">
                  {currentStartTime} - {currentEndTime}
                </div>
              </div>
            ) : (
              // Embedded YouTube player (playable)
              <iframe
                src={embedUrl}
                title={`YouTube video player: ${clip.title}`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              ></iframe>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-center text-red-400 p-4">
            <p>Invalid timestamp provided for this clip.</p>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-6">
        {/* Title Section */}
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-2xl font-bold text-white flex-1 pr-2 leading-tight">{clip.title || "No Title"}</h3>
          <CopyButton textToCopy={clip.title} onCopy={showToast} fieldName="Title" />
        </div>

        {/* Timestamp Section */}
        <div className="mb-4">
          {!isEditingTime ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300 bg-slate-700/50 px-3 py-2 rounded-lg">
                <ClockIcon className="w-5 h-5 text-cyan-400" />
                <span className="font-mono text-sm font-medium">{currentStartTime || "??:??"} - {currentEndTime || "??:??"}</span>
              </div>
              <button
                onClick={handleEditClick}
                className="text-sm text-cyan-400 hover:text-cyan-300 underline font-medium transition-colors"
              >
                Edit Times
              </button>
            </div>
          ) : (
            <div className="bg-slate-700/50 p-4 rounded-lg space-y-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-400 font-medium">Start Time (MM:SS or HH:MM:SS)</label>
                <input
                  type="text"
                  value={editedStartTime}
                  onChange={(e) => {e.stopPropagation(); setEditedStartTime(e.target.value)}}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-slate-800 text-slate-200 px-3 py-2 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="00:00"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-400 font-medium">End Time (MM:SS or HH:MM:SS)</label>
                <input
                  type="text"
                  value={editedEndTime}
                  onChange={(e) => {e.stopPropagation(); setEditedEndTime(e.target.value)}}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-slate-800 text-slate-200 px-3 py-2 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="10:00"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveTime}
                  className="flex-1 bg-cyan-500 text-slate-900 font-semibold py-2 rounded-lg hover:bg-cyan-400 transition"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 bg-slate-600 text-slate-200 font-semibold py-2 rounded-lg hover:bg-slate-500 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Description Section */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold text-slate-200 text-sm uppercase tracking-wide">Description</h4>
            <CopyButton textToCopy={clip.description} onCopy={showToast} fieldName="Description" />
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">{clip.description || "No description provided."}</p>
        </div>

        {/* Tags Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold text-slate-200 text-sm uppercase tracking-wide">Tags</h4>
            <CopyButton textToCopy={(clip.tags || []).join(', ')} onCopy={showToast} fieldName="Tags" />
          </div>
          <div className="flex flex-wrap gap-2">
            {(clip.tags && clip.tags.length > 0) ? clip.tags.map((tag, index) => (
              <span key={index} className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-medium px-3 py-1.5 rounded-full">
                {tag}
              </span>
            )) : (<p className="text-slate-500 text-sm">No tags provided.</p>)}
          </div>
        </div>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-bold rounded-xl hover:from-cyan-500 hover:to-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 transition-all duration-300 ease-in-out disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-wait shadow-lg hover:shadow-cyan-500/50"
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
