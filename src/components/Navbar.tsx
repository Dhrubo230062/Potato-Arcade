"use client";

import Link from 'next/link';
import { Gamepad2 } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="border-b border-zinc-800 bg-black/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <Gamepad2 className="w-8 h-8 text-emerald-500 group-hover:rotate-12 transition-transform" />
            <span className="text-xl font-black tracking-tighter italic text-white group-hover:text-emerald-400 transition-colors">
              NEOGEO ARCADE
            </span>
          </Link>
          <div className="hidden md:block">
            <div className="flex items-baseline space-x-4">
              <Link href="/" className="text-zinc-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">
                Games
              </Link>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
