import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { PlusIcon, ArrowUpIcon, ArrowTopRightIcon, Cross2Icon, MagnifyingGlassIcon, MixerHorizontalIcon, ChatBubbleIcon, DashboardIcon, LightningBoltIcon, CodeIcon, ReaderIcon, CheckCircledIcon, StopIcon, CopyIcon, DownloadIcon, HamburgerMenuIcon, ChevronRightIcon, SpeakerLoudIcon } from '@radix-ui/react-icons';

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M5 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0V3z" />
      <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5z" />
    </svg>
  );
}
import '@fontsource-variable/geist';
import './terminal.css';
import { Knowledge, Skills, AppearancePanel, VoicePanel, PALETTES, type BrainState, type Appearance, type PaletteId } from './BrainPanels';
import { Hero3D, RailGlyph } from './Hero3D';
import { speakText, stopSpeaking, matchesWakeWord, phaseLabel, type VoicePhase } from './voice';
import './redesign.css';

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
const roleIcons = { chat: ChatBubbleIcon, research: MagnifyingGlassIcon, build: CodeIcon, review: ReaderIcon, god: LightningBoltIcon };
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
      const a = JSON.parse(localStorage.getItem('terminal.appearance') || 'null');
      if (a && ['dark', 'light', 'system'].includes(a.theme) && paletteIds.includes(a.palette)) return a;
    } catch { /* ignore */ }
    return { theme: 'dark', palette: 'copper' };
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

  useEffect(() => {
    const wakeOn = localStorage.getItem('jarvis.wakeWord') !== 'off';
    if (!wakeOn) return;
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
          setNotice('Wake heard — listening for your request.');
          void speakText('Yes?', {
            onStart: () => setVoicePhase('speaking'),
            onEnd: () => { setVoicePhase('listening'); wakeBusy.current = false; },
          });
        };
        rec.onerror = () => { /* no-speech / aborted — soft retry */ };
        rec.onend = () => {
          if (stopped) return;
          restartTimer = setTimeout(start, voicePhase === 'idle' || voicePhase === 'wake' ? 500 : 1200);
        };
        rec.start();
        if (voicePhase === 'idle') setVoicePhase('wake');
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
    { id: 'workspace', icon: ChatBubbleIcon, name: 'Workspace' },
    { id: 'agents', icon: DashboardIcon, name: 'Agent desk' },
    { id: 'knowledge', icon: ReaderIcon, name: 'Knowledge' },
    { id: 'skills', icon: LightningBoltIcon, name: 'Skills' },
    { id: 'appearance', icon: DashboardIcon, name: 'Appearance' },
    { id: 'connections', icon: MixerHorizontalIcon, name: 'Connections' },
    { id: 'voice', icon: MicIcon, name: 'Voice' },
  ];
  const heading = {
    workspace: ['JARVIS', 'Local workspace. Vault on the side. Cursor first when connected.'],
    agents: ['Agent desk', 'Research, build, review, and God mode on subscription CLIs.'],
    connections: ['Connections', 'Cursor preferred. Gemini and ChatGPT next. Ollama is local fallback only.'],
    knowledge: ['Knowledge', 'Beaumont Voss, Talvori, personal, and Zeta in one vault.'],
    skills: ['Skills', 'Ecommerce packs and COG tools. Load only what you need.'],
    appearance: ['Appearance', 'Midnight or Paper. One accent. Quiet chrome.'],
    voice: ['Voice', 'FreeFlow preferred. macOS say for speech. Whisper as fallback.'],
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
          <div className="workspace-label"><span className="workspace-avatar">VN</span><span>Personal workspace<small>Local · on your Mac</small></span><ChevronRightIcon /></div>
        </div>
        <div className="rail-compose">
          <button className="new-session" onClick={() => create()} disabled={creating}><PlusIcon /> New conversation <kbd>⌘ J</kbd></button>
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
              <item.icon />{item.name}{item.id === 'workspace' && <span>{sessions.length.toString().padStart(2, '0')}</span>}
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
          <div className="rail-section"><span>CONVERSATIONS</span><button title="New conversation" onClick={() => create()}><PlusIcon /></button></div>
          <label className="session-search"><MagnifyingGlassIcon /><input id="session-search" placeholder="Find a conversation" aria-label="Find a conversation" value={search} onChange={e => setSearch(e.target.value)} /><kbd>⌘K</kbd></label>
          <div className="session-list">
            {sessions.filter(s => s.title.toLowerCase().includes(search.toLowerCase())).map(s => (
              <button key={s.id} className={active === s.id ? 'active' : ''} onClick={() => { setActive(s.id); setView('workspace'); setMobile(false); }}>
                <span className={`session-dot ${s.status}`} />
                <span>{s.title}<small>{providerNames[s.provider || 'chatgpt']} · {s.status === 'running' ? 'working' : s.messages.length / 2 + ' turns'}</small></span>
              </button>
            ))}
            {!sessions.length && <p className="rail-empty">Your conversations will live here.<br />Start something good.</p>}
          </div>
        </div>
        <div className="rail-footer"><span className={`connection-dot ${online ? 'connected' : ''}`} /><span>Local bridge<small>{online ? 'Connected to your Mac' : 'Reconnecting…'}</small></span><span className={`voice-phase-pill phase-${voicePhase}`}>{phaseLabel(voicePhase)}</span></div>
      </aside>
      {mobile && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobile(false)} />}
      <div className="main-shell">
        <header className="topbar">
          <button className="mobile-toggle" aria-label="Open menu" onClick={() => setMobile(!mobile)}><HamburgerMenuIcon /></button>
          <div className="breadcrumb">JARVIS <span>/</span> <strong>{viewNames[view]}</strong></div>
          <div className="top-status"><span className={`voice-phase-pill phase-${voicePhase}`}>{phaseLabel(voicePhase)}</span><span className={`connection-dot ${connectedCount ? 'connected' : ''}`} />{status ? `${connectedCount} account${connectedCount === 1 ? '' : 's'} connected` : 'Checking connections'}</div>
          <button className="avatar" title="Your personal workspace">VN</button>
        </header>
        <div className="workspace-heading">
          <div>
            <h1>{heading[view]?.[0]}</h1>
            <p>{heading[view]?.[1]}</p>
          </div>
          <button className="quiet-button" onClick={() => setSplit(!split)} disabled={view !== 'workspace'}><DashboardIcon />{split ? 'Single view' : 'Split view'}</button>
        </div>
        {(view === 'workspace' || view === 'agents') && (
          <div className="metrics">
            <Metric label="NEW CHAT PROVIDER" value={providerNames[provider]} detail={selectedConnection?.connected ? 'Ready' : 'Setup from Connections'} live={!!selectedConnection?.connected} />
            <Metric label="RUNNING NOW" value={String(running.length).padStart(2, '0')} detail="Up to 4 simultaneous runs" />
            <Metric label="REPORTED OUTPUT" value={number(totalTokens)} detail="Tokens · latest turn per session" />
            <Metric label="BILLING ROUTE" value="Free / Sub" detail="No paid API-key fallback" />
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
                  <span><ChatBubbleIcon />{current ? current.title : 'New conversation'}</span>
                  <span className="tab-tag">{current ? roleNames[current.role] : 'CHAT'}</span>
                  <button title="New conversation" onClick={() => create()}><PlusIcon /></button>
                </div>
                {current
                  ? <Chat key={current.id} session={current} connected={!!status?.providers?.[current.provider || 'chatgpt']?.connected} onError={setError} wakeToken={wakeHeard} wakeArmed={wakeArmed} onWakeConsumed={() => setWakeArmed(false)} onPhase={setVoicePhase} />
                  : <div className="welcome-wrap"><Welcome onCreate={create} /><button className="start-button" onClick={() => create()} disabled={creating}>Start a conversation <ArrowTopRightIcon /></button></div>}
              </section>
              {split && other ? (
                <section className="chat-panel second-chat">
                  <div className="panel-tabs">
                    <span><ChatBubbleIcon />{other.title}</span>
                    <span className="tab-tag">{roleNames[other.role]} · {providerNames[other.provider || 'chatgpt']}</span>
                    <button className="quiet-button" title="Focus this session" onClick={() => setActive(other.id)}>Focus</button>
                    <button title="Close split view" onClick={() => setSplit(false)}><Cross2Icon /></button>
                  </div>
                  <Chat key={other.id} session={other} connected={!!status?.providers?.[other.provider || 'chatgpt']?.connected} onError={setError} />
                </section>
              ) : (
                <aside className="inspector">
                  <div className="inspector-heading">SESSION MONITOR <span className="live-label"><span className="connection-dot connected" /> LIVE</span></div>
                  <div className="monitor-graphic" aria-hidden="true">{Array.from({ length: 20 }, (_, i) => <span key={i} />)}</div>
                  <h3>{running.length ? `${running.length} session${running.length > 1 ? 's' : ''} at work` : 'Room for your next idea.'}</h3>
                  <p>{running.length ? 'Switch conversations freely. Your other sessions keep working.' : 'Start a conversation, or give a specialist a focused task.'}</p>
                  <div className="activity-list">
                    {sessions.slice(0, 6).map(s => <button key={s.id} onClick={() => { setActive(s.id); if (s.id !== active && sessions.length > 1) setSplit(true); }}><span className={`session-dot ${s.status}`} /><div>{s.title}<small>{providerNames[s.provider || 'chatgpt']} · {s.status === 'running' ? s.activity : roleNames[s.role]}</small></div><ArrowTopRightIcon /></button>)}
                    {!sessions.length && <div className="idle-line"><span className="session-dot" /> No active runs</div>}
                  </div>
                  <div className="inspector-divider" />
                  <div className="eyebrow">MAKE IT YOUR OWN</div>
                  <button className="inspector-action" onClick={() => setView('agents')}><CodeIcon /><span>Open the agent desk<small>Research · build · review · God mode</small></span><ArrowTopRightIcon /></button>
                  <button className="inspector-action" onClick={() => setView('connections')}><MixerHorizontalIcon /><span>Manage connections<small>Cursor · Gemini · ChatGPT</small></span><ArrowTopRightIcon /></button>
                  <button className="inspector-action" onClick={() => setView('knowledge')}><ReaderIcon /><span>Braindump / daily brief<small>COG flows in Knowledge</small></span><ArrowTopRightIcon /></button>
                  <div className="efficiency-note"><LightningBoltIcon /><h4>Second brain, not autopilot.</h4><p>Unlimited saved sessions. You start every run. No autonomous job loops in v1.</p></div>
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
                {(['chat', 'research', 'build', 'review', 'god'] as Role[]).map((role, i) => {
                  const Icon = roleIcons[role];
                  const blurb = {
                    chat: 'A clear head for everyday questions, ideas, and decisions.',
                    research: 'Follow a question. Gather evidence. Find the useful answer.',
                    build: 'Turn a specific task into working code in this workspace.',
                    review: 'A second pair of eyes for your plans, writing, and code.',
                    god: 'Fast AF · browser control · high effort on Cursor / Gemini / ChatGPT subs — never Ollama by default.',
                  }[role];
                  return (
                    <button key={role} className={`agent-card${role === 'god' ? ' agent-card-god' : ''}`} onClick={() => void create(role)} disabled={creating}>
                      <span className="agent-index">{role === 'god' ? 'GM' : `0${i + 1}`}</span>
                      <Icon />
                      <h3>{roleNames[role]}</h3>
                      <p>{blurb}</p>
                      <span className="agent-start">{role === 'god' ? 'Unlock God mode' : 'Start session'} <ArrowTopRightIcon /></span>
                    </button>
                  );
                })}
              </div>
              <div className="run-table">
                <h3>All sessions</h3>
                {sessions.map(s => (
                  <div key={s.id}>
                    <span className={`session-dot ${s.status}`} />
                    <button onClick={() => { setActive(s.id); setView('workspace'); }}>{s.title}</button>
                    <span>{roleNames[s.role]}</span>
                    <span>{s.status}</span>
                    {s.status === 'running'
                      ? <button onClick={() => api(`sessions/${s.id}/stop`, 'POST').catch(e => setError(String(e)))}>Stop</button>
                      : <button aria-label={`Delete ${s.title}`} onClick={() => { if (confirm('Delete this saved conversation?')) api(`sessions/${s.id}`, 'DELETE').then(() => { if (active === s.id) setActive(''); }).catch(e => setError(String(e))); }}><Cross2Icon /></button>}
                  </div>
                ))}
                {!sessions.length && <p>No sessions yet. Choose a specialist above to begin.</p>}
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
                      <span className={connection?.connected ? 'connection-pill' : 'neutral-pill'}>{connection?.connected ? (isFallback ? 'FALLBACK READY' : 'CONNECTED') : 'SETUP NEEDED'}</span>
                      {connection?.connected
                        ? <button className="quiet-button" onClick={() => { setProvider(id); setNotice(isFallback ? 'Ollama selected as temporary local fallback.' : `${providerNames[id]} selected for new conversations.`); }}>Use for new chats</button>
                        : <button className="quiet-button" onClick={() => login(id)}>{isFallback ? 'Start local' : 'Connect'} <ArrowTopRightIcon /></button>}
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
          <span><span className={`connection-dot ${online ? 'connected' : ''}`} /> {online ? 'LOCAL BRIDGE ONLINE' : 'RECONNECTING'}</span>
          <span>JARVIS <i>/</i> UNIFIED VAULT</span>
          <span>⌘ J new chat <i>·</i> ⌘ K search</span>
        </footer>
      </div>
    </div>
  );
}

function Metric({ label, value, detail, live = false }: { label: string; value: string; detail: string; live?: boolean }) {
  return <div className="metric"><span>{label}</span><strong>{live && <span className="metric-dot" />}{value}</strong><small>{detail}</small></div>;
}

function Welcome({ onCreate }: { onCreate?: (r: Role) => void }) {
  return (
    <div className="welcome welcome-taste">
      <Hero3D />
      <div className="eyebrow">PERSONAL AI WORKSPACE · CLASSIC B/W</div>
      <h2>What's on your mind?</h2>
      <p>Work things out, chase an idea, or make something worth keeping — with your vault beside you.</p>
      {onCreate && (
        <div className="suggestions">
          <button onClick={() => onCreate('chat')}><ChatBubbleIcon />Think something through<ArrowTopRightIcon /></button>
          <button onClick={() => onCreate('build')}><CodeIcon />Build something useful<ArrowTopRightIcon /></button>
          <button onClick={() => onCreate('research')}><MagnifyingGlassIcon />Explore a question<ArrowTopRightIcon /></button>
          <button className="god-suggestion" onClick={() => onCreate('god')}><LightningBoltIcon />God mode — fast + browser<ArrowTopRightIcon /></button>
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
  const voiceOut = localStorage.getItem('jarvis.voiceOut') !== 'off';
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
        <button title="Export conversation" onClick={download} disabled={!s.messages.length}><DownloadIcon /></button>
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
                {m.role === 'assistant' && m.content && voiceOut && (
                  <button title="Speak message" aria-label="Speak message" onClick={() => void speakText(m.content, { onStart: () => onPhase?.('speaking'), onEnd: () => onPhase?.('idle') })}><SpeakerLoudIcon /></button>
                )}
                {m.content && (
                  <button title="Copy message" onClick={() => navigator.clipboard.writeText(m.content).then(() => { setCopied(m.id); setTimeout(() => setCopied(''), 1500); }).catch(() => onError('Clipboard is unavailable. Select and copy the text.'))}>
                    {copied === m.id ? <CheckCircledIcon /> : <CopyIcon />}
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
        <div className="composer">
          <label htmlFor={`prompt-${s.id}`} className="sr-only">Message {s.title}</label>
          <textarea ref={textareaRef} id={`prompt-${s.id}`} placeholder="Ask, explore, make something…" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
          <div className="composer-bottom">
            <span><span className="prompt-mark">&gt;_</span> {roleNames[s.role]} <span className="composer-mode">{s.role === 'god' ? 'Browser · high effort · sub CLIs' : s.role === 'build' ? 'Workspace edits' : 'Read-only tools'}{s.browserControl ? ' · browser on' : ''}</span></span>
            <div className="composer-actions">
              {voiceIn && (
                <button className={`mic-button ${listening ? 'recording' : ''}`} aria-label={listening ? 'Stop listening' : 'Dictate with microphone'} title={listening ? `Stop · ${micMode}` : 'Mic · Whisper preferred, Web Speech fallback'} onClick={() => { void toggleMic(); }} disabled={running || sending}>
                  <MicIcon />
                </button>
              )}
              {running
                ? <button className="send-button stop" aria-label="Stop response" onClick={() => api(`sessions/${s.id}/stop`, 'POST').catch(e => onError(String(e)))}><StopIcon /></button>
                : <button className="send-button" aria-label="Send message" disabled={!draft.trim() || sending || !connected} onClick={() => void send()}><ArrowUpIcon /></button>}
            </div>
          </div>
        </div>
        <div className="composer-hint">
          <span>{running ? 'Working in the background. You can switch sessions.' : !connected ? `Connect ${providerNames[s.provider || 'chatgpt']} in Connections to send messages.` : listening ? (micMode === 'whisper' ? 'Listening… tap mic to finish & transcribe' : 'Listening…') : 'Enter · FreeFlow Fn dictate · Mic fallback · hey jarvis'}</span>
          <span>{s.elapsedMs ? `${(s.elapsedMs / 1000).toFixed(1)}s` : 'Free / subscription'}</span>
        </div>
      </div>
    </>
  );
}

