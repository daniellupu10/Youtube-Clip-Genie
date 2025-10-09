
import React from 'react';
import { YouTubeIcon } from './icons';

const Header: React.FC = () => {
  return (
    <header className="py-6 sm:py-8">
      <div className="container mx-auto px-4 flex justify-center items-center gap-4">
        <YouTubeIcon className="w-10 h-auto sm:w-12" />
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
          YouTube Clip Genie
        </h1>
      </div>
        <p className="text-center text-slate-400 mt-3 text-lg">AI-Powered Clips, Instantly.</p>
    </header>
  );
};

export default Header;
