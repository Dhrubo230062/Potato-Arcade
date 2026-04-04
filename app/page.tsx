"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import socket from '@/src/lib/socket';

interface Game { name: string; filename: string; slug: string; image?: string | null; }

const TAGS: Record<string, string> = {
  mslug:'ACTION', mslug2:'ACTION', mslug3:'ACTION', mslugx:'ACTION', mslug4:'ACTION', mslug5:'ACTION',
  kof94:'FIGHTER', kof95:'FIGHTER', kof96:'FIGHTER', kof97:'FIGHTER', kof98:'FIGHTER', kof99:'FIGHTER',
  garou:'FIGHTER', samsho:'FIGHTER', samsho2:'FIGHTER', aof:'FIGHTER', aof2:'FIGHTER', fatfury1:'FIGHTER',
  neobombe:'PUZZLE', puzzledp:'PUZZLE', magdrop2:'PUZZLE', magdrop3:'PUZZLE',
  mario:'PLATFORM', dkong:'PLATFORM',
  turfmast:'SPORTS', wjammers:'SPORTS', stakwin:'SPORTS',
  blazstar:'SHOOTER', pulstar:'SHOOTER', viewpoin:'SHOOTER',
};
const tag = (s: string) => TAGS[s] ?? 'ARCADE';

const CARD_W   = 300;
const CARD_H   = 420;
const CARD_GAP = 20;

// ── Boot Screen ─────────────────────────────────────────────────────────────
function BootScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#0b1020', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif" }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-6">
        <motion.div animate={{ boxShadow: ['0 0 20px #0d59f2','0 0 50px #0d59f2','0 0 20px #0d59f2'] }} transition={{ duration: 2, repeat: Infinity }}
          style={{ width: 64, height: 64, borderRadius: 18, background: '#0d59f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🕹️</motion.div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 }}>Potato <span style={{ color: '#0d59f2' }}>Arcade</span></h1>
          <p style={{ color: '#475569', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 6 }}>Loading...</p>
        </div>
        <div style={{ width: 160, height: 2, background: '#1e293b', borderRadius: 99, overflow: 'hidden' }}>
          <motion.div initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            style={{ height: '100%', width: '33%', background: 'linear-gradient(90deg,transparent,#0d59f2,transparent)' }} />
        </div>
      </motion.div>
    </div>
  );
}

// ── Carousel ─────────────────────────────────────────────────────────────────
function Carousel({ games, selectedIndex, onSelect, onPlay, onRoom }: {
  games: Game[]; selectedIndex: number;
  onSelect: (i: number) => void; onPlay: () => void; onRoom: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const n = games.length;
  // Triple array: [copy, real, copy] — middle copy is what user sees
  const tripled = useMemo(() => [...games, ...games, ...games], [games]);
  const isJumping = useRef(false);

  const scrollToIdx = useCallback((tripledIdx: number, smooth: boolean) => {
    const track = trackRef.current; if (!track) return;
    const card = track.children[tripledIdx] as HTMLElement; if (!card) return;
    const trackW = track.offsetWidth;
    const target = card.offsetLeft - trackW / 2 + CARD_W / 2;
    if (smooth) {
      track.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    } else {
      track.scrollLeft = Math.max(0, target);
    }
  }, []);

  // Jump to middle copy silently
  const jumpToMiddle = useCallback((realIdx: number) => {
    isJumping.current = true;
    scrollToIdx(n + realIdx, false);
    requestAnimationFrame(() => { isJumping.current = false; });
  }, [n, scrollToIdx]);

  // Initial mount — go to middle copy instantly
  useEffect(() => {
    if (!n) return;
    jumpToMiddle(selectedIndex);
  }, [n]); // only on games load

  // When selectedIndex changes from keyboard — smooth scroll in middle copy
  useEffect(() => {
    if (!n || isJumping.current) return;
    scrollToIdx(n + selectedIndex, true);
  }, [selectedIndex, n, scrollToIdx]);

  // On scroll end — detect which card is centered, select it, loop if needed
  const onScrollEnd = useCallback(() => {
    const track = trackRef.current; if (!track || isJumping.current) return;
    const trackW = track.offsetWidth;
    const center = track.scrollLeft + trackW / 2;
    // Find closest card
    let best = 0, bestDist = Infinity;
    Array.from(track.children).forEach((el, i) => {
      const dist = Math.abs((el as HTMLElement).offsetLeft + CARD_W / 2 - center);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    const realIdx = ((best % n) + n) % n;
    // If we scrolled into copy 0 or copy 2, silently jump to middle copy
    if (best < n || best >= 2 * n) {
      jumpToMiddle(realIdx);
    }
    if (realIdx !== selectedIndex) onSelect(realIdx);
  }, [n, selectedIndex, onSelect, jumpToMiddle]);

  const scrollTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleScroll = () => {
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(onScrollEnd, 80);
  };

  const sel = games[selectedIndex];

  if (!n) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#475569' }}>
      <span style={{ fontSize: 48 }}>🎮</span>
      <p style={{ fontSize: 14, fontWeight: 600 }}>No ROMs yet — <a href="/admin" style={{ color: '#0d59f2' }}>upload via /admin</a></p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Game info */}
      <div style={{ padding: '24px 24px 20px', flexShrink: 0 }}>
        <AnimatePresence mode="wait">
          {sel && (
            <motion.div key={sel.slug} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', background: 'rgba(13,89,242,0.18)', color: '#5a90ff', border: '1px solid rgba(13,89,242,0.3)', padding: '2px 10px', borderRadius: 6 }}>
                  {tag(sel.slug)}
                </span>
                <span style={{ fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.15em' }}>NEO GEO MVS</span>
              </div>
              <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-2px', lineHeight: 1.05, color: '#f1f5f9', margin: '0 0 16px' }}>
                {sel.name.split(' ').slice(0, -1).join(' ')}{' '}
                {sel.name.split(' ').length > 1 && <span style={{ color: '#0d59f2' }}>{sel.name.split(' ').slice(-1)[0]}</span>}
              </h1>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onPlay}
                  style={{ padding: '10px 28px', borderRadius: 12, background: '#0d59f2', border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 0 20px rgba(13,89,242,0.4)', fontFamily: 'inherit' }}>
                  ▶ Solo Play
                </button>
                <button onClick={onRoom}
                  style={{ padding: '10px 22px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#cbd5e1', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  👥 Multiplayer
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Card track — tripled for infinite loop */}
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="no-scrollbar"
        style={{
          display: 'flex',
          overflowX: 'scroll',
          gap: CARD_GAP,
          paddingLeft:  `max(24px, calc(50vw - ${CARD_W / 2}px))`,
          paddingRight: `max(24px, calc(50vw - ${CARD_W / 2}px))`,
          paddingBottom: 20,
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        {tripled.map((game, i) => {
          const realIdx = i % n;
          const active = realIdx === selectedIndex && Math.floor(i / n) === 1;
          return (
            <div
              key={`${game.filename}-${i}`}
              onClick={() => {
                const realI = i % n;
                scrollToIdx(i, true);
                onSelect(realI);
              }}
              style={{
                flexShrink: 0,
                width: CARD_W,
                height: CARD_H,
                borderRadius: 18,
                overflow: 'hidden',
                position: 'relative',
                scrollSnapAlign: 'center',
                cursor: 'pointer',
                border: active ? '2px solid rgba(13,89,242,0.8)' : '1px solid rgba(255,255,255,0.06)',
                background: '#111827',
                transition: 'opacity 0.25s, transform 0.25s',
                opacity: active ? 1 : 0.5,
                transform: active ? 'scale(1)' : 'scale(0.88)',
                transformOrigin: 'bottom center',
              }}
            >
              {game.image ? (
                <img src={game.image} alt={game.name} referrerPolicy="no-referrer"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none',
                    transform: active ? 'scale(1.04)' : 'scale(1)', transition: 'transform 0.4s' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(160deg,#141c2e,#0b1020)', pointerEvents: 'none' }}>
                  <span style={{ fontSize: 52, opacity: 0.3 }}>🎮</span>
                </div>
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(4,8,18,0.88) 25%,rgba(4,8,18,0.08) 55%,transparent)', pointerEvents: 'none' }} />
              {active && <div style={{ position: 'absolute', top: 12, right: 12, width: 9, height: 9, borderRadius: '50%', background: '#0d59f2', pointerEvents: 'none' }} />}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px', pointerEvents: 'none' }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: active ? '#5a90ff' : '#475569', textTransform: 'uppercase', letterSpacing: '0.18em', margin: '0 0 3px' }}>{tag(game.slug)}</p>
                <h3 style={{ fontSize: active ? 13 : 11, fontWeight: 700, color: '#f1f5f9', textTransform: 'uppercase', margin: 0, lineHeight: 1.2 }}>{game.name}</h3>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dots — real games only */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingBottom: 12 }}>
        {games.map((_, i) => (
          <button key={i} onClick={() => { scrollToIdx(n + i, true); onSelect(i); }}
            style={{ width: i === selectedIndex ? 20 : 5, height: 5, borderRadius: 99,
              background: i === selectedIndex ? '#0d59f2' : 'rgba(255,255,255,0.15)',
              transition: 'width 0.25s', border: 'none', cursor: 'pointer', padding: 0 }} />
        ))}
      </div>

      <div style={{ textAlign: 'center', paddingBottom: 16, color: '#1e293b', fontSize: 11 }}>
        ← → navigate &nbsp;·&nbsp; Enter to play &nbsp;·&nbsp; / search
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [games, setGames]               = useState<Game[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [booting, setBooting]           = useState(true);
  const [search, setSearch]             = useState('');
  const [showSearch, setShowSearch]     = useState(false);
  const [socketStatus, setSocketStatus] = useState<'connected'|'disconnected'|'connecting'>('disconnected');
  const router  = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/games').then(r => r.json()).then(setGames).catch(() => {});
    const t = setTimeout(() => setBooting(false), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const update = () => setSocketStatus(socket.connected ? 'connected' : socket.active ? 'connecting' : 'disconnected');
    socket.on('connect', update); socket.on('disconnect', update); socket.on('connect_error', update);
    return () => { socket.off('connect', update); socket.off('disconnect', update); socket.off('connect_error', update); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showSearch) return;
      if (e.key === 'ArrowRight') setSelectedIndex(p => Math.min(p + 1, games.length - 1));
      else if (e.key === 'ArrowLeft') setSelectedIndex(p => Math.max(p - 1, 0));
      else if (e.key === 'Enter' && games[selectedIndex]) router.push('/play?rom=' + games[selectedIndex].filename);
      else if (e.key === '/') { e.preventDefault(); setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 50); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [games, selectedIndex, router, showSearch]);

  const handlePlay  = useCallback(() => { if (games[selectedIndex]) router.push('/play?rom=' + games[selectedIndex].filename); }, [games, selectedIndex, router]);
  const handleRoom  = useCallback(() => router.push('/multiplayer'), [router]);

  const filteredGames = useMemo(() =>
    search.trim() ? games.filter(g => g.name.toLowerCase().includes(search.toLowerCase()) || g.slug.toLowerCase().includes(search.toLowerCase())) : games,
    [games, search]
  );

  const [filteredSel, setFilteredSel] = useState(0);
  const currentGames    = search.trim() ? filteredGames : games;
  const currentSelected = search.trim() ? filteredSel   : selectedIndex;

  const handleSelect = useCallback((i: number) => {
    if (search.trim()) setFilteredSel(i);
    else setSelectedIndex(i);
  }, [search]);

  const handlePlayCurrent = useCallback(() => {
    const g = currentGames[currentSelected];
    if (g) router.push('/play?rom=' + g.filename);
  }, [currentGames, currentSelected, router]);

  if (booting) return <BootScreen />;

  return (
    <div style={{ height: '100vh', background: '#0b1020', color: '#f1f5f9', fontFamily: "'Space Grotesk', sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden',
      // Static gradient background — no canvas, no pointer interference
      backgroundImage: 'radial-gradient(ellipse 80% 60% at 70% 30%, rgba(13,89,242,0.10) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 20% 80%, rgba(13,89,242,0.06) 0%, transparent 60%)',
    }}>
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}`}</style>

      {/* Top bar */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px 8px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: '#0d59f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🕹️</div>
          <span style={{ fontWeight: 700, fontSize: 17, color: '#f1f5f9' }}>Potato <span style={{ color: '#0d59f2' }}>Arcade</span></span>
        </div>

        {/* Search + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AnimatePresence>
            {showSearch && (
              <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 220, opacity: 1 }} exit={{ width: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                <input ref={searchRef} value={search} onChange={e => { setSearch(e.target.value); setFilteredSel(0); }}
                  onBlur={() => { if (!search) setShowSearch(false); }}
                  onKeyDown={e => { if (e.key === 'Escape') { setSearch(''); setShowSearch(false); } }}
                  placeholder="Search games…" autoFocus
                  style={{ width: '100%', padding: '8px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#f1f5f9', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={() => { setShowSearch(s => !s); setTimeout(() => searchRef.current?.focus(), 50); }}
            style={{ width: 36, height: 36, borderRadius: 10, background: showSearch ? '#0d59f2' : 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🔍
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.05)', padding: '5px 10px', borderRadius: 20 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: socketStatus === 'connected' ? '#10b981' : '#ef4444' }} />
            <span style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{socketStatus}</span>
          </div>
        </div>
      </div>

      {/* Search label */}
      {search.trim() && (
        <div style={{ padding: '4px 24px', flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{filteredGames.length} result{filteredGames.length !== 1 ? 's' : ''} for "{search}"</span>
        </div>
      )}

      {/* Carousel */}
      <Carousel
        games={currentGames}
        selectedIndex={currentSelected}
        onSelect={handleSelect}
        onPlay={handlePlayCurrent}
        onRoom={handleRoom}
      />
    </div>
  );
}
