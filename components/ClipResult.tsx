// REFACTORED: Removed transcript display completely - users never see raw transcript
// Changed layout to vertical scrollable list with max 2 columns on large screens

import React from 'react';
import type { Clip } from '../types';
import ClipCard from './ClipCard';

interface ClipResultProps {
  clips: Clip[];
  showToast: (message: string) => void;
}

const ClipResult: React.FC<ClipResultProps> = ({ clips, showToast }) => {
  if (!clips || clips.length === 0) {
    return null;
  }

  return (
    <div className="mt-12">
      {/* Header section */}
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-cyan-400 mb-2">Review Your Clips</h2>
        <p className="text-slate-400 text-lg">
          {clips.length} {clips.length === 1 ? 'clip' : 'clips'} generated • Ready to download
        </p>
      </div>

      {/* Vertical scrollable grid layout: 1 column on mobile, max 2 columns on large screens */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-[1600px] mx-auto">
        {clips.map((clip, index) => (
          <ClipCard
            key={`${clip.videoId}-${clip.startTime}-${index}`}
            clip={clip}
            showToast={showToast}
          />
        ))}
      </div>
    </div>
  );
};

export default ClipResult;