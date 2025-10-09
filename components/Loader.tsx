
import React from 'react';

const Loader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 my-16">
      <div className="w-16 h-16 border-4 border-cyan-400 border-dashed rounded-full animate-spin"></div>
      <p className="text-slate-400 text-lg">The Genie is working its magic...</p>
    </div>
  );
};

export default Loader;
