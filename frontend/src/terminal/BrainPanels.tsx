import { useEffect, useRef, useState } from 'react';
import { ArrowTopRightIcon, Cross2Icon, MagnifyingGlassIcon, PlusIcon, ReaderIcon, DownloadIcon, CheckIcon, SunIcon, MoonIcon, DesktopIcon, Pencil1Icon } from '@radix-ui/react-icons';

export type Memory = { id: string; title: string; content: string; category: string; project: string; pinned: boolean; source: string; updatedAt: string };
export type Source = { id: string; name: string; project: string; path: string; bytes: number; indexed: boolean; kind: string; updatedAt: string; text?: string; excerpt?: string };
export type Skill = { id: string; name: string; description: string; plugin: boolean; path: string };
export type BrainState = {
  memories: Memory[];
  projects: { id: string; name: string; source: string }[];
  skills: Skill[];
  files: Source[];
  counts: { memories: number; files: number; archives: number; skills: number; indexed: number };
  pending: { name: string; reason: string }[];
  vaultPath?: string;
};

export const PALETTES = [
  { id: 'mono', name: 'Monochrome', color: '#a2a2a2' },
  { id: 'blue', name: 'Cobalt', color: '#729aee' },
  { id: 'green', name: 'Sage', color: '#8faa91' },
  { id: 'amber', name: 'Amber', color: '#d4aa66' },
  { id: 'rose', name: 'Rose', color: '#ce91a0' },
  { id: 'slate', name: 'Slate', color: '#94a3b8' },
  { id: 'copper', name: 'Copper', color: '#c08a5c' },
  { id: 'forest', name: 'Forest', color: '#6f9b76' },
  { id: 'ink', name: 'Ink', color: '#6b8cae' },
  { id: 'sand', name: 'Sand', color: '#c4b59a' },
] as const;

export type PaletteId = (typeof PALETTES)[number]['id'];
export type Appearance = { theme: 'dark' | 'light' | 'system'; palette: PaletteId };

export async function request(p: string, method = 'GET', data?: unknown) {
  const res = await fetch('/terminal-api/' + p, { method, headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
  const body = await res.json();
  if (!res.ok) throw Error(body.error || 'Request failed');
  return body;
}

export function Knowledge({ brain, refresh, project, onError }: { brain: BrainState | null; refresh: () => Promise<void>; project: string; onError: (e: string) => void }) {
  const [tab, setTab] = useState('library');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Source[] | null>(null);
  const [preview, setPreview] = useState<Source | null>(null);
  const [draft, setDraft] = useState<Partial<Memory> | null>(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const upload = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = new AbortController();
    const t = setTimeout(() => {
      if (!query.trim()) { setResults(null); return; }
      fetch('/terminal-api/brain/search?q=' + encodeURIComponent(query) + '&project=' + encodeURIComponent(project), { signal: c.signal })
        .then(r => { if (!r.ok) throw Error('Search failed'); return r.json(); })
        .then(setResults)
        .catch(e => { if (e.name !== 'AbortError') onError(e.message); });
    }, 200);
    return () => { clearTimeout(t); c.abort(); };
  }, [query, project]);

  useEffect(() => {
    if (!preview) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('.source-preview');
    dialog?.querySelector<HTMLElement>('button')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreview(null);
      if (e.key === 'Tab' && dialog) {
        const items = Array.from(dialog.querySelectorAll<HTMLElement>('button,a[href]'));
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); previous?.focus(); };
  }, [preview]);

  const files = (results || brain?.files || []).filter(f => project === 'global' || project === 'all' || f.project === project);
  const memories = (brain?.memories || []).filter(m => (project === 'global' || m.project === 'global' || m.project === project) && (!query || (m.title + ' ' + m.content).toLowerCase().includes(query.toLowerCase())));

  async function save() {
    if (!draft?.content?.trim()) return;
    setBusy('Saving memory');
    try {
      await request('brain/memories', 'POST', { ...draft, project: draft.project || project });
      setDraft(null);
      await refresh();
      setNotice('Memory saved. Future chats can retrieve it.');
    } catch (e) { onError(String(e)); }
    finally { setBusy(''); }
  }

  async function importFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    let count = 0;
    try {
      for (const file of Array.from(fileList)) {
        if (file.size > 20_000_000) throw Error(`${file.name} exceeds 20 MB. Use the local import script for larger files.`);
        setBusy(`Importing ${++count} of ${fileList.length}: ${file.name}`);
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = () => reject(Error('Could not read ' + file.name));
          reader.readAsDataURL(file);
        });
        await request('brain/import', 'POST', { name: file.name, content, project: project === 'global' ? 'inbox' : project });
      }
      await refresh();
      setNotice(`${count} source file${count === 1 ? '' : 's'} imported into the unified vault.`);
    } catch (e) { onError(String(e)); await refresh(); }
    finally { setBusy(''); if (upload.current) upload.current.value = ''; }
  }

  const [cogText, setCogText] = useState('');
  async function saveCog(kind: 'braindump' | 'daily-brief') {
    if (!cogText.trim()) return;
    setBusy(kind === 'braindump' ? 'Saving braindump' : 'Saving daily brief');
    try {
      const saved = await request('cog/capture', 'POST', { kind, content: cogText });
      setCogText('');
      await refresh();
      setNotice(`${kind === 'braindump' ? 'Braindump' : 'Daily brief'} saved to vault · ${saved.file}`);
    } catch (e) { onError(String(e)); }
    finally { setBusy(''); }
  }

  return (
    <section className="brain-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">UNIFIED VAULT</span>
          <h2>Your knowledge, in one place.</h2>
          <p>Source files, saved decisions, and conversations — shared with Obsidian at <code className="vault-path">{brain?.vaultPath || '~/Desktop/JARVIS/vault'}</code>.</p>
        </div>
        <div className="button-group">
          <button className="quiet-button" disabled={!!busy} onClick={() => { setTab('memories'); setDraft({ category: 'note', project, pinned: false }); }}><PlusIcon />Save a memory</button>
          <button className="primary-button" disabled={!!busy} onClick={() => upload.current?.click()}><PlusIcon />Import files</button>
          <input ref={upload} type="file" multiple hidden onChange={e => importFiles(e.target.files)} />
        </div>
      </div>
      <div className="cog-flows">
        <div className="cog-card">
          <span className="eyebrow">COG · BRAINDUMP</span>
          <h3>Get it out of your head</h3>
          <p>Quick capture into <code>00-inbox</code>. Attach the braindump skill in Workspace when you want structure.</p>
          <textarea value={cogText} onChange={e => setCogText(e.target.value)} placeholder="Raw thoughts, ideas, competitive notes…" rows={3} />
          <div className="button-group">
            <button className="quiet-button" disabled={!!busy || !cogText.trim()} onClick={() => saveCog('braindump')}>Save braindump</button>
            <button className="quiet-button" disabled={!!busy || !cogText.trim()} onClick={() => saveCog('daily-brief')}>Add to daily brief</button>
          </div>
        </div>
      </div>
      <div className="library-stats">
        <div><strong>{brain?.counts.files ?? '—'}</strong><span>source files</span></div>
        <div><strong>{brain?.counts.memories ?? '—'}</strong><span>saved memories</span></div>
        <div><strong>{brain?.counts.archives ?? '—'}</strong><span>conversation archives</span></div>
        <div><strong>Local</strong><span>Obsidian + JARVIS</span></div>
      </div>
      <div className="library-toolbar">
        <div className="segmented">
          <button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>Sources</button>
          <button className={tab === 'memories' ? 'active' : ''} onClick={() => setTab('memories')}>Memories</button>
        </div>
        <label className="library-search"><MagnifyingGlassIcon /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your knowledge" aria-label="Search your knowledge" /></label>
        <button className="quiet-button" disabled={!!busy} onClick={async () => { setBusy('Refreshing index'); try { await request('brain/reindex', 'POST', {}); await refresh(); } catch (e) { onError(String(e)); } finally { setBusy(''); } }}>Refresh</button>
      </div>
      {busy && <div className="panel-notice" role="status">{busy}<div className="loading-line" /></div>}
      {notice && <div className="panel-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><Cross2Icon /></button></div>}
      {draft && (
        <form className="memory-editor" onSubmit={e => { e.preventDefault(); void save(); }}>
          <div className="editor-title"><h3>{draft.id ? 'Edit memory' : 'Save something worth remembering'}</h3><button type="button" onClick={() => setDraft(null)} aria-label="Close memory editor"><Cross2Icon /></button></div>
          <label>Title<input value={draft.title || ''} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="A preference, decision, or useful detail" maxLength={160} /></label>
          <label>Memory<textarea value={draft.content || ''} onChange={e => setDraft({ ...draft, content: e.target.value })} placeholder="Write exactly what you want future conversations to know." required maxLength={12000} /></label>
          <div className="editor-options">
            <label>Type<select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>{['note', 'preference', 'decision', 'fact'].map(c => <option key={c}>{c}</option>)}</select></label>
            <label>Project<select value={draft.project || 'global'} onChange={e => setDraft({ ...draft, project: e.target.value })}><option value="global">Shared across projects</option>{brain?.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="checkbox-label"><input type="checkbox" checked={!!draft.pinned} onChange={e => setDraft({ ...draft, pinned: e.target.checked })} /> Always include in context</label>
          </div>
          <div className="editor-footer"><span>Saved by you. Editable at any time.</span><button className="primary-button" disabled={!!busy || !draft.content?.trim()} type="submit">Save memory <CheckIcon /></button></div>
        </form>
      )}
      {!brain ? <div className="skeleton-block" aria-label="Loading knowledge" /> : tab === 'library' ? (
        <div className="source-table">
          <div className="source-header"><span>Source</span><span>Collection</span><span>Context</span><span /></div>
          {files.slice(0, 150).map(f => (
            <div className="source-row" key={f.id}>
              <button onClick={() => request('brain/documents/' + f.id).then(setPreview).catch(e => onError(String(e)))}>
                <span className="file-icon"><ReaderIcon /></span>
                <span>{f.name}<small>{f.kind === 'conversation' ? 'Conversation archive' : `${Math.ceil((f.bytes || 0) / 1024)} KB`}</small></span>
              </button>
              <span className="source-project">{f.project.replace(/-/g, ' ')}</span>
              <span className="source-index-state">{f.indexed ? 'Searchable' : 'Stored · file only'}</span>
              <a href={'/terminal-api/brain/documents/' + f.id + '/download'} title={'Download ' + f.name}><DownloadIcon /></a>
            </div>
          ))}
          {!files.length && (
            <div className="empty-panel">
              <ReaderIcon />
              <h3>Your next useful reference belongs here.</h3>
              <p>Import notes into the unified vault, or open the same folder in Obsidian. Browse works offline without a provider login.</p>
              <button className="quiet-button" onClick={() => upload.current?.click()}>Import your first source</button>
            </div>
          )}
        </div>
      ) : (
        <div className="memory-grid">
          {memories.map(m => (
            <article className="memory-card" key={m.id}>
              <div className="memory-topline"><span>{m.category}{m.pinned ? ' · pinned' : ''}</span><button title="Edit memory" onClick={() => setDraft(m)}><Pencil1Icon /></button></div>
              <h3>{m.title}</h3>
              <p>{m.content}</p>
              <div className="memory-meta">
                <span>{m.project === 'global' ? 'Shared memory' : m.project}</span>
                <button onClick={async () => { if (!confirm('Forget this saved memory? Conversation transcripts and provider history are kept.')) return; try { await request('brain/memories/' + m.id, 'DELETE'); await refresh(); } catch (e) { onError(String(e)); } }}>Forget</button>
              </div>
              <small>{m.source}</small>
            </article>
          ))}
          {!memories.length && <div className="empty-panel"><h3>Keep the useful details.</h3><p>Save a preference or decision here, or start a chat message with “Remember that…” to save it automatically.</p></div>}
        </div>
      )}
      {preview && (
        <div className="source-preview" role="dialog" aria-modal="true" aria-label={preview.name}>
          <div className="preview-header"><div><span className="eyebrow">SOURCE PREVIEW</span><h3>{preview.name}</h3></div><button onClick={() => setPreview(null)} aria-label="Close source preview"><Cross2Icon /></button></div>
          <p>{preview.path}</p>
          <pre>{preview.text || 'This file is stored, but its contents are not text-indexed. Download the original to open it.'}</pre>
          <a className="quiet-button" href={'/terminal-api/brain/documents/' + preview.id + '/download'}><DownloadIcon />Download original</a>
        </div>
      )}
    </section>
  );
}

export function Skills({ brain, selected, setSelected }: { brain: BrainState | null; selected: string[]; setSelected: (v: string[]) => void }) {
  const [query, setQuery] = useState('');
  const skills = (brain?.skills || []).filter(s => (s.name + ' ' + s.description).toLowerCase().includes(query.toLowerCase()));
  return (
    <section className="brain-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">A LIBRARY OF WAYS TO WORK</span>
          <h2>The right skill. At the right time.</h2>
          <p>{brain?.counts.skills || 0} installed skill packages. Choose up to three for your next conversation.</p>
        </div>
        <span className="selection-count">{selected.length} / 3 selected</span>
      </div>
      <label className="library-search skills-search"><MagnifyingGlassIcon /><input aria-label="Search skills" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search design, research, writing, engineering…" /></label>
      <div className="skill-list">
        {skills.slice(0, 80).map(s => (
          <button className={`skill-row ${selected.includes(s.id) ? 'chosen' : ''}`} key={s.id} disabled={selected.length >= 3 && !selected.includes(s.id)} onClick={() => setSelected(selected.includes(s.id) ? selected.filter(id => id !== s.id) : [...selected, s.id])}>
            <span className="skill-check">{selected.includes(s.id) ? <CheckIcon /> : <PlusIcon />}</span>
            <span><strong>{s.name.replace(/-/g, ' ')}</strong><small>{s.description}</small></span>
            <span className="skill-type">{s.plugin ? 'Plugin tools required' : 'Local skill'}</span>
          </button>
        ))}
      </div>
      {skills.length > 80 && <p className="muted-text">Showing 80 results. Search to narrow the library.</p>}
    </section>
  );
}

export function AppearancePanel({ value, onChange, onCursor }: { value: Appearance; onChange: (v: Appearance) => void; onCursor: () => void }) {
  const themes = [
    { id: 'dark' as const, name: 'Midnight', desc: 'Quiet black. Crisp contrast.', icon: MoonIcon },
    { id: 'light' as const, name: 'Paper', desc: 'Bright surfaces. Room to think.', icon: SunIcon },
    { id: 'system' as const, name: 'Follow system', desc: 'Moves with your Mac.', icon: DesktopIcon },
  ];
  return (
    <section className="brain-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h2>A workspace that feels like you.</h2>
          <p>Midnight and Paper bases. Accents when you want them — never purple cyberpunk noise.</p>
        </div>
      </div>
      <h3 className="setting-label">Appearance</h3>
      <div className="theme-options">
        {themes.map(t => (
          <button className={`theme-option ${value.theme === t.id ? 'selected' : ''}`} key={t.id} onClick={() => onChange({ ...value, theme: t.id })}>
            <div className={`theme-preview preview-${t.id}`}><div /><div><span /><span /><span /></div></div>
            <div className="theme-caption"><t.icon /><strong>{t.name}</strong>{value.theme === t.id && <CheckIcon />}</div>
            <p>{t.desc}</p>
          </button>
        ))}
      </div>
      <h3 className="setting-label">Accent palette</h3>
      <div className="palette-options">
        {PALETTES.map(p => (
          <button className={value.palette === p.id ? 'selected' : ''} key={p.id} onClick={() => onChange({ ...value, palette: p.id })}>
            <span style={{ background: p.color }} />{p.name}{value.palette === p.id && <CheckIcon />}
          </button>
        ))}
      </div>
      <div className="cursor-setup">
        <div className="cursor-logo">↗</div>
        <div>
          <span className="eyebrow">YOUR WORKSPACE, YOUR EDITOR</span>
          <h3>Keep building in Cursor.</h3>
          <p>Open this project with the same source files, saved memories, skills, and one-click build tasks.</p>
        </div>
        <button className="primary-button" onClick={onCursor}>Open in Cursor <ArrowTopRightIcon /></button>
      </div>
      <div className="settings-footnote">
        <h3>Designed for continuity</h3>
        <p>Appearance is saved in this browser. Project files, memories, and conversations are stored locally. Your subscriptions and local models handle replies; the vault supplies context.</p>
      </div>
    </section>
  );
}

export function VoicePanel() {
  const [voiceIn, setVoiceIn] = useState(() => localStorage.getItem('jarvis.voiceIn') !== 'off');
  const [voiceOut, setVoiceOut] = useState(() => localStorage.getItem('jarvis.voiceOut') !== 'off');
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem('jarvis.autoSpeak') === 'on');
  const [autoSend, setAutoSend] = useState(() => localStorage.getItem('jarvis.autoSend') === 'on');
  const [wake, setWake] = useState(() => localStorage.getItem('jarvis.wakeWord') !== 'off');
  const [ttsVoice, setTtsVoice] = useState(() => localStorage.getItem('jarvis.ttsVoice') || '');
  const [previewing, setPreviewing] = useState(false);
  const [speechHealth, setSpeechHealth] = useState<{
    available?: boolean;
    whisper?: { available?: boolean; model?: string };
    freeflow?: { installed?: boolean; path?: string | null; hint?: string; dmg?: string; preferred?: boolean };
    sttPrefer?: string[];
    tts?: { engine?: string; voices?: { name: string; lang: string; rank: number }[]; defaultVoice?: string };
  } | null>(null);
  const [ffBusy, setFfBusy] = useState(false);
  useEffect(() => { localStorage.setItem('jarvis.voiceIn', voiceIn ? 'on' : 'off'); }, [voiceIn]);
  useEffect(() => { localStorage.setItem('jarvis.voiceOut', voiceOut ? 'on' : 'off'); }, [voiceOut]);
  useEffect(() => { localStorage.setItem('jarvis.autoSpeak', autoSpeak ? 'on' : 'off'); }, [autoSpeak]);
  useEffect(() => { localStorage.setItem('jarvis.autoSend', autoSend ? 'on' : 'off'); }, [autoSend]);
  useEffect(() => { localStorage.setItem('jarvis.wakeWord', wake ? 'on' : 'off'); }, [wake]);
  useEffect(() => { if (ttsVoice) localStorage.setItem('jarvis.ttsVoice', ttsVoice); }, [ttsVoice]);
  useEffect(() => {
    fetch('/terminal-api/speech/health').then(r => r.json()).then((h) => {
      setSpeechHealth(h);
      if (!localStorage.getItem('jarvis.ttsVoice') && h?.tts?.defaultVoice) setTtsVoice(h.tts.defaultVoice);
    }).catch(() => setSpeechHealth(null));
  }, []);
  const webSpeech = typeof window !== 'undefined' && !!(window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
  const voices = (speechHealth?.tts?.voices || []).filter(v => v.rank >= 40);
  const freeflow = speechHealth?.freeflow;
  async function preview() {
    setPreviewing(true);
    try {
      await fetch('/terminal-api/speech/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Hello. I am JARVIS, ready when you are.', voice: ttsVoice || speechHealth?.tts?.defaultVoice }) });
    } finally { setPreviewing(false); }
  }
  async function openFreeflow() {
    setFfBusy(true);
    try {
      const r = await fetch('/terminal-api/speech/freeflow/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const b = await r.json();
      if (!r.ok) throw Error(b.error || 'FreeFlow open failed');
      await fetch('/terminal-api/speech/health').then(x => x.json()).then(setSpeechHealth).catch(() => null);
    } catch (e) {
      console.error(e);
    } finally { setFfBusy(false); }
  }
  return (
    <section className="brain-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">TALK TO JARVIS</span>
          <h2>Mic in. Speak out.</h2>
          <p>Preferred STT: FreeFlow (free Mac dictation). TTS: macOS say. In-app Whisper / wake word as fallback. Chat stays on Cursor / Gemini / ChatGPT.</p>
        </div>
      </div>
      <div className="voice-grid">
        <div className={`voice-toggle freeflow-card ${freeflow?.installed ? 'ready' : ''}`}>
          <span>
            <strong>FreeFlow · preferred dictation</strong>
            <small>{freeflow?.hint || 'OSS Wispr-style dictation for Mac. Pastes into the focused JARVIS composer.'}</small>
          </span>
          <button type="button" className="quiet-button" onClick={() => void openFreeflow()} disabled={ffBusy}>
            {ffBusy ? 'Working…' : freeflow?.installed ? 'Open FreeFlow' : 'Install FreeFlow.dmg'}
          </button>
        </div>
        <label className="voice-toggle"><input type="checkbox" checked={voiceIn} onChange={e => setVoiceIn(e.target.checked)} /><span><strong>In-app mic fallback</strong><small>{speechHealth?.whisper?.available ? `Whisper · ${speechHealth.whisper.model || 'ggml-tiny'}` : webSpeech ? 'Web Speech fallback' : 'Use FreeFlow or Mac Dictation'} · order {(speechHealth?.sttPrefer || []).join(' → ') || 'whisper → webspeech'}</small></span></label>
        <label className="voice-toggle"><input type="checkbox" checked={wake} onChange={e => setWake(e.target.checked)} /><span><strong>Wake word · “hey jarvis”</strong><small>{webSpeech ? 'Stricter match · cooldown · pauses while speaking' : 'Needs Web Speech in this browser'}</small></span></label>
        <label className="voice-toggle"><input type="checkbox" checked={voiceOut} onChange={e => setVoiceOut(e.target.checked)} /><span><strong>Speak button on replies</strong><small>{speechHealth?.tts?.engine === 'macos-say' ? 'macOS say · natural system voices' : 'System TTS'}</small></span></label>
        <label className="voice-toggle"><input type="checkbox" checked={autoSpeak} onChange={e => setAutoSpeak(e.target.checked)} /><span><strong>Auto-speak finished replies</strong><small>Uses your selected Mac voice</small></span></label>
        <label className="voice-toggle"><input type="checkbox" checked={autoSend} onChange={e => setAutoSend(e.target.checked)} /><span><strong>Auto-send after wake dictate</strong><small>Default off — fills composer first</small></span></label>
        <label className="voice-toggle voice-select">
          <span><strong>Speak voice</strong><small>Best free English voices from macOS say</small></span>
          <select aria-label="TTS voice" value={ttsVoice} onChange={e => setTtsVoice(e.target.value)}>
            {(voices.length ? voices : [{ name: speechHealth?.tts?.defaultVoice || 'Samantha', lang: 'en_US', rank: 100 }]).map(v => (
              <option key={v.name} value={v.name}>{v.name}{v.rank >= 90 ? ' · recommended' : ''}</option>
            ))}
          </select>
          <button type="button" className="quiet-button" onClick={() => void preview()} disabled={previewing}>{previewing ? 'Speaking…' : 'Preview'}</button>
        </label>
      </div>
      <div className="settings-footnote">
        <h3>Flow</h3>
        <p><strong>Best path:</strong> Open FreeFlow → focus JARVIS composer → hold Fn → talk → text lands in the box. <strong>Fallback:</strong> in-app Mic / hey jarvis → Whisper. <strong>Speak out:</strong> macOS say. No paid voice APIs required; Groq in FreeFlow is optional free tier, or point FreeFlow at local STT.</p>
      </div>
    </section>
  );
}
