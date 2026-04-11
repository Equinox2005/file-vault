import React, { useState, useEffect, useCallback, useRef } from 'react';
import { signUp, confirmSignUp, signIn, signOut, getCurrentUser } from './auth';
import { getFiles, createFileEntry, deleteFile, getUploadUrl, getDownloadUrl, createFolder, shareFile } from './api';
import './App.css';

/* ─── helpers ─── */
function getFileIcon(name, type) {
  if (type === 'folder') return '📁';
  const ext = (name || '').split('.').pop().toLowerCase();
  const map = {
    pdf: '📕', doc: '📝', docx: '📝', txt: '📄', rtf: '📄',
    xls: '📊', xlsx: '📊', csv: '📊',
    ppt: '📙', pptx: '📙',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️', bmp: '🖼️',
    mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬', webm: '🎬',
    mp3: '🎵', wav: '🎵', flac: '🎵', ogg: '🎵',
    zip: '🗜️', rar: '🗜️', '7z': '🗜️', tar: '🗜️', gz: '🗜️',
    js: '💻', jsx: '💻', ts: '💻', tsx: '💻', py: '💻', java: '💻', cpp: '💻', c: '💻', html: '💻', css: '💻', json: '💻',
    exe: '⚙️', dmg: '⚙️', msi: '⚙️',
  };
  return map[ext] || '📄';
}

function getFileBadge(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  const cats = {
    image: { exts: ['jpg','jpeg','png','gif','webp','svg','bmp'], color: 'badge-pink', label: 'Image' },
    video: { exts: ['mp4','mov','avi','mkv','webm'], color: 'badge-purple', label: 'Video' },
    audio: { exts: ['mp3','wav','flac','ogg'], color: 'badge-amber', label: 'Audio' },
    document: { exts: ['pdf','doc','docx','txt','rtf','ppt','pptx'], color: 'badge-blue', label: 'Doc' },
    spreadsheet: { exts: ['xls','xlsx','csv'], color: 'badge-green', label: 'Sheet' },
    archive: { exts: ['zip','rar','7z','tar','gz'], color: 'badge-gray', label: 'Archive' },
    code: { exts: ['js','jsx','ts','tsx','py','java','cpp','c','html','css','json'], color: 'badge-teal', label: 'Code' },
  };
  for (const cat of Object.values(cats)) {
    if (cat.exts.includes(ext)) return { color: cat.color, label: cat.label };
  }
  return { color: 'badge-gray', label: ext.toUpperCase() || 'File' };
}

function formatSize(bytes) {
  if (!bytes || bytes === '0') return '—';
  const num = Number(bytes);
  if (num < 1024) return num + ' B';
  if (num < 1048576) return (num / 1024).toFixed(1) + ' KB';
  if (num < 1073741824) return (num / 1048576).toFixed(1) + ' MB';
  return (num / 1073741824).toFixed(2) + ' GB';
}

function isPreviewable(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  return ['jpg','jpeg','png','gif','webp','svg','bmp','pdf','txt','json','csv','js','py','html','css'].includes(ext);
}

function isImageExt(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  return ['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext);
}

/* ─── App ─── */
function App() {
  const [page, setPage] = useState('loading');
  const [token, setToken] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    const session = await getCurrentUser();
    if (session) {
      setToken(session.token);
      setUserEmail(session.email || session.user.getUsername());
      setPage('dashboard');
    } else {
      setPage('login');
    }
  }

  function handleSignOut() {
    signOut(); setToken(''); setUserEmail(''); setPage('login');
  }

  if (page === 'loading') return <div className="app"><div className="loading"><div className="spinner"></div>Loading...</div></div>;

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="logo" onClick={() => token && setPage('dashboard')}>
            <span className="logo-icon">🔒</span>
            <h1>FileVault</h1>
          </div>
        </div>
        <div className="header-right">
          <button className="dark-toggle" onClick={() => setDarkMode(!darkMode)} title={darkMode ? 'Light mode' : 'Dark mode'}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          {token && (
            <>
              <span className="user-email">{userEmail}</span>
              <button className="btn btn-outline btn-header" onClick={handleSignOut}>Sign Out</button>
            </>
          )}
        </div>
      </header>
      <main className="main">
        {error && <div className="alert alert-error animate-slide">{error}<button onClick={() => setError('')}>×</button></div>}
        {success && <div className="alert alert-success animate-slide">{success}<button onClick={() => setSuccess('')}>×</button></div>}
        {page === 'login' && <LoginPage setPage={setPage} setToken={setToken} setUserEmail={setUserEmail} setError={setError} setSuccess={setSuccess} />}
        {page === 'signup' && <SignUpPage setPage={setPage} setError={setError} setSuccess={setSuccess} />}
        {page === 'confirm' && <ConfirmPage setPage={setPage} setError={setError} setSuccess={setSuccess} />}
        {page === 'dashboard' && <Dashboard token={token} setError={setError} setSuccess={setSuccess} />}
      </main>
    </div>
  );
}

/* ─── Auth Pages ─── */
function LoginPage({ setPage, setToken, setUserEmail, setError, setSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const result = await signIn(email, password);
      setToken(result.getIdToken().getJwtToken());
      setUserEmail(email); setSuccess(''); setPage('dashboard');
    } catch (err) { setError(err.message || 'Failed to sign in'); }
    setLoading(false);
  }

  return (
    <div className="auth-container">
      <div className="auth-card animate-fade">
        <div className="auth-header">
          <span className="auth-icon">🔒</span>
          <h2>Welcome back</h2>
          <p className="auth-sub">Sign in to your FileVault</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary btn-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
        </form>
        <p className="auth-switch">Don't have an account? <button className="link-btn" onClick={() => setPage('signup')}>Sign Up</button></p>
      </div>
    </div>
  );
}

function SignUpPage({ setPage, setError, setSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await signUp(email, password);
      setSuccess('Account created! Check your email for a verification code.');
      setPage('confirm');
    } catch (err) { setError(err.message || 'Failed to sign up'); }
    setLoading(false);
  }

  return (
    <div className="auth-container">
      <div className="auth-card animate-fade">
        <div className="auth-header">
          <span className="auth-icon">✨</span>
          <h2>Create Account</h2>
          <p className="auth-sub">Start securing your files</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min 8 chars, uppercase, lowercase, number" />
          </div>
          <button className="btn btn-primary btn-full" disabled={loading}>{loading ? 'Creating...' : 'Sign Up'}</button>
        </form>
        <p className="auth-switch">Already have an account? <button className="link-btn" onClick={() => setPage('login')}>Sign In</button></p>
      </div>
    </div>
  );
}

function ConfirmPage({ setPage, setError, setSuccess }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await confirmSignUp(email, code);
      setSuccess('Email verified! You can now sign in.');
      setPage('login');
    } catch (err) { setError(err.message || 'Failed to verify'); }
    setLoading(false);
  }

  return (
    <div className="auth-container">
      <div className="auth-card animate-fade">
        <div className="auth-header">
          <span className="auth-icon">📧</span>
          <h2>Verify Email</h2>
          <p className="auth-sub">Enter the code we sent you</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Verification Code</label>
            <input type="text" value={code} onChange={e => setCode(e.target.value)} required placeholder="123456" />
          </div>
          <button className="btn btn-primary btn-full" disabled={loading}>{loading ? 'Verifying...' : 'Verify'}</button>
        </form>
        <p className="auth-switch"><button className="link-btn" onClick={() => setPage('login')}>Back to Sign In</button></p>
      </div>
    </div>
  );
}

/* ─── Dashboard ─── */
function Dashboard({ token, setError, setSuccess }) {
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState('root');
  const [folderPath, setFolderPath] = useState([{ name: 'My Files', id: 'root' }]);
  const [uploading, setUploading] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [shareModal, setShareModal] = useState(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareHours, setShareHours] = useState(24);
  const [shareUrl, setShareUrl] = useState('');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode') || 'list');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('favorites') || '[]'));
  const [showTab, setShowTab] = useState('files');
  const [previewItem, setPreviewItem] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => { localStorage.setItem('viewMode', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('favorites', JSON.stringify(favorites)); }, [favorites]);

  const loadFiles = useCallback(async () => {
    try {
      const data = await getFiles(currentFolder, token);
      setItems(data.items || []);
    } catch (err) { setError(err.message); }
    setLoading(false);
  }, [currentFolder, token, setError]);

  const loadAllFiles = useCallback(async () => {
    try {
      const data = await getFiles('', token);
      setAllItems(data.items || []);
    } catch (err) { /* silent */ }
  }, [token]);

  useEffect(() => { loadFiles(); }, [loadFiles]);
  useEffect(() => { loadAllFiles(); }, [loadAllFiles]);

  /* drag and drop */
  function handleDragOver(e) { e.preventDefault(); e.stopPropagation(); setDragging(true); }
  function handleDragLeave(e) { e.preventDefault(); e.stopPropagation(); setDragging(false); }
  function handleDrop(e) { e.preventDefault(); e.stopPropagation(); setDragging(false); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); }

  async function uploadFiles(fileList) {
    if (!fileList.length) return;
    setUploading(true); setError('');
    try {
      for (const file of fileList) {
        const urlData = await getUploadUrl({ name: file.name, contentType: file.type }, token);
        await fetch(urlData.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        await createFileEntry({ name: file.name, folder: currentFolder, size: file.size, contentType: file.type, s3Key: urlData.s3Key, itemId: urlData.itemId }, token);
      }
      setSuccess(`Uploaded ${fileList.length} file(s)`);
      loadFiles(); loadAllFiles();
    } catch (err) { setError(err.message); }
    setUploading(false);
  }

  function handleUpload(e) { uploadFiles(e.target.files); e.target.value = ''; }

  async function handleDownload(item) {
    try {
      const data = await getDownloadUrl(item.s3Key, token);
      window.open(data.downloadUrl, '_blank');
    } catch (err) { setError(err.message); }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await deleteFile(item.itemId, token);
      setItems(items.filter(i => i.itemId !== item.itemId));
      setSuccess(`Deleted "${item.name}"`);
      loadAllFiles();
    } catch (err) { setError(err.message); }
  }

  async function handleCreateFolder(e) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await createFolder(newFolderName, currentFolder, token);
      setNewFolderName(''); setShowNewFolder(false);
      setSuccess(`Folder "${newFolderName}" created`);
      loadFiles(); loadAllFiles();
    } catch (err) { setError(err.message); }
  }

  function openFolder(folder) {
    setCurrentFolder(folder.itemId);
    setFolderPath([...folderPath, { name: folder.name, id: folder.itemId }]);
    setLoading(true);
  }

  function navigateToFolder(index) {
    setCurrentFolder(folderPath[index].id);
    setFolderPath(folderPath.slice(0, index + 1));
    setLoading(true);
  }

  function toggleFavorite(itemId) {
    setFavorites(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);
  }

  async function handlePreview(item) {
    try {
      const data = await getDownloadUrl(item.s3Key, token);
      setPreviewUrl(data.downloadUrl);
      setPreviewItem(item);
    } catch (err) { setError(err.message); }
  }

  async function handleShare(item) {
    setShareModal(item); setShareUrl(''); setShareEmail(''); setShareHours(24);
  }

  async function submitShare() {
    try {
      const data = await shareFile(shareModal.s3Key, shareModal.name, shareEmail, shareHours, token);
      setShareUrl(data.shareUrl);
      if (shareEmail) setSuccess(`Share link sent to ${shareEmail}`);
    } catch (err) { setError(err.message); }
  }

  /* computed */
  const totalStorage = allItems.filter(i => i.type === 'file').reduce((sum, i) => sum + Number(i.size || 0), 0);
  const recentFiles = [...allItems].filter(i => i.type === 'file').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5);
  const favoriteItems = allItems.filter(i => favorites.includes(i.itemId));

  const filtered = items.filter(i => {
    if (!searchQuery) return true;
    return i.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const folders = filtered.filter(i => i.type === 'folder');
  const files = filtered.filter(i => i.type === 'file');

  if (loading) return <div className="loading"><div className="spinner"></div>Loading files...</div>;

  return (
    <div className="dashboard">
      {/* Storage Bar */}
      <div className="storage-bar">
        <div className="storage-info">
          <span>Storage: <strong>{formatSize(totalStorage)}</strong> of 5 GB used</span>
          <span className="storage-pct">{(totalStorage / (5 * 1073741824) * 100).toFixed(1)}%</span>
        </div>
        <div className="storage-track">
          <div className="storage-fill" style={{ width: `${Math.min(totalStorage / (5 * 1073741824) * 100, 100)}%` }}></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${showTab === 'files' ? 'active' : ''}`} onClick={() => setShowTab('files')}>Files</button>
        <button className={`tab ${showTab === 'recent' ? 'active' : ''}`} onClick={() => setShowTab('recent')}>Recent</button>
        <button className={`tab ${showTab === 'favorites' ? 'active' : ''}`} onClick={() => setShowTab('favorites')}>Favorites ({favoriteItems.length})</button>
      </div>

      {showTab === 'files' && (
        <>
          {/* Breadcrumb */}
          <div className="breadcrumb">
            {folderPath.map((f, i) => (
              <span key={f.id}>
                {i > 0 && <span className="breadcrumb-sep">/</span>}
                <button className="link-btn breadcrumb-btn" onClick={() => navigateToFolder(i)}>{f.name}</button>
              </span>
            ))}
          </div>

          {/* Toolbar */}
          <div className="toolbar">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search files..." />
              {searchQuery && <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>}
            </div>
            <div className="toolbar-actions">
              <div className="view-toggle">
                <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} title="List view">☰</button>
                <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title="Grid view">⊞</button>
              </div>
              <button className="btn btn-outline" onClick={() => setShowNewFolder(!showNewFolder)}>+ Folder</button>
              <label className="btn btn-primary upload-btn">
                {uploading ? 'Uploading...' : '+ Upload'}
                <input ref={fileInputRef} type="file" multiple onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          {showNewFolder && (
            <form onSubmit={handleCreateFolder} className="new-folder-form animate-slide">
              <input type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Folder name" autoFocus />
              <button type="submit" className="btn btn-primary btn-sm">Create</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowNewFolder(false)}>Cancel</button>
            </form>
          )}

          {/* Drop zone */}
          <div
            ref={dropRef}
            className={`drop-zone ${dragging ? 'active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {folders.length === 0 && files.length === 0 && !dragging ? (
              <div className="empty-state">
                <div className="empty-icon">📂</div>
                <h3>Drop files here</h3>
                <p>or click Upload to browse</p>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'file-grid' : 'file-list'}>
                {folders.map(folder => (
                  <FileCard key={folder.itemId} item={folder} viewMode={viewMode} isFav={favorites.includes(folder.itemId)}
                    onOpen={() => openFolder(folder)} onDelete={() => handleDelete(folder)} onToggleFav={() => toggleFavorite(folder.itemId)} />
                ))}
                {files.map(file => (
                  <FileCard key={file.itemId} item={file} viewMode={viewMode} isFav={favorites.includes(file.itemId)}
                    onDownload={() => handleDownload(file)} onDelete={() => handleDelete(file)} onShare={() => handleShare(file)}
                    onPreview={isPreviewable(file.name) ? () => handlePreview(file) : null} onToggleFav={() => toggleFavorite(file.itemId)} />
                ))}
              </div>
            )}
            {dragging && <div className="drop-overlay"><div className="drop-message">📥 Drop files to upload</div></div>}
          </div>
        </>
      )}

      {showTab === 'recent' && (
        <div className="tab-content animate-fade">
          <h3 className="tab-title">Recent Files</h3>
          {recentFiles.length === 0 ? (
            <div className="empty-state"><h3>No recent files</h3><p>Upload some files to see them here.</p></div>
          ) : (
            <div className="file-list">
              {recentFiles.map(file => (
                <FileCard key={file.itemId} item={file} viewMode="list" isFav={favorites.includes(file.itemId)}
                  onDownload={() => handleDownload(file)} onDelete={() => handleDelete(file)} onShare={() => handleShare(file)}
                  onPreview={isPreviewable(file.name) ? () => handlePreview(file) : null} onToggleFav={() => toggleFavorite(file.itemId)} />
              ))}
            </div>
          )}
        </div>
      )}

      {showTab === 'favorites' && (
        <div className="tab-content animate-fade">
          <h3 className="tab-title">Favorites</h3>
          {favoriteItems.length === 0 ? (
            <div className="empty-state"><h3>No favorites yet</h3><p>Star files to add them here.</p></div>
          ) : (
            <div className="file-list">
              {favoriteItems.map(item => (
                <FileCard key={item.itemId} item={item} viewMode="list" isFav={true}
                  onOpen={item.type === 'folder' ? () => { setShowTab('files'); openFolder(item); } : null}
                  onDownload={item.type === 'file' ? async () => { const d = await getDownloadUrl(item.s3Key, token); window.open(d.downloadUrl, '_blank'); } : null}
                  onDelete={() => handleDelete(item)} onShare={item.type === 'file' ? () => handleShare(item) : null}
                  onToggleFav={() => toggleFavorite(item.itemId)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="modal-overlay" onClick={() => { setPreviewItem(null); setPreviewUrl(''); }}>
          <div className="modal modal-preview" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{previewItem.name}</h3>
              <button className="modal-close" onClick={() => { setPreviewItem(null); setPreviewUrl(''); }}>×</button>
            </div>
            <div className="preview-body">
              {isImageExt(previewItem.name) ? (
                <img src={previewUrl} alt={previewItem.name} className="preview-image" />
              ) : previewItem.name.endsWith('.pdf') ? (
                <iframe src={previewUrl} title={previewItem.name} className="preview-iframe"></iframe>
              ) : (
                <iframe src={previewUrl} title={previewItem.name} className="preview-iframe"></iframe>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModal && (
        <div className="modal-overlay" onClick={() => setShareModal(null)}>
          <div className="modal animate-fade" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Share "{shareModal.name}"</h3>
              <button className="modal-close" onClick={() => setShareModal(null)}>×</button>
            </div>
            <div className="form-group">
              <label>Recipient Email (optional)</label>
              <input type="email" value={shareEmail} onChange={e => setShareEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="form-group">
              <label>Link expires in</label>
              <select value={shareHours} onChange={e => setShareHours(Number(e.target.value))}>
                <option value={1}>1 hour</option>
                <option value={6}>6 hours</option>
                <option value={24}>24 hours</option>
                <option value={72}>3 days</option>
                <option value={168}>7 days</option>
              </select>
            </div>
            {shareUrl ? (
              <div className="share-url-box">
                <label>Share Link:</label>
                <input type="text" value={shareUrl} readOnly onClick={e => { e.target.select(); navigator.clipboard.writeText(shareUrl); setSuccess('Link copied!'); }} />
                <p className="share-hint">Click to copy</p>
              </div>
            ) : (
              <button className="btn btn-primary btn-full" onClick={submitShare}>Generate Share Link</button>
            )}
            <button className="btn btn-outline btn-full" style={{ marginTop: 8 }} onClick={() => setShareModal(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── FileCard ─── */
function FileCard({ item, viewMode, isFav, onOpen, onDownload, onDelete, onShare, onPreview, onToggleFav }) {
  const badge = item.type === 'file' ? getFileBadge(item.name) : null;
  const isFolder = item.type === 'folder';

  if (viewMode === 'grid') {
    return (
      <div className={`grid-card animate-fade ${isFolder ? 'folder-card' : ''}`} onClick={isFolder ? onOpen : onPreview || onDownload}>
        <div className="grid-card-top">
          <button className={`star-btn ${isFav ? 'starred' : ''}`} onClick={e => { e.stopPropagation(); onToggleFav(); }}>{isFav ? '★' : '☆'}</button>
          <div className="grid-icon">{getFileIcon(item.name, item.type)}</div>
          {badge && <span className={`badge ${badge.color}`}>{badge.label}</span>}
        </div>
        <div className="grid-card-info">
          <span className="grid-name" title={item.name}>{item.name}</span>
          <span className="grid-meta">{isFolder ? 'Folder' : formatSize(item.size)}</span>
        </div>
        <div className="grid-actions" onClick={e => e.stopPropagation()}>
          {onDownload && <button className="icon-btn" onClick={onDownload} title="Download">⬇️</button>}
          {onShare && <button className="icon-btn" onClick={onShare} title="Share">🔗</button>}
          <button className="icon-btn icon-btn-danger" onClick={onDelete} title="Delete">🗑️</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`file-item animate-fade ${isFolder ? 'folder-item' : ''}`} onClick={isFolder ? onOpen : null}>
      <button className={`star-btn ${isFav ? 'starred' : ''}`} onClick={e => { e.stopPropagation(); onToggleFav(); }}>{isFav ? '★' : '☆'}</button>
      <div className="file-icon">{getFileIcon(item.name, item.type)}</div>
      <div className="file-info">
        <span className="file-name">{item.name}</span>
        <span className="file-meta">
          {isFolder ? 'Folder' : formatSize(item.size)}
          {item.createdAt && ` · ${new Date(item.createdAt).toLocaleDateString()}`}
        </span>
      </div>
      {badge && <span className={`badge ${badge.color}`}>{badge.label}</span>}
      <div className="file-actions" onClick={e => e.stopPropagation()}>
        {onPreview && <button className="btn btn-outline btn-sm" onClick={onPreview}>Preview</button>}
        {onDownload && <button className="btn btn-primary btn-sm" onClick={onDownload}>Download</button>}
        {onShare && <button className="btn btn-outline btn-sm" onClick={onShare}>Share</button>}
        <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

export default App;
