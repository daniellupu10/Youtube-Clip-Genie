
import React from 'react';
import type { Clip } from '../types';
import ClipCard from './ClipCard';

interface ClipListProps {
  clips: Clip[];
  showToast: (message: string) => void;
}

const ClipList: React.FC<ClipListProps> = ({ clips, showToast }) => {
  return (
    <div className="mt-12">
        <h2 className="text-3xl font-bold text-center mb-8">Generated Clips</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {clips.map((clip, index) => (
                <ClipCard key={index} clip={clip} showToast={showToast} />
            ))}
        </div>
    </div>
  );
};

export default ClipList;
