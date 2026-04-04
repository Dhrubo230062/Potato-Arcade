"use client";
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import socket from '@/src/lib/socket';

export default function MultiplayerLanding() {
  const router = useRouter();
  const [view, setView] = useState<'menu' | 'join'>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('arcade_player_name');
    if (saved) setName(saved);
  }, []);

  useEffect(() => {
    if (view === 'join') setTimeout(() => inputRef.current?.focus(), 80);
  }, [view]);

  const connectAndDo = (cb: () => void) => {
    if (socket.connected) cb();
    else { socket.connect(); socket.once('connect', cb); }
  };

  const handleCreate = () => {
    setCreating(true); setError('');
    connectAndDo(() => {
      socket.emit('create-room', ({ roomId }: { roomId: string }) => {
        router.push('/room/' + roomId);
      });
    });
  };

  const handleJoin = () => {
    const code = roomCode.trim().toUpperCase();
    const playerName = name.trim() || 'Player';
    if (!code) { setError('Enter a room code'); return; }
    setJoining(true); setError('');
    localStorage.setItem('arcade_player_name', playerName);
    connectAndDo(() => {
      socket.emit('join-room', { roomId: code, name: playerName }, (res: any) => {
        if (res.success) {
          localStorage.setItem(`arcade_joined_${code}`, 'true');
          localStorage.setItem(`arcade_name_${code}`, playerName);
          router.push('/room/' + code);
        } else {
          setError(res.message || 'Could not join room');
          setJoining(false);
        }
      });
    });
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0b1020', color: '#f1f5f9',
      fontFamily: "'Space Grotesk', sans-serif",
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem',
    }}>
      {/* Back */}
      <button onClick={() => view === 'join' ? setView('menu') : router.push('/')}
        className="absolute top-5 left-5 flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-sm font-semibold">
        ← {view === 'join' ? 'Back' : 'Home'}
      </button>

      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
          style={{ background: '#0d59f2', boxShadow: '0 0 20px rgba(13,89,242,0.4)' }}>🕹️</div>
        <span className="text-white font-bold text-xl">Potato <span style={{ color: '#0d59f2' }}>Arcade</span></span>
      </div>

      <AnimatePresence mode="wait">

        {/* ── Menu ── */}
        {view === 'menu' && (
          <motion.div key="menu"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="flex flex-col items-center gap-4 w-full max-w-sm">
            <h1 className="text-3xl font-bold text-center mb-2">
              Multi<span style={{ color: '#0d59f2' }}>player</span>
            </h1>
            <p className="text-slate-500 text-sm text-center mb-4">
              Host a room or join a friend's room with their code.
            </p>

            {/* Create Room */}
            <motion.button
              onClick={handleCreate}
              disabled={creating}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-3"
              style={{ background: '#0d59f2', boxShadow: '0 0 28px rgba(13,89,242,0.35)', opacity: creating ? 0.7 : 1 }}>
              {creating ? (
                <><span className="animate-spin">⟳</span> Creating...</>
              ) : (
                <><span className="text-xl">＋</span> Create Room</>
              )}
            </motion.button>

            {/* Join Room */}
            <motion.button
              onClick={() => setView('join')}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1' }}>
              <span className="text-xl">🔗</span> Join with Code
            </motion.button>
          </motion.div>
        )}

        {/* ── Join ── */}
        {view === 'join' && (
          <motion.div key="join"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="flex flex-col items-center gap-4 w-full max-w-sm">
            <h1 className="text-3xl font-bold text-center mb-1">
              Join <span style={{ color: '#0d59f2' }}>Room</span>
            </h1>
            <p className="text-slate-500 text-sm text-center mb-3">Enter the 6-character room code.</p>

            {/* Room code */}
            <input
              ref={inputRef}
              value={roomCode}
              onChange={e => { setRoomCode(e.target.value.toUpperCase().slice(0, 6)); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="ROOM CODE"
              maxLength={6}
              className="w-full py-4 px-5 rounded-2xl text-center text-2xl font-bold uppercase tracking-[0.25em] outline-none"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#f1f5f9', letterSpacing: '0.3em' }} />

            {/* Name */}
            <input
              value={name}
              onChange={e => setName(e.target.value.slice(0, 16))}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="Your name (optional)"
              className="w-full py-3 px-5 rounded-2xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#f1f5f9' }} />

            {error && (
              <p className="text-red-400 text-sm font-semibold">{error}</p>
            )}

            <motion.button
              onClick={handleJoin}
              disabled={joining || !roomCode.trim()}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-2xl font-bold text-white text-base"
              style={{ background: roomCode.trim() ? '#0d59f2' : 'rgba(255,255,255,0.06)', boxShadow: roomCode.trim() ? '0 0 24px rgba(13,89,242,0.35)' : 'none', opacity: joining ? 0.7 : 1, transition: 'background 0.2s' }}>
              {joining ? 'Joining...' : '→ Join Room'}
            </motion.button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
