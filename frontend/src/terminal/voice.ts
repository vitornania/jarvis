export type VoicePhase = 'idle' | 'wake' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

export interface MacVoice {
  name: string;
  lang: string;
  note?: string;
  rank: number;
}

const PREFERRED = [
  'Samantha (English (US))',
  'Samantha',
  'Flo (English (US))',
  'Eddy (English (US))',
  'Allison',
  'Ava',
  'Zoe',
  'Evan',
  'Nathan',
  'Tom',
  'Alex',
  'Daniel',
  'Karen',
  'Moira',
  'Fiona',
];

export function rankVoice(name: string, lang: string): number {
  const i = PREFERRED.findIndex(p => name === p || name.startsWith(p.split(' (')[0]));
  if (i >= 0) return 100 - i;
  if (/^en[_-]/i.test(lang) || /\bEnglish\b/i.test(name)) return 40;
  return 0;
}

export function pickDefaultVoice(voices: MacVoice[]): string {
  const sorted = [...voices].sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name));
  const best = sorted.find(v => v.rank >= 40) || sorted[0];
  return best?.name || 'Samantha';
}

export function getStoredVoice(): string {
  try { return localStorage.getItem('jarvis.ttsVoice') || ''; } catch { return ''; }
}

export function setStoredVoice(name: string) {
  try { localStorage.setItem('jarvis.ttsVoice', name); } catch { /* ignore */ }
}

/** Prefer Mac `say` via local dashboard; fall back to Web Speech with best English voice. */
export async function speakText(text: string, opts?: { voice?: string; onStart?: () => void; onEnd?: () => void }) {
  const clean = text.replace(/[#*_`>\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
  if (!clean) return;
  const voice = opts?.voice || getStoredVoice();
  opts?.onStart?.();
  try {
    const r = await fetch('/terminal-api/speech/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean, voice: voice || undefined }),
    });
    if (r.ok) {
      opts?.onEnd?.();
      return;
    }
  } catch { /* fall through */ }
  if (!window.speechSynthesis) { opts?.onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.rate = 1.02;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.name === voice)
    || voices.find(v => /Samantha|Ava|Allison|Zoe|Google US English|Microsoft Aria/i.test(v.name) && /en/i.test(v.lang))
    || voices.find(v => /en(-|_)?US/i.test(v.lang))
    || voices.find(v => /^en/i.test(v.lang));
  if (preferred) u.voice = preferred;
  u.onend = () => opts?.onEnd?.();
  u.onerror = () => opts?.onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  try { void fetch('/terminal-api/speech/stop', { method: 'POST' }); } catch { /* ignore */ }
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}

/** Stricter wake match: hey/ok + jarvis with light fuzzy tolerance, ignore short noise. */
export function matchesWakeWord(raw: string): boolean {
  const norm = raw.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (norm.length < 8) return false;
  if (/\b(hey|ok|okay|hi)\s+(jarvis|jarviss|jarves|jarvus)\b/.test(norm)) return true;
  if (/\bheyjarvis\b|\bokjarvis\b/.test(norm.replace(/\s/g, ''))) return true;
  return false;
}

export function phaseLabel(phase: VoicePhase): string {
  switch (phase) {
    case 'wake': return 'Wake armed';
    case 'listening': return 'Listening…';
    case 'transcribing': return 'Transcribing…';
    case 'thinking': return 'Thinking…';
    case 'speaking': return 'Speaking…';
    default: return 'Idle';
  }
}
