"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import socket from '@/src/lib/socket';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, RotateCcw, Power } from 'lucide-react';

export default function ControllerPage() {
  const { id: roomId } = useParams();
  const [connected, setConnected] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [playerName, setPlayerName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [isOp, setIsOp] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [adminTab, setAdminTab] = useState<'games' | 'players'>('games');
  const [socketStatus, setSocketStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');

  const pcRef  = useRef<RTCPeerConnection | null>(null);
  const chRef  = useRef<RTCDataChannel | null>(null);
  const playerIdxRef = useRef<number>(0);
  const [rtcReady, setRtcReady] = useState(false);

  const sendInput = useCallback((input: string, state: 'down' | 'up') => {
    if (!connected) return;
    if (state === 'down' && window.navigator.vibrate) window.navigator.vibrate(8);
    const ch = chRef.current;
    if (ch && ch.readyState === 'open') {
      // LAN path — goes through router directly, ~2-5ms
      ch.send(JSON.stringify({ input, state, playerIndex: playerIdxRef.current }));
    } else {
      // Internet path — relay through Railway server, fallback
      socket.emit('controller-input', { roomId, input, state });
    }
  }, [connected, roomId]);

  useEffect(() => {
    fetch('/api/games').then(r => r.json()).then(setGames).catch(console.error);
  }, []);

  useEffect(() => {
    const updateStatus = () => {
      setSocketStatus(socket.connected ? 'connected' : socket.active ? 'connecting' : 'disconnected');
    };
    socket.on('connect', updateStatus);
    socket.on('disconnect', updateStatus);
    socket.on('connect_error', updateStatus);
    socket.on('player-joined', (updatedPlayers) => {
      setPlayers(updatedPlayers);
      const me = updatedPlayers.find((p: any) => p.id === socket.id);
      if (me) setIsOp(me.isOp);
    });

    // ── WebRTC setup ─────────────────────────────────────────────────
    const setupWebRTC = (playerIdx: number) => {
      if (pcRef.current) { pcRef.current.close(); }
      playerIdxRef.current = playerIdx;
      const STUN = { iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]};
      const pc = new RTCPeerConnection(STUN);
      pcRef.current = pc;

      const ch = pc.createDataChannel('input', { ordered: false, maxRetransmits: 0 });
      chRef.current = ch;
      ch.onopen  = () => { setRtcReady(true);  console.log('[WebRTC] DataChannel open — LAN active'); };
      ch.onclose = () => { setRtcReady(false); console.log('[WebRTC] DataChannel closed'); };

      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('webrtc-ice', { roomId, candidate: e.candidate, to: 'host' });
      };

      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', { roomId, offer, from: socket.id });
      }).catch(() => {});
    };

    socket.on('webrtc-answer', ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      pcRef.current?.setRemoteDescription(answer).catch(() => {});
    });
    socket.on('webrtc-ice', ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      pcRef.current?.addIceCandidate(candidate).catch(() => {});
    });
    // Start WebRTC when game starts — host is on play page and ready
    socket.on('game-started', ({ playerIdx }: { playerIdx?: number }) => {
      setTimeout(() => setupWebRTC(playerIdx ?? playerIdxRef.current), 500);
    });

    socket.on('player-left', (updatedPlayers) => {
      setPlayers(updatedPlayers);
      const me = updatedPlayers.find((p: any) => p.id === socket.id);
      if (me) setIsOp(me.isOp);
    });

    socket.on('kicked', () => {
      alert('You have been kicked from the room');
      localStorage.removeItem(`arcade_joined_${roomId}`);
      window.location.href = '/';
    });
    if (!socket.connected) socket.connect();
    else updateStatus();
    return () => {
      socket.off('connect', updateStatus);
      socket.off('disconnect', updateStatus);
      socket.off('connect_error', updateStatus);
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('kicked');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice');
      socket.off('game-started');
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      chRef.current = null;

    };
  }, [roomId]);

  useEffect(() => {
    const handle = () => setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    window.addEventListener('resize', handle);
    handle();
    return () => window.removeEventListener('resize', handle);
  }, []);

  useEffect(() => {
    const savedName = localStorage.getItem(`arcade_name_${roomId}`);
    if (savedName) setPlayerName(savedName);
    if (localStorage.getItem(`arcade_joined_${roomId}`) !== 'true') return;
    const tryRejoin = () => handleJoin(savedName || '');
    if (socket.connected) tryRejoin();
    else socket.once('connect', tryRejoin);
    return () => { socket.off('connect', tryRejoin); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const handleJoin = (nameToUse?: string) => {
    const finalName = nameToUse !== undefined ? nameToUse : playerName;
    if (!socket.connected) socket.connect();
    socket.emit('join-room', { roomId, name: finalName }, (response: any) => {
      if (response.success) {
        setIsJoined(true);
        setConnected(true);
        setIsOp(response.isOp);
        setPlayers(response.players);
        // Save our player index for WebRTC DataChannel messages
        const myIdx = response.players.findIndex((p: any) => p.id === socket.id);
        playerIdxRef.current = myIdx >= 0 ? myIdx : 0;
        localStorage.setItem(`arcade_name_${roomId}`, finalName);
        localStorage.setItem(`arcade_joined_${roomId}`, 'true');
      } else {
        alert(response.message);
        localStorage.removeItem(`arcade_joined_${roomId}`);
      }
    });
  };

  const handleSelectGame = (game: any) => {
    socket.emit('select-game', { roomId, game });
    setShowAdminMenu(false);
  };
  const handleStartGame = () => socket.emit('start-game', { roomId });
  const handleKick = (id: string) => socket.emit('kick-player', { roomId, playerId: id });
  const handleTransferOp = (id: string) => socket.emit('transfer-op', { roomId, playerId: id });

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-white">
        <Gamepad2 className="w-16 h-16 text-emerald-500 mb-6" />
        <h1 className="text-3xl font-black italic tracking-tighter uppercase mb-2">Join Room</h1>
        <p className="text-zinc-500 mb-8 text-sm font-bold uppercase tracking-widest">{roomId}</p>
        <input
          type="text"
          placeholder="ENTER YOUR NAME"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          className="w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 text-center font-black italic uppercase tracking-tighter focus:border-emerald-500 outline-none transition-all"
        />
        <button
          onClick={() => handleJoin()}
          className="w-full max-w-xs bg-emerald-500 hover:bg-emerald-400 text-black font-black italic uppercase tracking-tighter p-4 rounded-2xl transition-all"
        >
          CONNECT CONTROLLER
        </button>
      </div>
    );
  }

  const Btn = ({ label, input, color = 'bg-zinc-800', size = 'w-16 h-16', cls = '' }: any) => (
    <motion.button
      whileTap={{ scale: 0.88, backgroundColor: '#10b981' }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); sendInput(input, 'down'); }}
      onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); sendInput(input, 'up'); }}
      onPointerLeave={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); sendInput(input, 'up'); }}
      onPointerCancel={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); sendInput(input, 'up'); }}
      className={`${cls} ${size} ${color} rounded-full flex items-center justify-center font-black italic text-xl shadow-xl select-none touch-none`}
    >
      {label}
    </motion.button>
  );

  // ── Joystick — EmulatorJS style circular drag joystick ─────────────────
  const Joystick = () => {
    const baseRef  = useRef<HTMLDivElement>(null);
    const stickRef = useRef<HTMLDivElement>(null);
    const activeRef = useRef<Set<string>>(new Set());
    const BASE_R  = 72;   // outer circle radius px
    const STICK_R = 32;   // inner knob radius px
    const DEAD    = 14;   // dead zone px
    const MAX_TRAVEL = BASE_R - STICK_R - 4;

    const getDirections = (x: number, y: number) => {
      const dist = Math.sqrt(x*x + y*y);
      if (dist < DEAD) return [];
      const dirs: string[] = [];
      const ax = Math.abs(x), ay = Math.abs(y);
      if (ax > DEAD) dirs.push(x > 0 ? 'ArrowRight' : 'ArrowLeft');
      if (ay > DEAD) dirs.push(y > 0 ? 'ArrowDown'  : 'ArrowUp');
      // suppress diagonal if strongly one-directional
      if (dirs.length === 2 && Math.min(ax,ay)/Math.max(ax,ay) < 0.38)
        dirs.splice(ax > ay ? 1 : 0, 1);
      return dirs;
    };

    const updateStick = (x: number, y: number) => {
      const stick = stickRef.current; if (!stick) return;
      const dist  = Math.sqrt(x*x + y*y);
      const clamped = dist > MAX_TRAVEL ? MAX_TRAVEL / dist : 1;
      stick.style.transform = `translate(calc(-50% + ${x*clamped}px), calc(-50% + ${y*clamped}px))`;
    };

    const onMove = (e: React.PointerEvent) => {
      const base = baseRef.current; if (!base) return;
      const rect = base.getBoundingClientRect();
      const x = e.clientX - (rect.left + rect.width  / 2);
      const y = e.clientY - (rect.top  + rect.height / 2);
      updateStick(x, y);

      const newDirs = new Set(getDirections(x, y));
      const DIRS = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
      DIRS.forEach(d => {
        if (activeRef.current.has(d) && !newDirs.has(d)) { sendInput(d, 'up'); activeRef.current.delete(d); }
      });
      newDirs.forEach(d => {
        if (!activeRef.current.has(d)) { sendInput(d, 'down'); activeRef.current.add(d); }
      });
    };

    const onRelease = () => {
      activeRef.current.forEach(d => sendInput(d, 'up'));
      activeRef.current.clear();
      const stick = stickRef.current;
      if (stick) stick.style.transform = 'translate(-50%, -50%)';
    };

    const SIZE = BASE_R * 2;
    return (
      <div
        ref={baseRef}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onMove(e); }}
        onPointerMove={(e) => { if (e.buttons > 0) onMove(e); }}
        onPointerUp={onRelease}
        onPointerCancel={onRelease}
        onPointerLeave={onRelease}
        style={{
          position: 'relative', width: SIZE, height: SIZE, flexShrink: 0,
          borderRadius: '50%', touchAction: 'none', userSelect: 'none',
          background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 70%)',
          border: '2px solid rgba(255,255,255,0.12)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Inner knob */}
        <div
          ref={stickRef}
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: STICK_R * 2, height: STICK_R * 2, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #ff4444, #990000)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.2)',
            transition: 'transform 0.05s ease-out',
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 text-white select-none touch-none overflow-hidden">

      {/* Admin / Host Panel */}
      <AnimatePresence>
        {showAdminMenu && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="fixed inset-0 z-50 bg-zinc-950 flex flex-col p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter">Host Panel</h2>
              <button onClick={() => setShowAdminMenu(false)} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center font-black">✕</button>
            </div>
            <div className="flex gap-2 mb-6">
              {(['games', 'players'] as const).map(tab => (
                <button key={tab} onClick={() => setAdminTab(tab)}
                  className={`flex-1 py-3 rounded-xl font-black italic uppercase tracking-tighter text-sm ${adminTab === tab ? 'bg-emerald-500 text-black' : 'bg-zinc-900 text-zinc-500'}`}>
                  {tab}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {adminTab === 'games' ? (
                <div className="grid grid-cols-2 gap-4">
                  {games.map((game) => (
                    <button key={game.slug} onClick={() => handleSelectGame(game)}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-left active:border-emerald-500 transition-colors">
                      <div className="aspect-video bg-black rounded-lg mb-2 overflow-hidden">
                        {game.image
                          ? <img src={game.image} alt={game.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-700 font-black uppercase">No Cover</div>}
                      </div>
                      <p className="text-[10px] font-black italic uppercase tracking-tighter truncate">{game.name}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {players.map((p) => (
                    <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${p.isOp ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black italic uppercase tracking-tighter text-sm">{p.name} {p.id === socket.id && '(You)'}</p>
                          <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">{p.isOp ? 'Host' : 'Player'}</p>
                        </div>
                      </div>
                      {p.id !== socket.id && (
                        <div className="flex gap-2">
                          <button onClick={() => handleTransferOp(p.id)} className="bg-zinc-800 text-[8px] font-black uppercase tracking-widest px-3 py-2 rounded-lg">Make Host</button>
                          <button onClick={() => handleKick(p.id)} className="bg-red-500/20 text-red-500 text-[8px] font-black uppercase tracking-widest px-3 py-2 rounded-lg">Kick</button>
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

      {orientation === 'portrait' ? (
        <div className="h-full flex flex-col">
          <div className="p-4 flex items-center justify-between border-b border-zinc-900">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${rtcReady ? 'bg-blue-400 animate-pulse' : socketStatus === 'connected' ? 'bg-emerald-500' : socketStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${rtcReady ? 'text-blue-400' : socketStatus === 'connected' ? 'text-emerald-500' : 'text-zinc-500'}`}>
                {rtcReady ? 'LAN ⚡' : socketStatus}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {isOp && (
                <button onClick={() => setShowAdminMenu(true)} className="bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                  HOST PANEL
                </button>
              )}
              <span className="text-xs font-black italic uppercase tracking-tighter">{playerName}</span>
              <button onClick={() => window.location.reload()} className="text-zinc-500"><Power className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <RotateCcw className="w-12 h-12 text-emerald-500 mb-4" />
            <h2 className="text-xl font-black italic uppercase tracking-tighter mb-2">Rotate your phone</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Landscape mode needed for controller</p>
          </div>
        </div>
      ) : (
        <div className="h-full flex items-center justify-between px-10 py-4 relative">

          {/* Joystick */}
          <Joystick />

          {/* Center */}
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
                <button onClick={() => setShowAdminMenu(true)}
                  className="bg-emerald-500 text-black text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                  HOST
                </button>
              )}
              <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-full border border-zinc-800">
                <div className={`w-1.5 h-1.5 rounded-full ${socketStatus === 'connected' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">{playerName}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="relative w-52 h-52 flex items-center justify-center">
            <div className="absolute inset-0 bg-zinc-900/50 rounded-full border border-zinc-800/50" />
            <div className="relative z-10 grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-4 translate-y-4">
                <Btn label="C" input="KeyC" color="bg-yellow-500/80" size="w-16 h-16" />
                <Btn label="A" input="KeyZ" color="bg-red-500/80" size="w-16 h-16" />
              </div>
              <div className="flex flex-col gap-4 -translate-y-4">
                <Btn label="D" input="KeyV" color="bg-emerald-500/80" size="w-16 h-16" />
                <Btn label="B" input="KeyX" color="bg-blue-500/80" size="w-16 h-16" />
              </div>
            </div>
          </div>

          <div className="absolute top-0 left-0 w-28 h-10 bg-zinc-900/20 rounded-br-3xl border-b border-r border-zinc-800/30 flex items-center justify-center">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-700">L</span>
          </div>
          <div className="absolute top-0 right-0 w-28 h-10 bg-zinc-900/20 rounded-bl-3xl border-b border-l border-zinc-800/30 flex items-center justify-center">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-700">R</span>
          </div>
        </div>
      )}
    </div>
  );
}
