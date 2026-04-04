"use client";

import { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface EmulatorPlayerProps {
  rom: string;
}

export default function EmulatorPlayer({ rom }: EmulatorPlayerProps) {
  const [error, setError] = useState<string | null>(null);

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      <iframe
        id="emulator-frame"
        src={`/emulator/index.html?rom=${rom}`}
        className="w-full h-full border-none"
        allowFullScreen
        onLoad={() => console.log('Emulator loaded')}
        onError={() => setError('Failed to load emulator')}
      />
      
      {error && (
        <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center p-6 text-center z-50">
          <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Emulator Error</h2>
          <p className="text-zinc-400 mb-6 max-w-md">{error}</p>
          <button 
            onClick={handleReload}
            className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-zinc-200 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Reload Emulator
          </button>
        </div>
      )}
    </div>
  );
}
