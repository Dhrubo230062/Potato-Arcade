"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// ── Types ──────────────────────────────────────────────────────────────────
interface FileEntry { name: string; size: number; modified: string; }
type Dir = 'roms' | 'images';

const DIR_META: Record<Dir, { label: string; hint: string; accept: string; icon: string }> = {
  roms:   { label: 'ROMs',   hint: 'public/roms/neogeo/',  accept: '.zip', icon: '🎮' },
  images: { label: 'Images', hint: 'public/image/',        accept: '.png,.jpg,.jpeg,.webp', icon: '🖼️' },
};

function fmt(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('arcade_admin_token');
    if (!saved) return;
    // Verify token is still valid (server may have restarted)
    fetch('/api/admin/files?dir=roms', { headers: { 'x-admin-token': saved } })
      .then(r => {
        if (r.ok || r.status !== 401) setToken(saved);
        else sessionStorage.removeItem('arcade_admin_token'); // expired, force re-login
      })
      .catch(() => setToken(saved)); // network error — try anyway
  }, []);

  const handleLogin = async () => {
    setLoggingIn(true); setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      if (!res.ok) { setLoginError('Invalid credentials'); return; }
      const { token: t } = await res.json();
      sessionStorage.setItem('arcade_admin_token', t);
      setToken(t);
    } catch { setLoginError('Connection failed'); }
    finally { setLoggingIn(false); }
  };

  if (!token) return <LoginScreen
    user={loginUser} pass={loginPass}
    onUser={setLoginUser} onPass={setLoginPass}
    onLogin={handleLogin} error={loginError} loading={loggingIn}
  />;

  return <Dashboard token={token} onLogout={() => { sessionStorage.removeItem('arcade_admin_token'); setToken(null); }} />;
}

// ── Login Screen ────────────────────────────────────────────────────────────
function LoginScreen({ user, pass, onUser, onPass, onLogin, error, loading }: any) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6"
      style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #0a1a0a 0%, #000 70%)' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl mb-4 shadow-[0_0_40px_rgba(16,185,129,0.5)]">
            <span className="text-2xl">⚙️</span>
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-white uppercase">Admin<span className="text-emerald-500">OS</span></h1>
          <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest mt-1">Arcade Control Center</p>
        </div>

        {/* Form */}
        <div className="space-y-3">
          <input value={user} onChange={e => onUser(e.target.value)}
            placeholder="USERNAME"
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-white text-sm font-bold uppercase tracking-widest outline-none transition-all placeholder:text-zinc-700"
          />
          <input value={pass} onChange={e => onPass(e.target.value)}
            type="password" placeholder="PASSWORD"
            onKeyDown={e => e.key === 'Enter' && onLogin()}
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-white text-sm font-bold uppercase tracking-widest outline-none transition-all placeholder:text-zinc-700"
          />
          {error && <p className="text-red-500 text-xs font-bold uppercase tracking-widest text-center">{error}</p>}
          <button onClick={onLogin} disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black uppercase tracking-widest py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            {loading ? 'AUTHENTICATING...' : 'ACCESS SYSTEM'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [activeDir, setActiveDir] = useState<Dir>('roms');

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const headers = { 'x-admin-token': token };

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const loadFiles = useCallback(async (dir: Dir) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/files?dir=${dir}`, { headers });
      if (res.status === 401) { onLogout(); return; }
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : []);
    } catch { showToast('Failed to load files', false); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadFiles(activeDir); }, [activeDir, loadFiles]);



  const uploadFiles = async (fileList: FileList) => {
    if (!fileList.length) return;
    setUploading(true); setUploadProgress(0);
    const form = new FormData();
    Array.from(fileList).forEach(f => form.append('file', f));

    // Use XHR for progress tracking
    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100));
      };
      xhr.onload = () => {
        if (xhr.status === 200) {
          const { saved } = JSON.parse(xhr.responseText);
          showToast(`✅ Uploaded: ${saved.join(', ')}`);
        } else {
          showToast('Upload failed', false);
        }
        resolve();
      };
      xhr.onerror = () => { showToast('Upload error', false); resolve(); };
      xhr.open('POST', `/api/admin/upload?dir=${activeDir}`);
      xhr.setRequestHeader('x-admin-token', token);
      xhr.send(form);
    });

    setUploading(false);
    loadFiles(activeDir);
  };

  const deleteFile = async (name: string) => {
    try {
      const res = await fetch(`/api/admin/file?dir=${activeDir}&name=${encodeURIComponent(name)}`, {
        method: 'DELETE', headers,
      });
      if (res.ok) { showToast(`🗑️ Deleted ${name}`); loadFiles(activeDir); }
      else showToast('Delete failed', false);
    } catch { showToast('Delete error', false); }
    setConfirmDelete(null);
  };

  const renameFile = async (oldName: string) => {
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/admin/rename', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir: activeDir, oldName, newName: newName.trim() }),
      });
      if (res.ok) { showToast(`✏️ Renamed to ${newName}`); loadFiles(activeDir); }
      else showToast('Rename failed', false);
    } catch { showToast('Rename error', false); }
    setRenaming(null); setNewName('');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white"
      style={{ backgroundImage: 'radial-gradient(ellipse at top, #0d1f10 0%, #09090b 50%)' }}>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full font-bold text-sm shadow-xl ${toast.ok ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              className="bg-zinc-900 border border-zinc-700 rounded-3xl p-8 max-w-sm w-full text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-lg font-black uppercase tracking-tighter mb-2">Delete File?</h3>
              <p className="text-zinc-400 text-sm mb-6 break-all font-mono">{confirmDelete}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-black uppercase text-sm tracking-widest transition-all">
                  Cancel
                </button>
                <button onClick={() => deleteFile(confirmDelete)}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-400 text-white rounded-xl font-black uppercase text-sm tracking-widest transition-all">
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-zinc-800/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)]">
            <span className="text-sm">⚙️</span>
          </div>
          <span className="font-black uppercase tracking-tighter">Admin<span className="text-emerald-500">OS</span></span>
          <span className="hidden sm:block text-zinc-600 text-xs font-bold uppercase tracking-widest">/ File Manager</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/" className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
            ← Arcade
          </a>
          <button onClick={onLogout}
            className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-full text-xs font-bold uppercase tracking-widest transition-all">
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">


        {/* Warning banner */}
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3">
          <span className="text-amber-500 text-lg mt-0.5">⚠️</span>
          <div>
            <p className="text-amber-400 font-black uppercase tracking-tighter text-sm">Railway Ephemeral Storage</p>
            <p className="text-amber-600 text-xs mt-1">Files uploaded here will be <strong>lost on redeploy</strong>. Add a Railway Volume at <code className="bg-black/40 px-1 rounded">/app/public</code> to persist files permanently.</p>
          </div>
        </div>

        {/* Dir Tabs */}
        <div className="flex gap-2 mb-6">
          {(Object.keys(DIR_META) as Dir[]).map(dir => (
            <button key={dir} onClick={() => setActiveDir(dir)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase text-sm tracking-widest transition-all ${
                activeDir === dir
                  ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 border border-zinc-800'
              }`}>
              <span>{DIR_META[dir].icon}</span>
              {DIR_META[dir].label}
              {activeDir === dir && (
                <span className="bg-black/20 text-black text-xs px-2 py-0.5 rounded-full">{files.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Upload Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`mb-6 border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            dragOver ? 'border-emerald-500 bg-emerald-500/10' :
            uploading ? 'border-zinc-600 bg-zinc-900/50 cursor-wait' :
            'border-zinc-700 hover:border-emerald-500/50 hover:bg-zinc-900/50'
          }`}>
          <input ref={fileInputRef} type="file"
            accept={DIR_META[activeDir].accept}
            multiple className="hidden"
            onChange={e => e.target.files && uploadFiles(e.target.files)}
          />

          {uploading ? (
            <div>
              <div className="text-emerald-500 font-black uppercase tracking-widest mb-3">Uploading... {uploadProgress}%</div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden max-w-xs mx-auto">
                <motion.div animate={{ width: `${uploadProgress}%` }} className="h-full bg-emerald-500 rounded-full" />
              </div>
            </div>
          ) : (
            <div>
              <div className="text-3xl mb-2">📁</div>
              <p className="font-black uppercase tracking-widest text-sm text-zinc-300">
                Drop {DIR_META[activeDir].label} here or click to browse
              </p>
              <p className="text-zinc-600 text-xs mt-1 font-mono">{DIR_META[activeDir].hint}</p>
              <p className="text-zinc-700 text-xs mt-1">Accepts: {DIR_META[activeDir].accept}</p>
            </div>
          )}
        </div>

        {/* File List */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="font-black uppercase tracking-tighter text-sm flex items-center gap-2">
              <span>{DIR_META[activeDir].icon}</span>
              {DIR_META[activeDir].label} Files
            </h2>
            <button onClick={() => loadFiles(activeDir)}
              className="text-zinc-500 hover:text-emerald-500 transition-colors text-sm font-bold uppercase tracking-widest">
              ↺ Refresh
            </button>
          </div>

          {loading ? (
            <div className="py-16 text-center text-zinc-600 font-bold uppercase tracking-widest text-sm">Loading...</div>
          ) : files.length === 0 ? (
            <div className="py-16 text-center text-zinc-700 font-bold uppercase tracking-widest text-sm">No files found</div>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {files.map(f => (
                <AnimatePresence key={f.name}>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-zinc-800/30 transition-colors group">

                    {renaming === f.name ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') renameFile(f.name); if (e.key === 'Escape') { setRenaming(null); setNewName(''); } }}
                          className="flex-1 bg-zinc-800 border border-emerald-500 rounded-lg px-3 py-1.5 text-sm font-mono outline-none text-white"
                        />
                        <button onClick={() => renameFile(f.name)} className="text-emerald-500 font-bold text-sm px-3 py-1.5 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition-colors">Save</button>
                        <button onClick={() => { setRenaming(null); setNewName(''); }} className="text-zinc-500 text-sm px-2 py-1.5">✕</button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-lg flex-shrink-0">
                            {f.name.endsWith('.zip') ? '📦' : f.name.match(/\.(png|jpg|jpeg|webp)$/i) ? '🖼️' : '📄'}
                          </span>
                          <div className="min-w-0">
                            <p className="font-mono text-sm text-zinc-200 truncate">{f.name}</p>
                            <p className="text-zinc-600 text-xs">{fmt(f.size)} · {new Date(f.modified).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => { setRenaming(f.name); setNewName(f.name); }}
                            className="text-zinc-400 hover:text-emerald-400 text-xs font-bold uppercase tracking-widest px-3 py-1.5 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-all">
                            Rename
                          </button>
                          <button onClick={() => setConfirmDelete(f.name)}
                            className="text-zinc-400 hover:text-red-400 text-xs font-bold uppercase tracking-widest px-3 py-1.5 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-all">
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              ))}
            </div>
          )}
        </div>

        {/* Storage note */}
        <p className="text-center text-zinc-700 text-xs font-mono mt-6">
          Railway Volume path: <span className="text-zinc-500">/app/public</span> — mount this to persist uploads across deploys
        </p>

      </main>
    </div>
  );
}
