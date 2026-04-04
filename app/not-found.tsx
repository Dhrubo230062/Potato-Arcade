import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: '#101622', fontFamily: "'Space Grotesk', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center', color: '#f1f5f9' }}>
      <div style={{ width: 72, height: 72, background: '#0d59f2', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 24, boxShadow: '0 0 30px rgba(13,89,242,0.4)' }}>
        🕹️
      </div>
      <h1 style={{ fontSize: 'clamp(3rem,10vw,6rem)', fontWeight: 700, letterSpacing: '-4px', lineHeight: 1, marginBottom: 16, color: '#f1f5f9' }}>
        4<span style={{ color: '#0d59f2' }}>0</span>4
      </h1>
      <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: 400, marginBottom: 32 }}>
        This sector of the arcade is offline or doesn't exist.
      </p>
      <Link
        href="/"
        style={{ background: '#0d59f2', color: '#fff', fontWeight: 600, padding: '0.75rem 2rem', borderRadius: 14, textDecoration: 'none', fontSize: '0.9rem', boxShadow: '0 0 20px rgba(13,89,242,0.35)', transition: 'opacity 0.2s' }}
      >
        ← Back to Arcade
      </Link>
    </div>
  );
}
