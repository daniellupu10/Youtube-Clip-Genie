import React, { useState } from 'react';

interface URLInputFormProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
  onUrlChange: (url: string) => void;
}

const URLInputForm: React.FC<URLInputFormProps> = ({ onSubmit, isLoading, onUrlChange }) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    onUrlChange(newUrl);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-full p-2 shadow-lg backdrop-blur-sm">
        <input
          type="url"
          value={url}
          onChange={handleChange}
          placeholder="Paste a YouTube video link here..."
          className="w-full px-5 py-3 text-slate-200 bg-transparent focus:outline-none placeholder-slate-500 flex-grow"
          disabled={isLoading}
          required
        />
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="w-full sm:w-auto px-8 py-3 bg-cyan-500 text-slate-900 font-bold rounded-full hover:bg-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 transition-all duration-300 ease-in-out disabled:bg-slate-600 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {isLoading ? 'Generating...' : 'Generate Clips'}
        </button>
      </div>
    </form>
  );
};

export default URLInputForm;