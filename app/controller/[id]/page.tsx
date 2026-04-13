"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import socket from '@/src/lib/socket';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, RotateCcw, Power } from 'lucide-react';

export default function ControllerPage() {
  const { id: roomId } = useParams();
  const [connected,    setConnected]    = useState(false);
  const [orientation,  setOrientation]  = useState<'portrait'|'landscape'>('portrait');
  const [playerName,   setPlayerName]   = useState('');
  const [isJoined,     setIsJoined]     = useState(false);
  const [isOp,         setIsOp]         = useState(false);
  const [players,      setPlayers]      = useState<any[]>([]);
  const [games,        setGames]        = useState<any[]>([]);
  const [showAdmin,    setShowAdmin]     = useState(false);
  const [adminTab,     setAdminTab]      = useState<'games'|'players'>('games');
  const [sockStatus,   setSockStatus]   = useState<'connected'|'disconnected'|'connecting'>('disconnected');

  // sendInput — fires socket.emit immediately, no buffering, no dropping
  const sendInput = useCallback((input: string, state: 'down'|'up') => {
    if (!connected) return;
    if (state === 'down' && window.navigator.vibrate) window.navigator.vibrate(8);
    socket.emit('controller-input', { roomId, input, state });
  }, [connected, roomId]);

  useEffect(() => {
    fetch('/api/games').then(r => r.json()).then(setGames).catch(() => {});
  }, []);

  // Socket connection + room events
  useEffect(() => {
    const upd = () => setSockStatus(
      socket.connected ? 'connected' : socket.active ? 'connecting' : 'disconnected'
    );
    socket.on('connect',       upd);
    socket.on('disconnect',    upd);
    socket.on('connect_error', upd);

    socket.on('player-joined', (ps) => {
      setPlayers(ps);
      const me = ps.find((p:any) => p.id === socket.id);
      if (me) setIsOp(me.isOp);
    });
    socket.on('player-left', (ps) => {
      setPlayers(ps);
      const me = ps.find((p:any) => p.id === socket.id);
      if (me) setIsOp(me.isOp);
    });
    socket.on('game-started', (game: any) => {
      // Navigate to play page as a controller (phone becomes the controller)
      if (game?.filename) {
        window.location.href = `/play?rom=${encodeURIComponent(game.filename)}&room=${roomId}`;
      }
    });

    socket.on('kicked', () => {
      alert('You have been kicked from the room');
      localStorage.removeItem(`arcade_joined_${roomId}`);
      window.location.href = '/';
    });

    if (!socket.connected) socket.connect();
    else upd();

    return () => {
      socket.off('connect',       upd);
      socket.off('disconnect',    upd);
      socket.off('connect_error', upd);
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('kicked');
      socket.off('game-started');
    };
  }, [roomId]);

  // Auto-rejoin on page reload
  useEffect(() => {
    const saved = localStorage.getItem(`arcade_name_${roomId}`);
    if (saved) setPlayerName(saved);
    if (localStorage.getItem(`arcade_joined_${roomId}`) !== 'true') return;
    const tryRejoin = () => handleJoin(saved || '');
    if (socket.connected) tryRejoin();
    else socket.once('connect', tryRejoin);
    return () => { socket.off('connect', tryRejoin); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Orientation
  useEffect(() => {
    const h = () => setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    window.addEventListener('resize', h);
    h();
    return () => window.removeEventListener('resize', h);
  }, []);

  const handleJoin = (nameToUse?: string) => {
    const name = nameToUse !== undefined ? nameToUse : playerName;
    if (!socket.connected) socket.connect();
    socket.emit('join-room', { roomId, name }, (res: any) => {
      if (res.success) {
        setIsJoined(true);
        setConnected(true);
        setIsOp(res.isOp);
        setPlayers(res.players);
        localStorage.setItem(`arcade_name_${roomId}`, name);
        localStorage.setItem(`arcade_joined_${roomId}`, 'true');
      } else {
        alert(res.message);
        localStorage.removeItem(`arcade_joined_${roomId}`);
      }
    });
  };

  const handleSelectGame  = (g: any) => { socket.emit('select-game', { roomId, game: g }); setShowAdmin(false); };
  const handleStartGame   = ()       => socket.emit('start-game', { roomId });
  const handleKick        = (id: string) => socket.emit('kick-player',  { roomId, playerId: id });
  const handleTransferOp  = (id: string) => socket.emit('transfer-op',  { roomId, playerId: id });

  // ── Join screen ──────────────────────────────────────────────────────────
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-white">
        <Gamepad2 className="w-16 h-16 text-emerald-500 mb-6" />
        <h1 className="text-3xl font-black italic tracking-tighter uppercase mb-2">Join Room</h1>
        <p className="text-zinc-500 mb-8 text-sm font-bold uppercase tracking-widest">{roomId}</p>
        <input
          placeholder="ENTER YOUR NAME"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          className="w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 text-center font-black italic uppercase tracking-tighter focus:border-emerald-500 outline-none transition-all"
        />
        <button onClick={() => handleJoin()}
          className="w-full max-w-xs bg-emerald-500 hover:bg-emerald-400 text-black font-black italic uppercase tracking-tighter p-4 rounded-2xl transition-all">
          CONNECT CONTROLLER
        </button>
      </div>
    );
  }

  // ── Button component ─────────────────────────────────────────────────────
  const Btn = ({ label, input, color='bg-zinc-800', size='w-16 h-16', cls='' }: any) => (
    <motion.button
      whileTap={{ scale: 0.88, backgroundColor: '#10b981' }}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); sendInput(input, 'down'); }}
      onPointerUp={e    => { e.currentTarget.releasePointerCapture(e.pointerId); sendInput(input, 'up'); }}
      onPointerLeave={e => { e.currentTarget.releasePointerCapture(e.pointerId); sendInput(input, 'up'); }}
      onPointerCancel={e=> { e.currentTarget.releasePointerCapture(e.pointerId); sendInput(input, 'up'); }}
      className={`${cls} ${size} ${color} rounded-full flex items-center justify-center font-black italic text-xl shadow-xl select-none touch-none`}
    >{label}</motion.button>
  );

  // ── Joystick component ───────────────────────────────────────────────────
  const Joystick = () => {
    const baseRef  = useRef<HTMLDivElement>(null);
    const stickRef = useRef<HTMLDivElement>(null);
    const active   = useRef<Set<string>>(new Set());
    const BASE_R = 72, STICK_R = 32, DEAD = 14, MAX = BASE_R - STICK_R - 4;

    const dirs = (x: number, y: number) => {
      const d = Math.hypot(x, y); if (d < DEAD) return [];
      const r: string[] = [];
      const ax = Math.abs(x), ay = Math.abs(y);
      if (ax > DEAD) r.push(x > 0 ? 'ArrowRight' : 'ArrowLeft');
      if (ay > DEAD) r.push(y > 0 ? 'ArrowDown'  : 'ArrowUp');
      if (r.length === 2 && Math.min(ax,ay)/Math.max(ax,ay) < 0.38) r.splice(ax>ay?1:0,1);
      return r;
    };

    const move = (e: React.PointerEvent) => {
      const b = baseRef.current; if (!b) return;
      const r = b.getBoundingClientRect();
      const x = e.clientX-(r.left+r.width/2), y = e.clientY-(r.top+r.height/2);
      const d = Math.hypot(x,y), c = d>MAX ? MAX/d : 1;
      if (stickRef.current)
        stickRef.current.style.transform = `translate(calc(-50% + ${x*c}px), calc(-50% + ${y*c}px))`;
      const nd = new Set(dirs(x,y));
      const ALL = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
      ALL.forEach(k => { if (active.current.has(k) && !nd.has(k)) { sendInput(k,'up'); active.current.delete(k); }});
      nd.forEach(k  => { if (!active.current.has(k)) { sendInput(k,'down'); active.current.add(k); }});
    };
    const release = () => {
      active.current.forEach(k => sendInput(k,'up'));
      active.current.clear();
      if (stickRef.current) stickRef.current.style.transform = 'translate(-50%,-50%)';
    };

    return (
      <div ref={baseRef}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
        onPointerMove={e => { if (e.buttons > 0) move(e); }}
        onPointerUp={release} onPointerCancel={release} onPointerLeave={release}
        style={{ position:'relative', width:BASE_R*2, height:BASE_R*2, flexShrink:0,
          borderRadius:'50%', touchAction:'none', userSelect:'none',
          background:'radial-gradient(circle,rgba(255,255,255,0.07) 0%,rgba(255,255,255,0.03) 70%)',
          border:'2px solid rgba(255,255,255,0.12)', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
        <div ref={stickRef}
          style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            width:STICK_R*2, height:STICK_R*2, borderRadius:'50%', pointerEvents:'none',
            background:'radial-gradient(circle at 35% 35%,#ff4444,#990000)',
            boxShadow:'0 4px 16px rgba(0,0,0,0.5),inset 0 2px 4px rgba(255,255,255,0.2)',
            transition:'transform 0.05s ease-out' }} />
      </div>
    );
  };

  // ── Controller UI ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-zinc-950 text-white select-none touch-none overflow-hidden">

      {/* Host panel */}
      <AnimatePresence>
        {showAdmin && (
          <motion.div initial={{opacity:0,y:'100%'}} animate={{opacity:1,y:0}} exit={{opacity:0,y:'100%'}}
            className="fixed inset-0 z-50 bg-zinc-950 flex flex-col p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter">Host Panel</h2>
              <button onClick={()=>setShowAdmin(false)} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center font-black">✕</button>
            </div>
            <div className="flex gap-2 mb-6">
              {(['games','players'] as const).map(t => (
                <button key={t} onClick={()=>setAdminTab(t)}
                  className={`flex-1 py-3 rounded-xl font-black italic uppercase tracking-tighter text-sm ${adminTab===t?'bg-emerald-500 text-black':'bg-zinc-900 text-zinc-500'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {adminTab === 'games' ? (
                <div className="grid grid-cols-2 gap-4">
                  {games.map(g => (
                    <button key={g.slug} onClick={()=>handleSelectGame(g)}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-left active:border-emerald-500">
                      <div className="aspect-video bg-black rounded-lg mb-2 overflow-hidden">
                        {g.image
                          ? <img src={g.image} alt={g.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-700 font-black uppercase">No Cover</div>}
                      </div>
                      <p className="text-[10px] font-black italic uppercase tracking-tighter truncate">{g.name}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {players.map(p => (
                    <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${p.isOp?'bg-emerald-500 text-black':'bg-zinc-800 text-zinc-400'}`}>
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black italic uppercase tracking-tighter text-sm">{p.name} {p.id===socket.id&&'(You)'}</p>
                          <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">{p.isOp?'Host':'Player'}</p>
                        </div>
                      </div>
                      {p.id !== socket.id && (
                        <div className="flex gap-2">
                          <button onClick={()=>handleTransferOp(p.id)} className="bg-zinc-800 text-[8px] font-black uppercase tracking-widest px-3 py-2 rounded-lg">Make Host</button>
                          <button onClick={()=>handleKick(p.id)} className="bg-red-500/20 text-red-500 text-[8px] font-black uppercase tracking-widest px-3 py-2 rounded-lg">Kick</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleStartGame}
              className="mt-6 w-full bg-emerald-500 text-black font-black italic uppercase tracking-tighter p-4 rounded-2xl active:bg-emerald-400">
              ▶ START GAME
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Portrait — rotate prompt */}
      {orientation === 'portrait' ? (
        <div className="h-full flex flex-col">
          <div className="p-4 flex items-center justify-between border-b border-zinc-900">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${sockStatus==='connected'?'bg-emerald-500':sockStatus==='connecting'?'bg-yellow-500 animate-pulse':'bg-red-500'}`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${sockStatus==='connected'?'text-emerald-500':'text-zinc-500'}`}>{sockStatus}</span>
            </div>
            <div className="flex items-center gap-3">
              {isOp && <button onClick={()=>setShowAdmin(true)} className="bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">HOST</button>}
              <span className="text-xs font-black italic uppercase tracking-tighter">{playerName}</span>
              <button onClick={()=>window.location.reload()} className="text-zinc-500"><Power className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <RotateCcw className="w-12 h-12 text-emerald-500 mb-4" />
            <h2 className="text-xl font-black italic uppercase tracking-tighter mb-2">Rotate your phone</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Landscape mode for controller</p>
          </div>
        </div>
      ) : (
        /* Landscape — controller */
        <div className="h-full flex items-center justify-between px-10 py-4 relative">

          <Joystick />

          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-3">
              <div className="flex flex-col items-center gap-1">
                <Btn label="SEL" input="Shift" size="w-14 h-8" color="bg-zinc-900" />
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Select</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Btn label="START" input="Enter" size="w-14 h-8" color="bg-zinc-900" />
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Start</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOp && (
                <button onClick={()=>setShowAdmin(true)}
                  className="bg-emerald-500 text-black text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                  HOST
                </button>
              )}
              <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-full border border-zinc-800">
                <div className={`w-1.5 h-1.5 rounded-full ${sockStatus==='connected'?'bg-emerald-500':'bg-red-500'}`} />
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">{playerName}</span>
              </div>
            </div>
          </div>

          <div className="relative w-52 h-52 flex items-center justify-center">
            <div className="absolute inset-0 bg-zinc-900/50 rounded-full border border-zinc-800/50" />
            <div className="relative z-10 grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-4 translate-y-4">
                <Btn label="C" input="KeyC" color="bg-yellow-500/80" size="w-16 h-16" />
                <Btn label="A" input="KeyZ" color="bg-red-500/80"    size="w-16 h-16" />
              </div>
              <div className="flex flex-col gap-4 -translate-y-4">
                <Btn label="D" input="KeyV" color="bg-emerald-500/80" size="w-16 h-16" />
                <Btn label="B" input="KeyX" color="bg-blue-500/80"    size="w-16 h-16" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
