"use client";

import Link from 'next/link';
import Image from 'next/image';
import { Play, Gamepad2, ImageOff } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

interface GameCardProps {
  game: {
    name: string;
    filename: string;
    slug: string;
    image?: string | null;
  };
  isFocused?: boolean;
}

export default function GameCard({ game, isFocused }: GameCardProps) {
  const [imageError, setImageError] = useState(false);
  
  const romFilename = game.filename.split('/').pop()?.replace('.zip', '') || game.slug;
  const imagePath = game.image || null;

  return (
    <div className={`relative aspect-[3/4] rounded-2xl overflow-hidden transition-all duration-300 ${
      isFocused ? 'shadow-[0_0_40px_rgba(16,185,129,0.3)]' : 'shadow-xl'
    }`}>
      {/* Background Image/Placeholder */}
      <div className="absolute inset-0 bg-zinc-900">
        {imagePath && !imageError ? (
          <Image
            src={imagePath}
            alt={game.name}
            fill
            className={`object-cover transition-transform duration-700 ${isFocused ? 'scale-110' : 'scale-100'}`}
            onError={() => setImageError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-black p-6 text-center">
            <Gamepad2 className={`w-16 h-16 mb-4 transition-colors duration-500 ${isFocused ? 'text-emerald-500' : 'text-zinc-800'}`} />
            <h3 className="text-xl font-black italic tracking-tighter uppercase leading-tight line-clamp-3">
              {game.name}
            </h3>
          </div>
        )}
      </div>

      {/* Overlays */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent transition-opacity duration-300 ${
        isFocused ? 'opacity-80' : 'opacity-60'
      }`} />

      {/* Content */}
      <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
        <div className="flex items-center gap-2 mb-1 md:mb-2">
          <span className="px-1.5 md:px-2 py-0.5 bg-emerald-500 text-black text-[8px] md:text-[10px] font-black rounded uppercase tracking-widest">
            MVS
          </span>
          <span className="text-[8px] md:text-[10px] font-mono text-zinc-400 uppercase tracking-tighter">
            {romFilename}
          </span>
        </div>
        <h3 className={`text-xl md:text-2xl font-black italic tracking-tighter uppercase transition-colors duration-300 ${
          isFocused ? 'text-emerald-400' : 'text-white'
        }`}>
          {game.name}
        </h3>
      </div>

      {/* Focus Indicator */}
      {isFocused && (
        <motion.div
          layoutId="focus-border"
          className="absolute inset-0 border-4 border-emerald-500 rounded-2xl pointer-events-none"
          initial={false}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
    </div>
  );
}
