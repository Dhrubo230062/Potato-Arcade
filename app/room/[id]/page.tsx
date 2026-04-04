"use client";
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import socket from '@/src/lib/socket';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Users, Gamepad2, Play } from 'lucide-react';

interface Player { id: string; name: string; isOp: boolean; }
interface Game   { name: string; filename: string; slug: string; image?: string | null; }

export default function RoomPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const router = useRouter();

  const [players,      setPlayers]      = useState<Player[]>([]);
  const [games,        setGames]        = useState<Game[]>([]);
  const [showPicker,   setShowPicker]   = useState(false);
  const [isHost,       setIsHost]       = useState(false);
  const [gameSelected, setGameSelected] = useState<Game | null>(null);
  const [appUrl,       setAppUrl]       = useState('');
  const [status,       setStatus]       = useState<'connected'|'connecting'|'disconnected'>('disconnected');

  const controllerUrl = `${appUrl}/controller/${roomId}`;

  useEffect(() => {
    fetch('/api/games').then(r => r.json()).then(setGames).catch(() => {});
  }, []);

  useEffect(() => {
    setAppUrl(window.location.origin);
  }, []);

  useEffect(() => {
    const updateStatus = () => setStatus(
      socket.connected ? 'connected' : socket.active ? 'connecting' : 'disconnected'
    );

    const onConnect = () => {
      updateStatus();
      socket.emit('get-room-info', roomId, (res: any) => {
        if (res.success) { setPlayers(res.players); if (res.game) setGameSelected(res.game); }
        setIsHost(true);
      });
    };

    setIsHost(true);
    socket.on('connect',       onConnect);
    socket.on('disconnect',    updateStatus);
    socket.on('connect_error', updateStatus);
    if (!socket.connected) socket.connect(); else onConnect();

    socket.on('player-joined', (p: Player[]) => setPlayers(p));
    socket.on('player-left',   (p: Player[]) => setPlayers(p));
    socket.on('game-selected', (g: Game)     => setGameSelected(g));
    socket.on('room-closed',   ()            => router.push('/'));
    socket.on('kicked',        ()            => router.push('/'));

    return () => {
      socket.off('connect',       onConnect);
      socket.off('disconnect',    updateStatus);
      socket.off('connect_error', updateStatus);
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('game-selected');
      socket.off('room-closed');
      socket.off('kicked');
    };
  }, [roomId, router]);

  const handleSelectGame = useCallback((game: Game) => {
    socket.emit('select-game', { roomId, game });
    setGameSelected(game);
    setShowPicker(false);
  }, [roomId]);

  const handleStartGame = useCallback(() => {
    if (!gameSelected) { setShowPicker(true); return; }
    socket.emit('start-game', { roomId });
    router.push(`/play?rom=${gameSelected.filename}&room=${roomId}`);
  }, [gameSelected, roomId, router]);

  const kickPlayer = useCallback((id: string) => {
    socket.emit('kick-player', { roomId, playerId: id });
  }, [roomId]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>

      {/* ── Game Picker Modal ── */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8"
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-[40px] w-full max-w-5xl max-h-[90dvh] flex flex-col overflow-hidden">
              <div className="p-6 md:p-8 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">Select Mission</h2>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">Choose a game to play</p>
                </div>
                <button onClick={() => setShowPicker(false)}
                  className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center transition-colors text-lg">
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 md:p-8">
                {games.length === 0 ? (
                  <div className="text-center py-12 text-zinc-600 font-bold uppercase tracking-widest text-sm">
                    No games found — upload ROMs via /admin
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                    {games.map(game => (
                      <button
                        key={game.filename}
                        type="button"
                        onClick={() => handleSelectGame(game)}
                        className="group flex flex-col text-left focus:outline-none"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <div className="aspect-[3/4] bg-black rounded-2xl mb-2 overflow-hidden relative border-2 transition-all duration-200"
                          style={{ borderColor: gameSelected?.filename === game.filename ? '#10b981' : 'transparent', boxShadow: gameSelected?.filename === game.filename ? '0 0 20px rgba(16,185,129,0.3)' : 'none' }}>
                          {game.image ? (
                            <img src={game.image} alt={game.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 pointer-events-none" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-700 font-black uppercase tracking-widest text-[10px] p-3 text-center">
                              {game.name}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                          {gameSelected?.filename === game.filename && (
                            <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-black text-xs font-black pointer-events-none">✓</div>
                          )}
                        </div>
                        <p className="text-[11px] font-black italic uppercase tracking-tighter truncate group-hover:text-emerald-500 transition-colors w-full">
                          {game.name}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header className="flex items-center justify-between gap-4 px-4 md:px-8 py-4 border-b border-zinc-900 flex-shrink-0">
        <button onClick={() => router.push('/')}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors font-bold uppercase tracking-widest text-[10px] md:text-xs">
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 bg-black/40 border border-zinc-800 rounded-full">
            <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-500' : status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{status}</span>
          </div>
          <div className="w-7 h-7 bg-emerald-500 rounded flex items-center justify-center">
            <Users className="w-4 h-4 text-black" />
          </div>
          <h1 className="text-base md:text-lg font-black italic tracking-tighter uppercase">Multiplayer Lobby</h1>
        </div>
        <div className="w-16 hidden sm:block" />
      </header>

      {/* ── Selected game banner — center prominence ── */}
      <AnimatePresence>
        {gameSelected && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex-shrink-0 relative overflow-hidden">
            {gameSelected.image && (
              <img src={gameSelected.image} alt="" className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-20 pointer-events-none scale-110" />
            )}
            <div className="relative z-10 flex items-center justify-center gap-4 py-3 px-4 border-b border-zinc-800">
              {gameSelected.image && (
                <img src={gameSelected.image} alt={gameSelected.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-0.5">Selected Game</p>
                <p className="text-base md:text-lg font-black italic uppercase tracking-tighter">{gameSelected.name}</p>
              </div>
              {isHost && (
                <button onClick={() => setShowPicker(true)}
                  className="text-[10px] text-zinc-500 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1 rounded-full transition-colors font-bold uppercase tracking-widest">
                  Change
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main grid ── */}
      <main className="flex-1 grid lg:grid-cols-2 gap-4 md:gap-8 max-w-6xl mx-auto w-full p-4 md:p-8">

        {/* Left: QR */}
        <section className="flex flex-col items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded-[32px] p-6 md:p-10 text-center relative overflow-hidden">
          <h2 className="text-xl md:text-2xl font-black italic tracking-tighter uppercase mb-1 relative z-10">Join the Game</h2>
          <p className="text-zinc-500 mb-5 text-[10px] font-bold uppercase tracking-widest relative z-10">Scan with your phone to use as controller</p>

          <div className="p-4 md:p-5 bg-white rounded-[28px] mb-5 relative z-10">
            {appUrl && <QRCodeSVG value={controllerUrl} size={168} level="H" />}
          </div>



          <div className="bg-black/50 px-4 py-2 rounded-2xl border border-zinc-800 relative z-10">
            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mr-2">Room ID:</span>
            <span className="text-xl font-black text-emerald-500 tracking-widest">{roomId}</span>
          </div>
        </section>

        {/* Right: Players + actions */}
        <section className="flex flex-col">
          <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-[32px] p-5 md:p-8 mb-4">
            <div className="flex items-center gap-3 mb-5">
              <Users className="w-5 h-5 text-emerald-500" />
              <h3 className="text-base md:text-lg font-black italic tracking-tighter uppercase">Players ({players.length}/4)</h3>
            </div>

            <div className="space-y-3">
              <AnimatePresence>
                {players.map((player, idx) => (
                  <motion.div key={player.id}
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                    className="flex items-center justify-between p-3 bg-black/40 border border-zinc-800 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${player.isOp ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-black italic uppercase tracking-tighter flex items-center gap-2">
                          {player.name}
                          {player.isOp && <span className="text-[8px] font-black bg-emerald-500 text-black px-1.5 py-0.5 rounded">OP</span>}
                        </p>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">P{idx + 1}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-emerald-500 border border-emerald-500/30 px-2 py-0.5 rounded uppercase tracking-widest">Online</span>
                      {isHost && !player.isOp && (
                        <button onClick={() => kickPlayer(player.id)}
                          className="text-[9px] font-bold text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-400/40 px-2 py-0.5 rounded uppercase tracking-widest transition-colors">
                          Kick
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {Array.from({ length: 4 - players.length }).map((_, i) => (
                <div key={i} className="p-3 border border-dashed border-zinc-800 rounded-2xl flex items-center justify-center">
                  <span className="text-zinc-700 text-[9px] font-black uppercase tracking-widest">Waiting for player...</span>
                </div>
              ))}
            </div>
          </div>

          {isHost && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowPicker(true)}
                className="flex items-center justify-center gap-2 p-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl text-sm font-black italic uppercase tracking-tighter transition-all">
                <Gamepad2 className="w-4 h-4" />
                {gameSelected ? 'Change Game' : 'Select Game'}
              </button>
              <button onClick={handleStartGame}
                disabled={players.length < 1}
                className="flex items-center justify-center gap-2 p-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black rounded-2xl text-sm font-black italic uppercase tracking-tighter transition-all"
                style={{ boxShadow: players.length > 0 ? '0 0 24px rgba(16,185,129,0.25)' : 'none' }}>
                <Play className="w-4 h-4 fill-current" />
                Start Game
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
