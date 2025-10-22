
import React, { useState, useEffect } from 'react';
import type { Clip } from '../types';
import ClipCard from './ClipCard';
import { ClipboardIcon, CheckIcon } from './icons';

interface ClipResultProps {
  clips: Clip[];
  showToast: (message: string) => void;
}

const ClipResult: React.FC<ClipResultProps> = ({ clips, showToast }) => {
  const [selectedClipIndex, setSelectedClipIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // When clips are loaded or updated, select the first one by default.
    if (clips.length > 0) {
      setSelectedClipIndex(0);
    } else {
      setSelectedClipIndex(null);
    }
  }, [clips]);

  const selectedClip = selectedClipIndex !== null ? clips[selectedClipIndex] : null;
  
  const handleCopyTranscript = () => {
    if (!selectedClip || !selectedClip.transcript) return;
    navigator.clipboard.writeText(selectedClip.transcript).then(() => {
        setCopied(true);
        showToast(`Transcript copied to clipboard!`);
        setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!clips || clips.length === 0) {
    return null;
  }

  return (
    <div className="mt-12">
        <h2 className="text-3xl font-bold text-center mb-8">Your Generated Clips</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            
            {/* Left Column: Clip Cards */}
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 rounded-lg">
                {clips.map((clip, index) => (
                    <ClipCard 
                        key={`${clip.videoId}-${clip.startTime}`} 
                        clip={clip} 
                        showToast={showToast}
                        onSelect={() => setSelectedClipIndex(index)}
                        isSelected={index === selectedClipIndex}
                    />
                ))}
            </div>

            {/* Right Column: Transcript Viewer */}
            <div className="lg:sticky top-8 h-fit">
                {selectedClip ? (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-2xl font-bold text-cyan-400">Clip Transcript</h3>
                             <button
                                onClick={handleCopyTranscript}
                                className="p-2 rounded-md hover:bg-slate-600/50 transition-colors flex items-center gap-2 text-slate-300"
                                aria-label="Copy Transcript"
                            >
                                {copied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5 text-slate-400" />}
                                <span className="text-sm">{copied ? 'Copied!' : 'Copy'}</span>
                            </button>
                        </div>
                        <div className="max-h-[55vh] overflow-y-auto pr-3 space-y-4 text-slate-300 leading-relaxed">
                            <p>{selectedClip.transcript}</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full bg-slate-800/30 border border-slate-700 rounded-2xl p-6">
                        <p className="text-slate-500">Select a clip to view its transcript.</p>
                    </div>
                )}
            </div>

        </div>
    </div>
  );
};

export default ClipResult;