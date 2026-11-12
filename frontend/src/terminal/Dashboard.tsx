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
const primaryProviders: Provider[] = ['cursor', 'gemini', 'ollama'];
type ProviderStatus = { id: Provider; name: string; model: string; installed: boolean; connected: boolean; loginCommand: string; kind?: string; priority?: boolean; hint?: string };
type Role = 'chat' | 'research' | 'build' | 'review';
type Session = {
  project?: string; memoryEnabled?: boolean; contextSources?: { id: string; title: string; kind: string }[];
  provider: Provider; id: string; title: string; role: Role; effort: string; status: string;
  messages: { id: string; role: string; content: string }[]; activity: string; error?: string; elapsedMs?: number;
  usage?: { input_tokens: number; cached_input_tokens: number; output_tokens: number };
};
type Status = { providers: Record<string, ProviderStatus>; connected: boolean; provider: string; model: string; openjarvis: boolean; workspace: string; vaultPath?: string; brand?: string };

const roleNames = { chat: 'Conversation', research: 'Research', build: 'Build', review: 'Review' };
const roleIcons = { chat: ChatBubbleIcon, research: MagnifyingGlassIcon, build: CodeIcon, review: ReaderIcon };
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
  const [project, setProject] = useState('global');
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
    const refresh = () => api('status').then(setStatus).catch(() => setStatus(null));
    refresh();
    const t = setInterval(refresh, 30000);
    return () => { stream.close(); clearInterval(t); };
  }, []);

  useEffect(() => { if (!active && sessions.length) setActive(sessions[0].id); }, [sessions, active]);

  async function create(role: Role = 'chat') {
    if (creating) return;
    setCreating(true);
    try {
      const s = await api('sessions', 'POST', { role, effort, provider, project, memoryEnabled, skillIds: selectedSkills });
      setSessions(p => p.some(x => x.id === s.id) ? p : [s, ...p]);
      setActive(s.id);
      setView('workspace');
      setMobile(false);
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
    workspace: ['A little less friction.', 'Big ideas. Small questions. Everything in between.'],
    agents: ['More minds. One workspace.', 'Independent sessions. Shared visibility. You stay in control.'],
    connections: ['Your accounts, connected.', 'Cursor, Gemini, and Ollama first — free or subscription.'],
    knowledge: ['Your second brain.', 'One vault for Beaumont Voss, Talvori, personal, and Zeta.'],
    skills: ['Built for your way of working.', 'Focused guidance, loaded only when you choose it.'],
    appearance: ['Make space for your best work.', 'Midnight, Paper, and a clean set of accents.'],
    voice: ['Speak when you want.', 'Mic in the composer. Speak on replies. Free paths first.'],
  } as Record<string, [string, string]>;

  const connectionOrder: Provider[] = ['cursor', 'gemini', 'ollama', 'chatgpt'];

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
              <option key={id} value={id}>{providerNames[id]}{status?.providers?.[id]?.connected ? ' · connected' : ' · setup needed'}{primaryProviders.includes(id) ? '' : ''}</option>
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
              <option value="global">All knowledge</option>
              {brain?.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                  ? <Chat key={current.id} session={current} connected={!!status?.providers?.[current.provider || 'chatgpt']?.connected} onError={setError} />
                  : <div className="welcome-wrap"><Welcome onCreate={create} /><button className="start-button" onClick={() => create()} disabled={creating}>Start a conversation <ArrowTopRightIcon /></button></div>}
              </section>
              {split && other ? (
                <section className="chat-panel second-chat">
                  <div className="panel-tabs"><span><ChatBubbleIcon />{other.title}</span><button title="Close split view" onClick={() => setSplit(false)}><Cross2Icon /></button></div>
                  <Chat key={other.id} session={other} connected={!!status?.providers?.[other.provider || 'chatgpt']?.connected} onError={setError} />
                </section>
              ) : (
                <aside className="inspector">
                  <div className="inspector-heading">SESSION MONITOR <span className="live-label"><span className="connection-dot connected" /> LIVE</span></div>
                  <div className="monitor-graphic" aria-hidden="true">{Array.from({ length: 20 }, (_, i) => <span key={i} />)}</div>
                  <h3>{running.length ? `${running.length} session${running.length > 1 ? 's' : ''} at work` : 'Room for your next idea.'}</h3>
                  <p>{running.length ? 'Switch conversations freely. Your other sessions keep working.' : 'Start a conversation, or give a specialist a focused task.'}</p>
                  <div className="activity-list">
                    {running.map(s => <button key={s.id} onClick={() => setActive(s.id)}><span className="session-dot running" /><div>{s.title}<small>{s.activity}</small></div><ArrowTopRightIcon /></button>)}
                    {!running.length && <div className="idle-line"><span className="session-dot" /> No active runs</div>}
                  </div>
                  <div className="inspector-divider" />
                  <div className="eyebrow">MAKE IT YOUR OWN</div>
                  <button className="inspector-action" onClick={() => setView('agents')}><CodeIcon /><span>Open the agent desk<small>Research, build, or review</small></span><ArrowTopRightIcon /></button>
                  <button className="inspector-action" onClick={() => setView('connections')}><MixerHorizontalIcon /><span>Manage connections<small>Cursor · Gemini · Ollama</small></span><ArrowTopRightIcon /></button>
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
                {(['chat', 'research', 'build', 'review'] as Role[]).map((role, i) => {
                  const Icon = roleIcons[role];
                  return (
                    <button key={role} className="agent-card" onClick={() => create(role)} disabled={creating}>
                      <span className="agent-index">0{i + 1}</span>
                      <Icon />
                      <h3>{roleNames[role]}</h3>
                      <p>{{ chat: 'A clear head for everyday questions, ideas, and decisions.', research: 'Follow a question. Gather evidence. Find the useful answer.', build: 'Turn a specific task into working code in this workspace.', review: 'A second pair of eyes for your plans, writing, and code.' }[role]}</p>
                      <span className="agent-start">Start session <ArrowTopRightIcon /></span>
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
                <p>Primary: Cursor, Gemini, Ollama. ChatGPT remains available. Existing chats keep their original provider.</p>
                <button className="quiet-button" onClick={refreshConnections} disabled={refreshing}>{refreshing ? 'Checking…' : 'Refresh connections'}</button>
              </div>
              {connectionOrder.map(id => {
                const connection = status?.providers?.[id];
                const mark = id === 'chatgpt' ? 'G' : id === 'cursor' ? '↗' : id === 'gemini' ? '◇' : '◎';
                return (
                  <div className={`connection-card ${connection?.connected ? '' : 'muted'}`} key={id}>
                    <span className="provider-mark">{mark}</span>
                    <div>
                      <h2>{providerNames[id]}{primaryProviders.includes(id) ? ' · priority' : ''}</h2>
                      <p>{connection?.connected ? 'Ready for new conversations.' : connection?.hint || (connection?.installed === false ? 'Not installed yet.' : 'Complete setup to connect.')}</p>
                      <small>Model: {connection?.model || 'Loading…'} · {id === 'ollama' ? 'Local · free' : id === 'gemini' ? 'Subscription / free tier' : id === 'cursor' ? 'Cursor subscription' : 'Subscription login'}</small>
                      {!connection?.connected && <code className="login-command">{connection?.loginCommand || 'Checking…'}</code>}
                    </div>
                    <div className="connection-actions">
                      <span className={connection?.connected ? 'connection-pill' : 'neutral-pill'}>{connection?.connected ? 'CONNECTED' : 'SETUP NEEDED'}</span>
                      {connection?.connected
                        ? <button className="quiet-button" onClick={() => { setProvider(id); setNotice(`${providerNames[id]} selected for new conversations.`); }}>Use for new chats</button>
                        : <button className="quiet-button" onClick={() => login(id)}>Connect <ArrowTopRightIcon /></button>}
                    </div>
                  </div>
                );
              })}
              <div className="integration-details">
                <h3>JARVIS foundation</h3>
                <p>Vault: <code>{status?.vaultPath || brain?.vaultPath || '~/Desktop/JARVIS/vault'}</code></p>
                <p>Workspace: <code>{status?.workspace || 'Loading…'}</code></p>
                <h3>How usage stays focused</h3>
                <ul>
                  <li>Unlimited saved sessions — no artificial session cap.</li>
                  <li>Up to four simultaneous runs; you start every one.</li>
                  <li>No autonomous job runner in v1.</li>
                  <li>No paid API-key fallback; free/local and subscription only.</li>
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
      <div className="terminal-symbol">J<span>_</span></div>
      <div className="eyebrow">A FRESH PROMPT. A FRESH PERSPECTIVE.</div>
      <h2>What's on your mind?</h2>
      <p>A place to work things out, chase an idea,<br />or make something worth making.</p>
      {onCreate && (
        <div className="suggestions">
          <button onClick={() => onCreate('chat')}><ChatBubbleIcon />Think something through<ArrowTopRightIcon /></button>
          <button onClick={() => onCreate('build')}><CodeIcon />Build something useful<ArrowTopRightIcon /></button>
          <button onClick={() => onCreate('research')}><MagnifyingGlassIcon />Explore a question<ArrowTopRightIcon /></button>
        </div>
      )}
    </div>
  );
}

function Chat({ session: s, connected, onError }: { session: Session; connected: boolean; onError: (s: string) => void }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState('');
  const [listening, setListening] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
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

  function toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      onError('Web Speech is unavailable here. Use Mac Dictation (press Fn twice) in the composer, or enable Voice settings.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
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
    rec.onerror = () => { setListening(false); onError('Microphone capture failed. Try Mac Dictation (Fn Fn) instead.'); };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  return (
    <>
      <div className="chat-context">
        <span><span className={`connection-dot ${connected ? 'connected' : ''}`} /> {providerNames[s.provider || 'chatgpt']} <span className="muted-text">/ {s.provider === 'cursor' ? 'Auto' : s.provider === 'ollama' ? 'Local' : s.effort === 'low' ? 'Lean' : s.effort === 'medium' ? 'Balanced' : 'Deep'}</span></span>
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
          <textarea id={`prompt-${s.id}`} placeholder="Ask, explore, make something…" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
          <div className="composer-bottom">
            <span><span className="prompt-mark">&gt;_</span> {roleNames[s.role]} <span className="composer-mode">{s.role === 'build' ? 'Workspace edits' : 'Read-only tools'}</span></span>
            <div className="composer-actions">
              {voiceIn && (
                <button className={`mic-button ${listening ? 'recording' : ''}`} aria-label={listening ? 'Stop listening' : 'Dictate with microphone'} title={listening ? 'Stop' : 'Mic · Web Speech or use Mac Dictation (Fn Fn)'} onClick={toggleMic} disabled={running || sending}>
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
          <span>{running ? 'Working in the background. You can switch sessions.' : !connected ? `Connect ${providerNames[s.provider || 'chatgpt']} in Connections to send messages.` : listening ? 'Listening…' : 'Enter to send · Mic or Mac Dictation (Fn Fn)'}</span>
          <span>{s.elapsedMs ? `${(s.elapsedMs / 1000).toFixed(1)}s` : 'Free / subscription'}</span>
        </div>
      </div>
    </>
  );
}

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
