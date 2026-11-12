import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Cross2Icon, HamburgerMenuIcon } from '@radix-ui/react-icons';
import '@fontsource-variable/geist';
import './terminal.css';
import { Knowledge, Skills, AppearancePanel, VoicePanel, PALETTES, type BrainState, type Appearance, type PaletteId } from './BrainPanels';
import { Hero3D, RailGlyph } from './Hero3D';
import { Composer } from './Composer';
import { speakText, stopSpeaking, matchesWakeWord, phaseLabel, type VoicePhase } from './voice';
import './shell.css';

type Provider = 'chatgpt' | 'claude' | 'cursor' | 'gemini' | 'ollama';
const providerNames: Record<Provider, string> = { chatgpt: 'ChatGPT', claude: 'Claude', cursor: 'Cursor', gemini: 'Gemini', ollama: 'Ollama' };
const primaryProviders: Provider[] = ['cursor', 'gemini', 'chatgpt'];
type ProviderStatus = { id: Provider; name: string; model: string; installed: boolean; connected: boolean; loginCommand: string; kind?: string; priority?: boolean; hint?: string; tier?: string };
type Role = 'chat' | 'research' | 'build' | 'review' | 'god';
type Session = {
  project?: string; memoryEnabled?: boolean; contextSources?: { id: string; title: string; kind: string }[];
  provider: Provider; id: string; title: string; role: Role; effort: string; status: string;
  browserControl?: boolean;
  messages: { id: string; role: string; content: string }[]; activity: string; error?: string; elapsedMs?: number;
  usage?: { input_tokens: number; cached_input_tokens: number; output_tokens: number };
};
type Status = { providers: Record<string, ProviderStatus>; connected: boolean; provider: string; model: string; openjarvis: boolean; workspace: string; vaultPath?: string; brand?: string; defaultProvider?: Provider; defaultProject?: string; memoryHealth?: { ok?: boolean; vaultWritable?: boolean; memories?: number }; godMode?: { label?: string } };
type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

const roleNames = { chat: 'Conversation', research: 'Research', build: 'Build', review: 'Review', god: 'God mode' };
const paletteIds = PALETTES.map(p => p.id) as PaletteId[];

async function api(path: string, method = 'GET', data?: unknown) {
  const r = await fetch('/terminal-api/' + path, { method, headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
  const b = await r.json();
  if (!r.ok) throw new Error(b.error || 'Request failed');
  return b;
}
const number = (n: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [active, setActive] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [online, setOnline] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('view');
      if (q && ['workspace','agents','connections','knowledge','skills','appearance','voice'].includes(q)) return q;
    } catch { /* ignore */ }
    return 'workspace';
  });
  const [split, setSplit] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [error, setError] = useState('');
  const [effort, setEffort] = useState('low');
  const [creating, setCreating] = useState(false);
  const [provider, setProvider] = useState<Provider>('cursor');
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [brain, setBrain] = useState<BrainState | null>(null);
  const [project, setProject] = useState('beaumont-voss');
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [appearance, setAppearance] = useState<Appearance>(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const themeQ = q.get('theme');
      const paletteQ = q.get('palette') as PaletteId | null;
      if (themeQ && ['dark', 'light', 'system'].includes(themeQ)) {
        const palette = paletteQ && paletteIds.includes(paletteQ) ? paletteQ : 'ink';
        return { theme: themeQ as Appearance['theme'], palette };
      }
      const a = JSON.parse(localStorage.getItem('terminal.appearance') || 'null');
      if (a && ['dark', 'light', 'system'].includes(a.theme) && paletteIds.includes(a.palette)) return a;
    } catch { /* ignore */ }
    return { theme: 'dark', palette: 'ink' };
  });
  const [systemDark, setSystemDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [wakeHeard, setWakeHeard] = useState(0);
  const [wakeArmed, setWakeArmed] = useState(false);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle');
  const wakeBusy = useRef(false);
  const wakeCooldownUntil = useRef(0);

  async function refreshBrain() { try { setBrain(await api('brain')); } catch (e) { setError(String(e)); } }
  useEffect(() => { void refreshBrain(); }, [view]);
  useEffect(() => {
    const q = window.matchMedia('(prefers-color-scheme: dark)');
    const change = () => setSystemDark(q.matches);
    q.addEventListener('change', change);
    return () => q.removeEventListener('change', change);
  }, []);
  useEffect(() => { try { localStorage.setItem('terminal.appearance', JSON.stringify(appearance)); } catch { /* ignore */ } }, [appearance]);

  const viewNames: Record<string, string> = { workspace: 'Workspace', agents: 'Agent desk', connections: 'Connections', knowledge: 'Knowledge', skills: 'Skills', appearance: 'Appearance', voice: 'Voice' };
  const connectedCount = Object.values(status?.providers || {}).filter(p => p.connected).length;
  const selectedConnection = status?.providers?.[provider];

  async function refreshConnections() {
    setRefreshing(true);
    try { setStatus(await api('status')); } catch (e) { setError(String(e)); }
    finally { setRefreshing(false); }
  }
  async function login(id: Provider) {
    try { const result = await api(`providers/${id}/login`, 'POST', {}); setNotice(result.message); }
    catch (e) { setError(String(e)); }
  }

  const running = sessions.filter(s => s.status === 'running');
  const current = sessions.find(s => s.id === active);
  const other = sessions.find(s => s.id !== active && s.status === 'running') || sessions.find(s => s.id !== active);

  useEffect(() => {
    document.title = 'JARVIS';
    const stream = new EventSource('/terminal-api/events');
    stream.onopen = () => setOnline(true);
    stream.onerror = () => setOnline(false);
    stream.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.type === 'snapshot') setSessions(d.sessions);
      if (d.type === 'session') setSessions(prev => {
        const i = prev.findIndex(s => s.id === d.session.id);
        return i < 0 ? [d.session, ...prev] : prev.map(s => s.id === d.session.id ? d.session : s);
      });
    };
    const refresh = () => api('status').then((s: Status) => {
      setStatus(s);
      if (s.defaultProject) setProject(prev => (prev === 'global' ? s.defaultProject! : prev));
      // Prefer a connected subscription CLI (Gemini when Cursor is down). Never stick on Ollama.
      const connected = primaryProviders.find(id => s.providers?.[id]?.connected);
      if (connected) setProvider(prev => (prev === 'ollama' || !s.providers?.[prev]?.connected ? connected : prev));
      else if (s.defaultProvider && primaryProviders.includes(s.defaultProvider)) setProvider(prev => (prev === 'ollama' ? s.defaultProvider! : prev));
    }).catch(() => setStatus(null));
    refresh();
    const t = setInterval(refresh, 30000);
    return () => { stream.close(); clearInterval(t); };
  }, []);

  // Prefer a non-Ollama session as the visible default when Cursor/Gemini/Chat are available.
  useEffect(() => {
    if (active || !sessions.length) return;
    const preferred = sessions.find(s => s.provider !== 'ollama') || sessions[0];
    setActive(preferred.id);
  }, [sessions, active]);

  // Keep Cursor as the preferred selection. Only leave Ollama automatically.
  // Session create still falls back via resolveNewChatProvider when Cursor is offline.
  useEffect(() => {
    if (!status?.providers) return;
    if (provider === 'ollama') {
      const connected = primaryProviders.find(id => status.providers[id]?.connected);
      setProvider(connected || 'cursor');
    }
  }, [status, provider]);

  function resolveNewChatProvider(): Provider {
    if (provider !== 'ollama' && status?.providers?.[provider]?.connected) return provider;
    const connected = primaryProviders.find(id => status?.providers?.[id]?.connected);
    if (connected) return connected;
    if (provider === 'ollama') return status?.defaultProvider && primaryProviders.includes(status.defaultProvider) ? status.defaultProvider : 'cursor';
    return provider;
  }

  // One-time migrate: wake was previously default-on; force opt-in.
  useEffect(() => {
    try {
      if (localStorage.getItem('jarvis.wakeWord.v2') !== '1') {
        localStorage.setItem('jarvis.wakeWord', 'off');
        localStorage.setItem('jarvis.wakeWord.v2', '1');
      }
    } catch { /* ignore */ }
  }, []);

  // Wake-word listener is opt-in only (Voice settings). Never arm mic on load.
  useEffect(() => {
    const wakeOn = localStorage.getItem('jarvis.wakeWord') === 'on';
    if (!wakeOn) {
      if (voicePhase === 'wake') setVoicePhase('idle');
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    let stopped = false;
    let rec: BrowserSpeechRecognition | null = null;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;
    const start = () => {
      if (stopped || wakeBusy.current) return;
      if (voicePhase === 'listening' || voicePhase === 'transcribing' || voicePhase === 'speaking') return;
      try {
        rec = new SR();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = 'en-US';
        rec.onresult = (event) => {
          if (wakeBusy.current || Date.now() < wakeCooldownUntil.current) return;
          let text = '';
          for (let i = event.resultIndex; i < event.results.length; i++) text += event.results[i][0].transcript;
          if (!matchesWakeWord(text)) return;
          wakeBusy.current = true;
          wakeCooldownUntil.current = Date.now() + 3500;
          setVoicePhase('wake');
          setWakeHeard(Date.now());
          setWakeArmed(true);
          setView('workspace');
          setNotice('Wake heard - listening for your request.');
          // Listen-only: no TTS reply on wake.
          setVoicePhase('listening');
          wakeBusy.current = false;
        };
        rec.onerror = () => { /* no-speech / aborted — soft retry */ };
        rec.onend = () => {
          if (stopped) return;
          restartTimer = setTimeout(start, voicePhase === 'idle' || voicePhase === 'wake' ? 500 : 1200);
        };
        rec.start();
        // Stay idle while armed — do not flash "Wake armed" until the phrase is heard.
      } catch { /* mic denied */ }
    };
    start();
    return () => {
      stopped = true;
      if (restartTimer) clearTimeout(restartTimer);
      try { rec?.stop(); } catch { /* ignore */ }
      stopSpeaking();
    };
  }, [voicePhase === 'listening' || voicePhase === 'transcribing' || voicePhase === 'speaking' ? 'busy' : 'idle']);

  async function create(role: Role = 'chat') {
    if (creating) return;
    setCreating(true);
    const nextEffort = role === 'god' ? 'high' : effort;
    if (role === 'god') setEffort('high');
    const nextProvider = resolveNewChatProvider();
    if (nextProvider !== provider) setProvider(nextProvider);
    try {
      const s = await api('sessions', 'POST', { role, effort: nextEffort, provider: nextProvider, project, memoryEnabled, skillIds: selectedSkills, browserControl: role === 'god' });
      setSessions(p => p.some(x => x.id === s.id) ? p : [s, ...p]);
      setActive(s.id);
      setView('workspace');
      setMobile(false);
      if (s.provider !== 'ollama' && primaryProviders.includes(s.provider)) setProvider(s.provider);
      if (s.provider === 'ollama' && role === 'god') setNotice('God mode refused Ollama — check Cursor / Gemini / ChatGPT login.');
      else if (s.provider === 'ollama') setNotice('Session landed on Ollama fallback. Prefer Cursor / Gemini / ChatGPT when connected.');
    } catch (e) { setError(String(e)); }
    finally { setCreating(false); }
  }

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); document.getElementById('session-search')?.focus(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') { e.preventDefault(); void create(); }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  });

  const totalTokens = sessions.reduce((n, s) => n + (s.usage?.output_tokens || 0), 0);
  const nav = [
    { id: 'workspace', name: 'Workspace' },
    { id: 'agents', name: 'Agent desk' },
    { id: 'knowledge', name: 'Knowledge' },
    { id: 'skills', name: 'Skills' },
    { id: 'appearance', name: 'Appearance' },
    { id: 'connections', name: 'Connections' },
    { id: 'voice', name: 'Voice' },
  ];
  const heading = {
    workspace: ['Workspace', 'Think, build, and dig in. Vault beside you. Cursor first when connected.'],
    agents: ['Agent desk', 'Research, build, review, and God mode on subscription CLIs.'],
    connections: ['Connections', 'Cursor preferred. Gemini and ChatGPT next. Ollama is local fallback only.'],
    knowledge: ['Knowledge', 'Beaumont Voss, Talvori, personal, and Zeta in one vault.'],
    skills: ['Skills', 'Ecommerce packs and COG tools. Load only what you need.'],
    appearance: ['Appearance', 'Midnight or Paper. One ink accent. Quiet chrome.'],
    voice: ['Voice', 'Listen only. FreeFlow preferred. Mic as fallback. No speak-out.'],
  } as Record<string, [string, string]>;

  const connectionOrder: Provider[] = ['cursor', 'gemini', 'chatgpt', 'ollama'];

  return (
    <div className="terminal-app" data-theme={appearance.theme === 'system' ? (systemDark ? 'dark' : 'light') : appearance.theme} data-palette={appearance.palette}>
      <aside className={`rail ${mobile ? 'is-open' : ''}`}>
        <div className="rail-brand">
          <a className="brand" href="/" aria-label="JARVIS home">
            <RailGlyph />
            <span className="brand-word">JARVIS<span className="brand-dot">.</span><small>PERSONAL AI WORKSPACE</small></span>
          </a>
          <div className="workspace-label"><span>Personal workspace<small>Local on your Mac</small></span></div>
        </div>
        <div className="rail-compose">
          <button className="new-session" onClick={() => create()} disabled={creating}>New conversation <kbd>⌘J</kbd></button>
          <label className="provider-picker">PROVIDER FOR NEW CHATS
            <select aria-label="Provider for new chats" value={provider} onChange={e => setProvider(e.target.value as Provider)}>
              {connectionOrder.map(id => (
                <option key={id} value={id}>{providerNames[id]}{id === 'ollama' ? ' · local fallback' : primaryProviders.includes(id) ? ' · preferred' : ''}{status?.providers?.[id]?.connected ? ' · connected' : ' · setup needed'}</option>
              ))}
            </select>
          </label>
        </div>
        <nav className="rail-nav" aria-label="Main navigation">
          {nav.map(item => (
            <button className={view === item.id ? 'selected' : ''} key={item.id} onClick={() => { setView(item.id); setMobile(false); }}>
              {item.name}{item.id === 'workspace' && sessions.length > 0 ? <span className="nav-count">{sessions.length}</span> : null}
            </button>
          ))}
        </nav>
        <div className="rail-context project-controls">
          <label className="provider-picker">PROJECT FOR NEW CHATS
            <select aria-label="Project for new chats" value={project} onChange={e => setProject(e.target.value)}>
              <option value="beaumont-voss">Beaumont Voss · primary</option>
              <option value="global">All knowledge</option>
              {brain?.projects.filter(p => p.id !== 'beaumont-voss').map(p => <option key={p.id} value={p.id}>{p.name}{p.id === 'market-research' ? ' (= Beaumont)' : ''}</option>)}
            </select>
          </label>
          <label className="memory-switch"><input type="checkbox" checked={memoryEnabled} onChange={e => setMemoryEnabled(e.target.checked)} />Use saved context<span>{selectedSkills.length ? `${selectedSkills.length} skills` : ''}</span></label>
        </div>
        <div className="rail-sessions">
          <div className="rail-section"><span>Conversations</span></div>
          <label className="session-search"><input id="session-search" placeholder="Find a conversation" aria-label="Find a conversation" value={search} onChange={e => setSearch(e.target.value)} /></label>
          <div className="session-list">
            {sessions.filter(s => s.title.toLowerCase().includes(search.toLowerCase())).map(s => (
              <button key={s.id} className={active === s.id ? 'active' : ''} onClick={() => { setActive(s.id); setView('workspace'); setMobile(false); }}>
                <span>{s.title}<small>{providerNames[s.provider || 'chatgpt']} · {s.status === 'running' ? 'working' : `${Math.floor(s.messages.length / 2)} turns`}</small></span>
              </button>
            ))}
            {!sessions.length && <p className="rail-empty">No conversations yet.</p>}
          </div>
        </div>
        <div className="rail-footer"><span>Bridge {online ? 'online' : 'reconnecting'}{voicePhase !== 'idle' ? ` · ${phaseLabel(voicePhase)}` : ''}</span></div>
      </aside>
      {mobile && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobile(false)} />}
      <div className="main-shell">
        <header className="topbar">
          <button className="mobile-toggle" aria-label="Open menu" onClick={() => setMobile(!mobile)}><HamburgerMenuIcon /></button>
          <div className="breadcrumb">JARVIS <span>/</span> <strong>{viewNames[view]}</strong></div>
          <div className="top-status">
            {status ? `${connectedCount} connected` : 'Checking…'}
            {voicePhase !== 'idle' ? <em>{phaseLabel(voicePhase)}</em> : null}
          </div>
        </header>
        <div className="workspace-heading">
          <div>
            <h1>{heading[view]?.[0]}</h1>
            <p>{heading[view]?.[1]}</p>
          </div>
          {view === 'workspace' && (
            <button type="button" className="quiet-button" onClick={() => setSplit(!split)}>{split ? 'Single' : 'Split'}</button>
          )}
        </div>
        {(view === 'workspace' || view === 'agents') && (
          <div className="status-line" aria-label="Workspace status">
            <span><strong>{providerNames[provider]}</strong>{selectedConnection?.connected ? 'ready' : 'needs setup'}</span>
            <span><strong>{running.length}</strong>running</span>
            <span><strong>{number(totalTokens)}</strong>tokens out</span>
            <span><strong>Free / Sub</strong>no paid API keys</span>
          </div>
        )}
        {notice && <div className="connection-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice"><Cross2Icon /></button></div>}
        {error && <div className="global-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><Cross2Icon /></button></div>}

        {view === 'knowledge' ? <Knowledge brain={brain} refresh={refreshBrain} project={project} onError={setError} />
          : view === 'skills' ? <Skills brain={brain} selected={selectedSkills} setSelected={setSelectedSkills} />
          : view === 'appearance' ? <AppearancePanel value={appearance} onChange={setAppearance} onCursor={() => api('cursor/open', 'POST', {}).then(r => setNotice(r.message)).catch(e => setError(String(e)))} />
          : view === 'voice' ? <VoicePanel />
          : view === 'workspace' ? (
            <div className={`work-grid ${split && other ? 'split-mode' : ''}`}>
              <section className="chat-panel">
                <div className="panel-tabs">
                  <span>{current ? current.title : 'New conversation'}</span>
                  <span className="tab-tag">{current ? roleNames[current.role] : 'Chat'}</span>
                </div>
                {current
                  ? <Chat key={current.id} session={current} connected={!!status?.providers?.[current.provider || 'chatgpt']?.connected} onError={setError} wakeToken={wakeHeard} wakeArmed={wakeArmed} onWakeConsumed={() => setWakeArmed(false)} onPhase={setVoicePhase} />
                  : <div className="welcome-wrap"><Welcome onCreate={create} /><button className="start-button" onClick={() => create()} disabled={creating}>Start a conversation</button></div>}
              </section>
              {split && other ? (
                <section className="chat-panel second-chat">
                  <div className="panel-tabs">
                    <span>{other.title}</span>
                    <span className="tab-tag">{roleNames[other.role]} · {providerNames[other.provider || 'chatgpt']}</span>
                    <button className="quiet-button" title="Focus this session" onClick={() => setActive(other.id)}>Focus</button>
                    <button className="quiet-button" title="Close split view" onClick={() => setSplit(false)}>Close</button>
                  </div>
                  <Chat key={other.id} session={other} connected={!!status?.providers?.[other.provider || 'chatgpt']?.connected} onError={setError} />
                </section>
              ) : (
                <aside className="inspector">
                  <div className="inspector-heading">Sessions</div>
                  <h3>{running.length ? `${running.length} running` : 'Idle'}</h3>
                  <p>{running.length ? 'Other chats keep working while you switch.' : 'Start a chat or open the agent desk.'}</p>
                  <div className="activity-list">
                    {sessions.slice(0, 6).map(s => <button key={s.id} onClick={() => { setActive(s.id); if (s.id !== active && sessions.length > 1) setSplit(true); }}><div>{s.title}<small>{providerNames[s.provider || 'chatgpt']} · {s.status === 'running' ? s.activity : roleNames[s.role]}</small></div></button>)}
                    {!sessions.length && <div className="idle-line">No active runs</div>}
                  </div>
                  <div className="inspector-links">
                    <button type="button" onClick={() => setView('agents')}>Agent desk</button>
                    <button type="button" onClick={() => setView('connections')}>Connections</button>
                    <button type="button" onClick={() => setView('knowledge')}>Knowledge</button>
                  </div>
                </aside>
              )}
            </div>
          ) : view === 'agents' ? (
            <div className="desk">
              <div className="desk-heading">
                <h2>Choose a starting point</h2>
                <label>{provider === 'cursor' ? 'Cursor uses Auto; effort applies to other providers' : 'Reasoning for new sessions'}
                  <select value={effort} onChange={e => setEffort(e.target.value)}>
                    <option value="low">Lean · default</option>
                    <option value="medium">Balanced</option>
                    <option value="high">Deep</option>
                  </select>
                </label>
              </div>
              <div className="agent-grid">
                {(['chat', 'research', 'build', 'review', 'god'] as Role[]).map((role) => {
                  const blurb = {
                    chat: 'Everyday questions, ideas, and decisions.',
                    research: 'Follow a question and gather evidence.',
                    build: 'Turn a task into working code here.',
                    review: 'A second pass on plans, writing, or code.',
                    god: 'Fast runs with browser tools on subscription CLIs.',
                  }[role];
                  return (
                    <button key={role} className={`agent-card${role === 'god' ? ' agent-card-god' : ''}`} onClick={() => void create(role)} disabled={creating}>
                      <h3>{roleNames[role]}</h3>
                      <p>{blurb}</p>
                      <span className="agent-start">{role === 'god' ? 'Start God mode' : 'Start'}</span>
                    </button>
                  );
                })}
              </div>
              <div className="run-table">
                <h3>All sessions</h3>
                {sessions.map(s => (
                  <div key={s.id}>
                    <button onClick={() => { setActive(s.id); setView('workspace'); }}>{s.title}</button>
                    <span>{roleNames[s.role]}</span>
                    <span>{s.status}</span>
                    {s.status === 'running'
                      ? <button onClick={() => api(`sessions/${s.id}/stop`, 'POST').catch(e => setError(String(e)))}>Stop</button>
                      : <button aria-label={`Delete ${s.title}`} onClick={() => { if (confirm('Delete this saved conversation?')) api(`sessions/${s.id}`, 'DELETE').then(() => { if (active === s.id) setActive(''); }).catch(e => setError(String(e))); }}>Delete</button>}
                  </div>
                ))}
                {!sessions.length && <p>No sessions yet.</p>}
              </div>
            </div>
          ) : (
            <div className="connections">
              <div className="connection-toolbar">
                <p>Preferred: Cursor, Gemini, ChatGPT (subscription CLIs). Ollama is offline/local fallback only — new chats never default to it.</p>
                <button className="quiet-button" onClick={refreshConnections} disabled={refreshing}>{refreshing ? 'Checking…' : 'Refresh connections'}</button>
              </div>
              {connectionOrder.map(id => {
                const connection = status?.providers?.[id];
                const isFallback = id === 'ollama';
                const mark = id === 'chatgpt' ? 'G' : id === 'cursor' ? '↗' : id === 'gemini' ? '◇' : '◎';
                return (
                  <div className={`connection-card ${connection?.connected ? '' : 'muted'}${isFallback ? ' connection-fallback' : ' connection-preferred'}`} key={id}>
                    <span className="provider-mark">{mark}</span>
                    <div>
                      <h2>{providerNames[id]}{isFallback ? ' · local fallback' : ' · preferred'}</h2>
                      <p>{connection?.connected ? (isFallback ? 'Available offline when subscription CLIs are down.' : 'Ready for new conversations.') : connection?.hint || (connection?.installed === false ? 'Not installed yet.' : 'Complete setup to connect.')}</p>
                      <small>Model: {connection?.model || 'Loading…'} · {isFallback ? 'Local · free · demoted' : id === 'gemini' ? 'agy / Gemini subscription' : id === 'cursor' ? 'agent login · Cursor sub' : 'codex · ChatGPT sub'}</small>
                      {!connection?.connected && <code className="login-command">{connection?.loginCommand || 'Checking…'}</code>}
                    </div>
                    <div className="connection-actions">
                      <span className="connection-status">{connection?.connected ? (isFallback ? 'Fallback ready' : 'Connected') : 'Setup needed'}</span>
                      {connection?.connected
                        ? <button className="quiet-button" onClick={() => { setProvider(id); setNotice(isFallback ? 'Ollama selected as temporary local fallback.' : `${providerNames[id]} selected for new conversations.`); }}>Use for new chats</button>
                        : <button className="quiet-button" onClick={() => login(id)}>{isFallback ? 'Start local' : 'Connect'}</button>}
                    </div>
                  </div>
                );
              })}
              <div className="integration-details">
                <h3>JARVIS foundation</h3>
                <p>Vault: <code>{status?.vaultPath || brain?.vaultPath || '~/Desktop/JARVIS/vault'}</code></p>
                <p>Workspace: <code>{status?.workspace || 'Loading…'}</code></p>
                <p>Default provider: <code>{status?.defaultProvider || 'cursor'}</code> · Default project: <code>{status?.defaultProject || 'beaumont-voss'}</code></p>
                <h3>How usage stays focused</h3>
                <ul>
                  <li>Unlimited saved sessions — no artificial session cap.</li>
                  <li>God mode allows up to {status?.godMode ? '6' : '4'} parallel runs on subscription CLIs.</li>
                  <li>No autonomous job runner in v1.</li>
                  <li>No paid API-key fallback — Cursor / Gemini / ChatGPT subscriptions only; Ollama offline.</li>
                </ul>
              </div>
            </div>
          )}
        <footer className="statusbar">
          <span>{online ? 'Bridge online' : 'Reconnecting'}</span>
          <span>JARVIS</span>
          <span>⌘J new · ⌘K search</span>
        </footer>
      </div>
    </div>
  );
}

function Welcome({ onCreate }: { onCreate?: (r: Role) => void }) {
  return (
    <div className="welcome welcome-scratch">
      <Hero3D />
      <h2>What's on your mind?</h2>
      <p>Think, build, or dig in - vault on the side.</p>
      {onCreate && (
        <div className="suggestions">
          <button type="button" onClick={() => onCreate('chat')}>Think something through</button>
          <button type="button" onClick={() => onCreate('build')}>Build something useful</button>
          <button type="button" onClick={() => onCreate('research')}>Explore a question</button>
          <button type="button" className="god-suggestion" onClick={() => onCreate('god')}>God mode</button>
        </div>
      )}
    </div>
  );
}

function Chat({ session: s, connected, onError, wakeToken = 0, wakeArmed = false, onWakeConsumed, onPhase }: { session: Session; connected: boolean; onError: (s: string) => void; wakeToken?: number; wakeArmed?: boolean; onWakeConsumed?: () => void; onPhase?: (p: VoicePhase) => void }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState('');
  const [listening, setListening] = useState(false);
  const [micMode, setMicMode] = useState<'idle' | 'whisper' | 'webspeech'>('idle');
  const list = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const listenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const micLock = useRef(false);
  const draftRef = useRef('');
  const running = s.status === 'running';
  const voiceIn = localStorage.getItem('jarvis.voiceIn') !== 'off';
  // Listen-only: TTS / speak-out stays off unless explicitly re-enabled later.
  const voiceOut = localStorage.getItem('jarvis.voiceOut') === 'on';
  const autoSpeak = localStorage.getItem('jarvis.autoSpeak') === 'on';
  const autoSend = localStorage.getItem('jarvis.autoSend') === 'on';
  const lastSpoken = useRef('');
  draftRef.current = draft;

  useEffect(() => {
    if (pinned.current && list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [s.messages, s.activity]);

  useEffect(() => {
    if (running) onPhase?.('thinking');
  }, [running]);

  useEffect(() => {
    if (!autoSpeak || !voiceOut || running) return;
    const last = [...s.messages].reverse().find(m => m.role === 'assistant' && m.content);
    if (last && last.content && last.id !== lastSpoken.current) {
      lastSpoken.current = last.id;
      void speakText(last.content, { onStart: () => onPhase?.('speaking'), onEnd: () => onPhase?.('idle') });
    }
  }, [s.messages, running, autoSpeak, voiceOut]);

  async function send(text?: string) {
    const prompt = (text ?? draft).trim();
    if (!prompt || running || sending) return;
    setSending(true);
    pinned.current = true;
    onPhase?.('thinking');
    try { await api(`sessions/${s.id}/message`, 'POST', { prompt }); setDraft(''); }
    catch (e) { onError(String(e)); onPhase?.('idle'); }
    finally { setSending(false); }
  }

  function download() {
    const blob = new Blob([s.messages.filter(m => m.content).map(m => `## ${m.role}\n\n${m.content}`).join('\n\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = s.title.replace(/[^a-z0-9 -]/gi, '') + '.md'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function clearListenTimer() {
    if (listenTimer.current) { clearTimeout(listenTimer.current); listenTimer.current = null; }
  }

  function startWebSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      onError('Web Speech is unavailable here. Use Mac Dictation (press Fn twice) in the composer, or enable Voice settings.');
      onPhase?.('idle');
      micLock.current = false;
      return;
    }
    const rec = new SR();
    recognitionRef.current = rec;
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';
    let finalText = '';
    rec.onresult = (event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal?: boolean }> }) => {
      let chunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        chunk += event.results[i][0].transcript;
        if ((event.results[i] as { isFinal?: boolean }).isFinal) finalText += event.results[i][0].transcript + ' ';
      }
      if (chunk) setDraft(prev => {
        const base = prev.replace(/\s*…$/, '');
        return (base ? base + ' ' : '') + chunk.trim() + (((event.results[event.results.length - 1] as { isFinal?: boolean })?.isFinal) ? '' : ' …');
      });
    };
    rec.onerror = () => {
      setListening(false); setMicMode('idle'); micLock.current = false; onPhase?.('idle');
      onError('Microphone capture failed. Try Mac Dictation (Fn Fn) instead.');
    };
    rec.onend = () => {
      setListening(false); setMicMode('idle'); micLock.current = false;
      const text = (finalText || draftRef.current).replace(/\s*…$/g, '').trim();
      if (text) {
        setDraft(text);
        if (autoSend && connected) void send(text);
        else onPhase?.('idle');
      } else onPhase?.('idle');
    };
    setListening(true);
    setMicMode('webspeech');
    onPhase?.('listening');
    rec.start();
  }

  async function stopWhisper() {
    const recorder = mediaRef.current;
    if (!recorder || recorder.state !== 'recording') { micLock.current = false; return; }
    clearListenTimer();
    onPhase?.('transcribing');
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      try { recorder.stop(); } catch { resolve(); }
    });
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
    chunksRef.current = [];
    mediaRef.current = null;
    setListening(false);
    setMicMode('idle');
    if (blob.size < 1200) {
      micLock.current = false;
      onPhase?.('idle');
      startWebSpeech();
      return;
    }
    try {
      const body = await blob.arrayBuffer();
      const bytes = new Uint8Array(body);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const audioBase64 = btoa(binary);
      const result = await api('speech/transcribe', 'POST', { audioBase64, filename: 'recording.webm' });
      const text = String(result.text || '').trim();
      if (text) {
        setDraft(prev => (prev ? prev + ' ' : '') + text);
        if (autoSend && connected) await send((draftRef.current ? draftRef.current + ' ' : '') + text);
        else onPhase?.('idle');
      } else {
        onPhase?.('idle');
        startWebSpeech();
        return;
      }
    } catch (e) {
      onError(String(e));
      startWebSpeech();
      return;
    } finally {
      micLock.current = false;
    }
  }

  async function toggleMic(forceStart = false) {
    if (micLock.current && forceStart) return;
    if (listening && !forceStart) {
      if (micMode === 'whisper') await stopWhisper();
      else { recognitionRef.current?.stop(); setListening(false); setMicMode('idle'); onPhase?.('idle'); }
      return;
    }
    if (listening && forceStart) return;
    micLock.current = true;
    try {
      const health = await fetch('/terminal-api/speech/health').then(r => r.json()).catch(() => null);
      if (health?.whisper?.available && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        chunksRef.current = [];
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined;
        const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        mediaRef.current = recorder;
        recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
        recorder.start(250);
        setListening(true);
        setMicMode('whisper');
        onPhase?.('listening');
        clearListenTimer();
        // Auto-stop after ~8s so wake→listen→transcribe doesn't stick forever.
        listenTimer.current = setTimeout(() => { void stopWhisper(); }, forceStart ? 8000 : 20000);
        return;
      }
    } catch {
      /* fall through */
    }
    startWebSpeech();
  }

  useEffect(() => () => {
    clearListenTimer();
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    try { mediaRef.current?.state === 'recording' && mediaRef.current.stop(); } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  useEffect(() => {
    if (!wakeToken || !wakeArmed) return;
    textareaRef.current?.focus();
    const t = setTimeout(() => { void toggleMic(true); onWakeConsumed?.(); }, 400);
    return () => clearTimeout(t);
  }, [wakeToken, wakeArmed]);

  return (
    <>
      <div className="chat-context">
        <span><span className={`connection-dot ${connected ? 'connected' : ''}`} /> {providerNames[s.provider || 'chatgpt']} <span className="muted-text">/ {s.provider === 'cursor' ? 'Auto' : s.provider === 'ollama' ? 'Local' : s.provider === 'gemini' ? 'Google' : s.effort === 'low' ? 'Lean' : s.effort === 'medium' ? 'Balanced' : 'Deep'}</span></span>
        <button type="button" className="text-action" title="Export conversation" onClick={download} disabled={!s.messages.length}>Export</button>
      </div>
      {s.contextSources?.length ? (
        <details className="context-sources">
          <summary>{s.contextSources.length} context sources used · {s.project || 'all knowledge'}</summary>
          {s.contextSources.map(source => <span key={source.id}>{source.kind} · {source.title}</span>)}
        </details>
      ) : null}
      <div className="chat-scroll" ref={list} onScroll={() => { const el = list.current; if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
        {!s.messages.length ? <Welcome /> : s.messages.map(m => (
          <article className={`message ${m.role}`} key={m.id}>
            <div className="message-label">
              <span>{m.role === 'user' ? 'YOU' : 'JARVIS'}</span>
              <span className="message-actions">
                {m.content && (
                  <button title="Copy message" onClick={() => navigator.clipboard.writeText(m.content).then(() => { setCopied(m.id); setTimeout(() => setCopied(''), 1500); }).catch(() => onError('Clipboard is unavailable. Select and copy the text.'))}>
                    {copied === m.id ? 'Copied' : 'Copy'}
                  </button>
                )}
              </span>
            </div>
            {m.content ? <div className="message-content"><ReactMarkdown>{m.content}</ReactMarkdown></div>
              : running ? <div className="thinking"><span /><span /><span /><small>{s.activity}</small></div>
                : <p className="muted-text">{s.status === 'stopped' ? 'Response stopped.' : 'No response received.'}</p>}
          </article>
        ))}
        {s.error && <div className="chat-error" role="alert">{s.error}</div>}
      </div>
      <div className="composer-wrap">
        <Composer
          id={`prompt-${s.id}`}
          value={draft}
          onChange={setDraft}
          onSubmit={() => { void send(); }}
          onStop={() => { api(`sessions/${s.id}/stop`, 'POST').catch(e => onError(String(e))); }}
          disabled={sending || !connected}
          running={running}
          textareaRef={textareaRef}
          placeholder="Ask, explore, make something…"
          leftMeta={(
            <span>
              <span className="prompt-mark">&gt;_</span> {roleNames[s.role]}{' '}
              <span className="composer-mode">
                {s.role === 'god' ? 'Browser · high effort · sub CLIs' : s.role === 'build' ? 'Workspace edits' : 'Read-only tools'}
                {s.browserControl ? ' · browser on' : ''}
              </span>
            </span>
          )}
          rightActions={voiceIn ? (
            <button
              type="button"
              className={`mic-button ${listening ? 'recording' : ''}`}
              aria-label={listening ? 'Stop listening' : 'Dictate with microphone'}
              title={listening ? `Stop · ${micMode}` : 'Mic · Whisper preferred, Web Speech fallback'}
              onClick={() => { void toggleMic(); }}
              disabled={running || sending}
            >
              {listening ? 'Stop' : 'Mic'}
            </button>
          ) : null}
        />
        <div className="composer-hint">
          <span>{running ? 'Working in the background.' : !connected ? `Connect ${providerNames[s.provider || 'chatgpt']} to send.` : listening ? 'Listening… tap mic to finish' : 'Enter to send · Fn FreeFlow · Mic for input'}</span>
          <span>{s.elapsedMs ? `${(s.elapsedMs / 1000).toFixed(1)}s` : 'Listen only · Free / subscription'}</span>
        </div>
      </div>
    </>
  );
}

