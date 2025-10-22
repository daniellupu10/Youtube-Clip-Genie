import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { YouTubeIcon } from './icons';
import UserStatus from './UserStatus';

interface HeaderProps {
  onLoginClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLoginClick }) => {
  const { user } = useAuth();

  return (
    <header className="py-6 sm:py-8 relative">
      <div className="container mx-auto px-4 flex justify-center items-center gap-4">
        <YouTubeIcon className="w-10 h-auto sm:w-12" />
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
          YouTube Clip Genie
        </h1>
      </div>
      <p className="text-center text-slate-400 mt-3 text-lg">AI-Powered Clips, Instantly.</p>
      
      <div className="absolute top-4 right-4">
        {user.loggedIn ? (
          <UserStatus />
        ) : (
          <button
            onClick={onLoginClick}
            className="px-6 py-2 bg-cyan-500 text-slate-900 font-bold rounded-full hover:bg-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 transition-all duration-300 ease-in-out"
          >
            Login
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
