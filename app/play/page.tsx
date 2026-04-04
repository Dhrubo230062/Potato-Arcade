"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import EmulatorPlayer from '@/src/components/EmulatorPlayer';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import socket from '@/src/lib/socket';

// Standard gamepad button indices (Gamepad API 'standard' mapping)
const INPUT_TO_BUTTON: Record<string, number> = {
  'ArrowUp':    12,
  'ArrowDown':  13,
  'ArrowLeft':  14,
  'ArrowRight': 15,
  'KeyZ':  0,  // A (NeoGeo A)
  'KeyX':  1,  // B (NeoGeo B)
  'KeyC':  2,  // X (NeoGeo C)
  'KeyV':  3,  // Y (NeoGeo D)
  'Shift': 8,  // Select
  'Enter': 9,  // Start
};

function PlayContent() {
  const searchParams = useSearchParams();
  const rom    = searchParams.get('rom');
  const roomId = searchParams.get('room');
  const router = useRouter();

  const [gamepadsConnected, setGamepadsConnected] = useState<boolean[]>([false,false,false,false]);
  // Track current player count so we can tell iframe how many pads to init
  const playerCountRef = useRef<number>(1);

  const gameName = rom
    ? rom.split('/').pop()!.replace('.zip','')
        .split(/[-_]/).map((w:string) => w.charAt(0).toUpperCase()+w.slice(1)).join(' ')
    : 'Unknown Game';

  // Send a virtual gamepad button event to the emulator iframe
  const forwardInput = (playerIndex: number, input: string, state: string) => {
    const buttonIndex = INPUT_TO_BUTTON[input];
    if (buttonIndex === undefined) return;
    const iframe = document.getElementById('emulator-frame') as HTMLIFrameElement;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: 'VIRTUAL_GAMEPAD_UPDATE', playerIndex, buttonIndex, state }, '*'
    );
  };

  // Tell the iframe how many players are in the room so it can
  // pre-initialise the right number of virtual gamepad slots
  const sendPlayerCount = (count: number) => {
    const iframe = document.getElementById('emulator-frame') as HTMLIFrameElement;
    if (!iframe?.contentWindow) return;
    // Store on window so EJS_onGameStart can read it after the emulator boots
    iframe.contentWindow.postMessage({ type: 'SET_PLAYER_COUNT', count }, '*');
    // Also set directly on the iframe window object as a fallback
    try { (iframe.contentWindow as any)._expectedPlayerCount = count; } catch {}
  };

  useEffect(() => {
    if (!roomId) return;

    if (!socket.connected) socket.connect();
    const claimHost = () => socket.emit('rejoin-as-host', { roomId });
    if (socket.connected) claimHost();
    else socket.once('connect', claimHost);

    socket.on('player-input', ({ playerIndex, input, state }:
        { playerIndex: number; input: string; state: string }) => {
      forwardInput(playerIndex, input, state);
    });

    socket.on('player-joined', (players: any[]) => {
      const count = players.length;
      playerCountRef.current = count;
      const c: boolean[] = [false,false,false,false];
      players.forEach((_:unknown, i:number) => { if (i<4) c[i]=true; });
      setGamepadsConnected(c);
      // Update iframe with new player count whenever someone joins
      sendPlayerCount(count);
    });

    socket.on('room-closed', () => router.push('/'));

    return () => {
      socket.off('player-input');
      socket.off('player-joined');
      socket.off('room-closed');
    };
  }, [roomId, router]);

  // When iframe loads, send the current player count
  const handleIframeLoad = () => {
    // Small delay to let the iframe script initialise
    setTimeout(() => sendPlayerCount(playerCountRef.current), 300);
  };

  if (!rom) {
    return (
      <div style={{ minHeight:'100vh', background:'#101622', display:'flex',
        flexDirection:'column', alignItems:'center', justifyContent:'center',
        textAlign:'center', color:'#f1f5f9', fontFamily:"'Space Grotesk',sans-serif" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🎮</div>
        <h1 style={{ fontSize:'2.5rem', fontWeight:700, marginBottom:12 }}>No ROM Selected</h1>
        <Link href="/" style={{ background:'#0d59f2', color:'#fff', fontWeight:600,
          padding:'0.75rem 2rem', borderRadius:14, textDecoration:'none' }}>← Back</Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-black overflow-hidden">
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-[10px] md:text-sm font-bold uppercase tracking-widest">
          <ChevronLeft className="w-4 h-4" />Back
        </Link>
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white font-black italic text-[10px] md:text-sm uppercase truncate max-w-[180px] md:max-w-none">
            Playing: {gameName}
          </span>
          {roomId && (
            <div className="hidden sm:flex items-center gap-2 border-l border-zinc-800 pl-3">
              {gamepadsConnected.map((c,i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${c?'bg-emerald-500':'bg-zinc-800'}`} />
                  <span className={`text-[8px] font-black uppercase tracking-widest ${c?'text-emerald-500':'text-zinc-700'}`}>P{i+1}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="w-12 md:w-20" />
      </div>
      <div className="flex-1 relative">
        {/* Pass onLoad so we can send player count to iframe */}
        <div className="relative w-full h-full bg-black">
          <iframe
            id="emulator-frame"
            src={`/emulator/index.html?rom=${rom}`}
            className="w-full h-full border-none"
            allowFullScreen
            onLoad={handleIframeLoad}
          />
        </div>
      </div>
    </div>
  );
}

export default function Play() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center text-white font-bold uppercase tracking-widest">Loading...</div>
    }>
      <PlayContent />
    </Suspense>
  );
}
