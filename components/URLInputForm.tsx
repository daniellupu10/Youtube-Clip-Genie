import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PLAN_LIMITS } from '../contexts/AuthContext';


interface URLInputFormProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
  onUrlChange: (url: string) => void;
  onLimitExceeded: () => void;
}

const URLInputForm: React.FC<URLInputFormProps> = ({ onSubmit, isLoading, onUrlChange, onLimitExceeded }) => {
  const [url, setUrl] = useState('');
  const { user } = useAuth();
  
  let videosExceeded = false;
  let disabledReason = '';

  if (!user.loggedIn) {
    disabledReason = 'Please log in to generate clips.';
  } else {
    switch (user.plan) {
      case 'free':
        videosExceeded = user.usage.videosProcessed >= PLAN_LIMITS.free.videos;
        if (videosExceeded) disabledReason = 'You have reached your monthly video limit.';
        break;
      case 'casual':
        videosExceeded = user.usage.videosProcessed >= PLAN_LIMITS.casual.videos;
        if (videosExceeded) disabledReason = 'You have reached your monthly video limit.';
        break;
      case 'mastermind':
        videosExceeded = user.usage.videosProcessed >= PLAN_LIMITS.mastermind.videos;
        if (videosExceeded) disabledReason = 'You have reached your monthly video limit.';
        break;
    }
  }

  const isButtonDisabled = isLoading || !url.trim() || !user.loggedIn || videosExceeded;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isButtonDisabled) {
      if(videosExceeded) {
        onLimitExceeded();
      }
      return;
    }
    if (url.trim()) {
      onSubmit(url);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    onUrlChange(newUrl);
  };
  
  const getVideosRemaining = () => {
    switch (user.plan) {
      case 'free':
        return Math.max(0, PLAN_LIMITS.free.videos - user.usage.videosProcessed);
      case 'casual':
        return Math.max(0, PLAN_LIMITS.casual.videos - user.usage.videosProcessed);
      case 'mastermind':
        return Math.max(0, PLAN_LIMITS.mastermind.videos - user.usage.videosProcessed);
      default:
        return 0;
    }
  };

  const videosLeft = getVideosRemaining();

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col sm:flex-row items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-full p-2 shadow-lg backdrop-blur-sm">
          <input
            type="url"
            value={url}
            onChange={handleChange}
            placeholder="Paste a YouTube video link here..."
            className="w-full px-5 py-3 text-slate-200 bg-transparent focus:outline-none placeholder-slate-500 flex-grow"
            disabled={isLoading || !user.loggedIn}
            required
          />
          <button
            type="submit"
            disabled={isButtonDisabled}
            className="w-full sm:w-auto px-8 py-3 bg-cyan-500 text-slate-900 font-bold rounded-full hover:bg-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 transition-all duration-300 ease-in-out disabled:bg-slate-600 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {isLoading ? 'Generating...' : 'Generate Clips'}
          </button>
        </div>
      </form>

      {user.loggedIn && !videosExceeded && (
        <p className="text-center text-slate-400 text-sm mt-3">
          You have <span className="font-bold text-cyan-400">{videosLeft}</span> video{videosLeft !== 1 ? 's' : ''} remaining this month
          {user.plan === 'free' && <span> • Max <span className="font-semibold">1 hour</span> per video</span>}
          {user.plan === 'casual' && <span> • Max <span className="font-semibold">3 hours</span> per video</span>}
          {user.plan === 'mastermind' && <span> • Max <span className="font-semibold">8 hours</span> per video</span>}
        </p>
      )}

      {disabledReason && (
         <p
          className="text-center text-amber-400 text-sm mt-3 max-w-2xl mx-auto cursor-pointer hover:underline"
          onClick={onLimitExceeded}
        >
          {disabledReason} Upgrade for more.
        </p>
      )}
    </div>
  );
};

export default URLInputForm;
