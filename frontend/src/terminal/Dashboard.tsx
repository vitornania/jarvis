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

function speakText(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[#*_`]/g, ' ').slice(0, 4000));
  u.rate = 1.02;
  window.speechSynthesis.speak(u);
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [active, setActive] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [online, setOnline] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('workspace');
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
    return { theme: 'dark', palette: 'mono' };
  });
  const [systemDark, setSystemDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [wakeHeard, setWakeHeard] = useState(0);
  const [wakeArmed, setWakeArmed] = useState(false);

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
      if (s.defaultProvider && primaryProviders.includes(s.defaultProvider)) setProvider(prev => (prev === 'ollama' ? s.defaultProvider! : prev));
      if (s.defaultProject) setProject(prev => (prev === 'global' ? s.defaultProject! : prev));
    }).catch(() => setStatus(null));
    refresh();
    const t = setInterval(refresh, 30000);
    return () => { stream.close(); clearInterval(t); };
  }, []);

  useEffect(() => { if (!active && sessions.length) setActive(sessions[0].id); }, [sessions, active]);

  // Prefer subscription providers — never leave UI default stuck on Ollama.
  useEffect(() => {
    if (!status?.providers) return;
    if (provider !== 'ollama') return;
    const next = primaryProviders.find(id => status.providers[id]?.connected) || 'cursor';
    setProvider(next);
  }, [status, provider]);

  useEffect(() => {
    const wakeOn = localStorage.getItem('jarvis.wakeWord') !== 'off';
    if (!wakeOn) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    let stopped = false;
    let rec: BrowserSpeechRecognition | null = null;
    const start = () => {
      if (stopped) return;
      try {
        rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';
        rec.onresult = (event) => {
          let text = '';
          for (let i = event.resultIndex; i < event.results.length; i++) text += event.results[i][0].transcript;
          const norm = text.toLowerCase().replace(/[^a-z\s]/g, ' ');
          if (/\bhey\s+jarvis\b|\bok\s+jarvis\b/.test(norm)) {
            setWakeHeard(Date.now());
            setWakeArmed(true);
            setView('workspace');
            setNotice('Listening — hey jarvis heard.');
            speakText('Yes?');
          }
        };
        rec.onerror = () => { /* permission / no-speech — retry softly */ };
        rec.onend = () => { if (!stopped) setTimeout(start, 400); };
        rec.start();
      } catch { /* mic denied */ }
    };
    start();
    return () => { stopped = true; try { rec?.stop(); } catch { /* ignore */ } };
  }, []);

  async function create(role: Role = 'chat') {
    if (creating) return;
    setCreating(true);
    const nextEffort = role === 'god' ? 'high' : effort;
    if (role === 'god') setEffort('high');
    try {
      const s = await api('sessions', 'POST', { role, effort: nextEffort, provider, project, memoryEnabled, skillIds: selectedSkills, browserControl: role === 'god' });
      setSessions(p => p.some(x => x.id === s.id) ? p : [s, ...p]);
      setActive(s.id);
      setView('workspace');
      setMobile(false);
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
    workspace: ['JARVIS.', 'Big ideas. Small questions. Your vault on the side.'],
    agents: ['More minds. One desk.', 'Specialists plus God mode — subscription CLIs, browser when you need it.'],
    connections: ['Accounts, ready.', 'Cursor, Gemini, and ChatGPT preferred. Ollama is local fallback only.'],
    knowledge: ['One brain.', 'Beaumont Voss, Talvori, personal, and Zeta in a single vault.'],
    skills: ['Your craft, on call.', 'Ecommerce packs + COG taste — load only what you need.'],
    appearance: ['Quiet chrome.', 'Midnight, Paper, and restrained accents.'],
    voice: ['Say hey jarvis.', 'Local Whisper first. Web Speech fallback. Speak on replies.'],
  } as Record<string, [string, string]>;

  const connectionOrder: Provider[] = ['cursor', 'gemini', 'chatgpt', 'ollama'];

  return (
    <div className="terminal-app" data-theme={appearance.theme === 'system' ? (systemDark ? 'dark' : 'light') : appearance.theme} data-palette={appearance.palette}>
      <aside className={`rail ${mobile ? 'is-open' : ''}`}>
        <a className="brand" href="/" aria-label="JARVIS home">
          <span className="brand-glyph">J<span>_</span></span>
          <span>JARVIS<span className="brand-dot">.</span><small>PERSONAL AI WORKSPACE</small></span>
        </a>
        <div className="workspace-label"><span className="workspace-avatar">VN</span><span>Personal workspace<small>Local · on your Mac</small></span><ChevronRightIcon /></div>
        <button className="new-session" onClick={() => create()} disabled={creating}><PlusIcon /> New conversation <kbd>⌘ J</kbd></button>
        <label className="provider-picker">PROVIDER FOR NEW CHATS
          <select aria-label="Provider for new chats" value={provider} onChange={e => setProvider(e.target.value as Provider)}>
            {connectionOrder.map(id => (
              <option key={id} value={id}>{providerNames[id]}{id === 'ollama' ? ' · local fallback' : primaryProviders.includes(id) ? ' · preferred' : ''}{status?.providers?.[id]?.connected ? ' · connected' : ' · setup needed'}</option>
            ))}
          </select>
        </label>
        <nav aria-label="Main navigation">
          {nav.map(item => (
            <button className={view === item.id ? 'selected' : ''} key={item.id} onClick={() => { setView(item.id); setMobile(false); }}>
              <item.icon />{item.name}{item.id === 'workspace' && <span>{sessions.length.toString().padStart(2, '0')}</span>}
            </button>
          ))}
        </nav>
        <div className="project-controls">
          <label className="provider-picker">PROJECT FOR NEW CHATS
            <select aria-label="Project for new chats" value={project} onChange={e => setProject(e.target.value)}>
              <option value="beaumont-voss">Beaumont Voss · primary</option>
              <option value="global">All knowledge</option>
              {brain?.projects.filter(p => p.id !== 'beaumont-voss').map(p => <option key={p.id} value={p.id}>{p.name}{p.id === 'market-research' ? ' (= Beaumont)' : ''}</option>)}
            </select>
          </label>
          <label className="memory-switch"><input type="checkbox" checked={memoryEnabled} onChange={e => setMemoryEnabled(e.target.checked)} />Use saved context<span>{selectedSkills.length ? `${selectedSkills.length} skills` : ''}</span></label>
        </div>
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
        <div className="rail-footer"><span className={`connection-dot ${online ? 'connected' : ''}`} /><span>Local bridge<small>{online ? 'Connected to your Mac' : 'Reconnecting…'}</small></span><span className="version">v0.1</span></div>
      </aside>
      {mobile && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobile(false)} />}
      <div className="main-shell">
        <header className="topbar">
          <button className="mobile-toggle" aria-label="Open menu" onClick={() => setMobile(!mobile)}><HamburgerMenuIcon /></button>
          <div className="breadcrumb">JARVIS <span>/</span> <strong>{viewNames[view]}</strong></div>
          <div className="top-status"><span className={`connection-dot ${connectedCount ? 'connected' : ''}`} />{status ? `${connectedCount} account${connectedCount === 1 ? '' : 's'} connected` : 'Checking connections'}</div>
          <button className="avatar" title="Your personal workspace">VN</button>
        </header>
        <div className="workspace-heading">
          <div>
            <div className="eyebrow">YOUR SPACE TO THINK & BUILD</div>
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
                  ? <Chat key={current.id} session={current} connected={!!status?.providers?.[current.provider || 'chatgpt']?.connected} onError={setError} wakeToken={wakeHeard} wakeArmed={wakeArmed} onWakeConsumed={() => setWakeArmed(false)} />
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
    <div className="welcome">
      <div className="terminal-symbol brand-hero">JARVIS<span>_</span></div>
      <div className="eyebrow">PERSONAL AI WORKSPACE</div>
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

function Chat({ session: s, connected, onError, wakeToken = 0, wakeArmed = false, onWakeConsumed }: { session: Session; connected: boolean; onError: (s: string) => void; wakeToken?: number; wakeArmed?: boolean; onWakeConsumed?: () => void }) {
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
  const running = s.status === 'running';
  const voiceIn = localStorage.getItem('jarvis.voiceIn') !== 'off';
  const voiceOut = localStorage.getItem('jarvis.voiceOut') !== 'off';
  const autoSpeak = localStorage.getItem('jarvis.autoSpeak') === 'on';
  const lastSpoken = useRef('');

  useEffect(() => {
    if (pinned.current && list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [s.messages, s.activity]);

  useEffect(() => {
    if (!autoSpeak || !voiceOut || running) return;
    const last = [...s.messages].reverse().find(m => m.role === 'assistant' && m.content);
    if (last && last.content && last.id !== lastSpoken.current) {
      lastSpoken.current = last.id;
      speakText(last.content);
    }
  }, [s.messages, running, autoSpeak, voiceOut]);

  async function send() {
    if (!draft.trim() || running || sending) return;
    const prompt = draft;
    setSending(true);
    pinned.current = true;
    try { await api(`sessions/${s.id}/message`, 'POST', { prompt }); setDraft(''); }
    catch (e) { onError(String(e)); }
    finally { setSending(false); }
  }

  function download() {
    const blob = new Blob([s.messages.filter(m => m.content).map(m => `## ${m.role}\n\n${m.content}`).join('\n\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = s.title.replace(/[^a-z0-9 -]/gi, '') + '.md'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function startWebSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      onError('Web Speech is unavailable here. Use Mac Dictation (press Fn twice) in the composer, or enable Voice settings.');
      return;
    }
    const rec = new SR();
    recognitionRef.current = rec;
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string } }> }) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i++) text += event.results[i][0].transcript;
      if (text) setDraft(prev => (prev ? prev + ' ' : '') + text.trim());
    };
    rec.onerror = () => { setListening(false); setMicMode('idle'); onError('Microphone capture failed. Try Mac Dictation (Fn Fn) instead.'); };
    rec.onend = () => { setListening(false); setMicMode('idle'); };
    setListening(true);
    setMicMode('webspeech');
    rec.start();
  }

  async function stopWhisper() {
    const recorder = mediaRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
    chunksRef.current = [];
    mediaRef.current = null;
    setListening(false);
    setMicMode('idle');
    try {
      const body = await blob.arrayBuffer();
      const bytes = new Uint8Array(body);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const audioBase64 = btoa(binary);
      const result = await api('speech/transcribe', 'POST', { audioBase64, filename: 'recording.webm' });
      if (result.text) setDraft(prev => (prev ? prev + ' ' : '') + String(result.text).trim());
    } catch (e) {
      onError(String(e));
      startWebSpeech();
    }
  }

  async function toggleMic(forceStart = false) {
    if (listening && !forceStart) {
      if (micMode === 'whisper') await stopWhisper();
      else { recognitionRef.current?.stop(); setListening(false); setMicMode('idle'); }
      return;
    }
    if (listening && forceStart) return;
    try {
      const health = await fetch('/terminal-api/speech/health').then(r => r.json()).catch(() => null);
      if (health?.whisper?.available && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        chunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        mediaRef.current = recorder;
        recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
        recorder.start();
        setListening(true);
        setMicMode('whisper');
        return;
      }
    } catch {
      /* fall through to Web Speech */
    }
    startWebSpeech();
  }

  useEffect(() => {
    if (!wakeToken || !wakeArmed) return;
    textareaRef.current?.focus();
    void toggleMic(true);
    onWakeConsumed?.();
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
                  <button title="Speak message" aria-label="Speak message" onClick={() => speakText(m.content)}><SpeakerLoudIcon /></button>
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
                : <button className="send-button" aria-label="Send message" disabled={!draft.trim() || sending || !connected} onClick={send}><ArrowUpIcon /></button>}
            </div>
          </div>
        </div>
        <div className="composer-hint">
          <span>{running ? 'Working in the background. You can switch sessions.' : !connected ? `Connect ${providerNames[s.provider || 'chatgpt']} in Connections to send messages.` : listening ? (micMode === 'whisper' ? 'Recording… tap mic to transcribe with Whisper' : 'Listening…') : 'Enter to send · Mic (Whisper) · say hey jarvis'}</span>
          <span>{s.elapsedMs ? `${(s.elapsedMs / 1000).toFixed(1)}s` : 'Free / subscription'}</span>
        </div>
      </div>
    </>
  );
}

