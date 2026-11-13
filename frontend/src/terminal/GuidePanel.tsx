/** JARVIS Guide — taste-terminal onboarding & connector docs. No ELIXIR. */

export function GuidePanel() {
  return (
    <div className="guide-page brain-page">
      <section className="guide-hero">
        <p className="guide-kicker">$ jarvis — guide</p>
        <h2>How JARVIS works</h2>
        <p>
          JARVIS is your personal AI workspace: a second brain for Beaumont Voss and Talvori ecommerce,
          plus everyday thinking, building, and research — all on subscription CLIs first (Cursor, Gemini, ChatGPT),
          with Ollama only as local fallback.
        </p>
      </section>

      <section className="guide-card">
        <h3>First 5 minutes</h3>
        <ol className="guide-steps">
          <li>Open <strong>Connections</strong> and connect Cursor (preferred). Gemini or ChatGPT next if Cursor is down.</li>
          <li>In the rail, pick a <strong>Workspace</strong> and <strong>Project</strong> (start with Beaumont Voss).</li>
          <li>Hit <strong>New conversation</strong> (⌘J) or open <strong>Agent desk</strong> for Research / Build / God mode.</li>
          <li>Ask something concrete. Toggle <strong>Saved context</strong> so vault knowledge can ride along.</li>
          <li>Optional: open <strong>Voice</strong> — listen-only. Prefer FreeFlow (Fn dictate); mic is backup. No speak-out by default.</li>
        </ol>
      </section>

      <section className="guide-card">
        <h3>What JARVIS is</h3>
        <ul className="guide-list">
          <li><strong>Second brain</strong> — indexed vault + memories beside chat.</li>
          <li><strong>Ecommerce workspace</strong> — Beaumont Voss / Talvori projects, market research imports, skills packs.</li>
          <li><strong>Subscription-first</strong> — Cursor agent CLI → Gemini (agy) → ChatGPT Codex; Ollama offline only.</li>
          <li><strong>Local-first</strong> — runs on your Mac at <code>http://127.0.0.1:4318</code>; no paid API-key path in v1.</li>
        </ul>
      </section>

      <section className="guide-card">
        <h3>Workspace, sessions, projects, knowledge</h3>
        <dl className="guide-dl">
          <div>
            <dt>Workspace chat</dt>
            <dd>Main thread. Composer at the bottom. Split view keeps a second session visible. ⌘K focuses conversation search.</dd>
          </div>
          <div>
            <dt>Sessions</dt>
            <dd>Saved conversations in the rail and Sessions inspector. Stop running jobs from Agent desk. Delete only when idle.</dd>
          </div>
          <div>
            <dt>Projects</dt>
            <dd>Live inside a workspace. New chats inherit the selected project so brain search + memory stay scoped (e.g. <code>beaumont-voss</code>).</dd>
          </div>
          <div>
            <dt>Knowledge / vault</dt>
            <dd>
              Knowledge tab = library, memories, search. Source of truth is the Obsidian vault under
              <code>~/Desktop/JARVIS/vault</code> (projects in <code>01-projects/</code>, knowledge in <code>05-knowledge/</code>).
            </dd>
          </div>
          <div>
            <dt>Skills</dt>
            <dd>Load only the packs you need for a run (ecommerce / COG). Selected skills attach to new sessions.</dd>
          </div>
        </dl>
      </section>

      <section className="guide-card">
        <h3>Connect every tool</h3>
        <dl className="guide-dl">
          <div>
            <dt>Cursor agent CLI</dt>
            <dd>Install Cursor · run <code>agent login</code> (or Connections → Connect). Preferred for new chats and God mode.</dd>
          </div>
          <div>
            <dt>Gemini (agy)</dt>
            <dd>Install Antigravity / agy CLI · authenticate with Google. Used automatically when Cursor is disconnected.</dd>
          </div>
          <div>
            <dt>ChatGPT Codex</dt>
            <dd>Codex / ChatGPT subscription CLI · complete login from Connections. Third preferred subscription path.</dd>
          </div>
          <div>
            <dt>Ollama</dt>
            <dd>Local models only. Never the sticky default — demoted fallback when subscription CLIs are down.</dd>
          </div>
          <div>
            <dt>Obsidian vault</dt>
            <dd>Point Obsidian at <code>~/Desktop/JARVIS/vault</code>. JARVIS indexes the same tree; edit notes either place.</dd>
          </div>
          <div>
            <dt>FreeFlow / Voice</dt>
            <dd>Listen-only. FreeFlow (hold Fn) into the composer is preferred. Mic uses Whisper when available, else Web Speech. TTS speak-out stays off unless you enable it.</dd>
          </div>
          <div>
            <dt>Playwright / browser (God mode)</dt>
            <dd>God mode starts a high-effort session with browser tools on subscription CLIs (Playwright MCP / Auto Browser when installed under <code>~/Desktop/JARVIS/skills/github/</code>).</dd>
          </div>
          <div>
            <dt>Skills pack</dt>
            <dd>Skills tab + COG second-brain packs under <code>~/Desktop/JARVIS/skills/</code>. Select before starting a chat.</dd>
          </div>
          <div>
            <dt>Vault folders</dt>
            <dd>
              Useful paths: <code>00-workspaces/</code>, <code>01-projects/</code>, <code>05-knowledge/</code>, imports under
              <code>vault/imports/</code>. Dashboard brain reindexes after imports.
            </dd>
          </div>
        </dl>
      </section>

      <section className="guide-card">
        <h3>Where files live</h3>
        <ul className="guide-list">
          <li><code>~/Desktop/JARVIS/app</code> — dashboard server (<code>dashboard/server.mjs</code>) + frontend</li>
          <li><code>~/Desktop/JARVIS/vault</code> — Obsidian second brain</li>
          <li><code>~/Desktop/JARVIS/skills</code> — skill packs / github tools</li>
          <li><code>~/Desktop/JARVIS/app/frontend/public/taste</code> — UI image assets</li>
          <li>UI: <code>http://127.0.0.1:4318</code> · start via <code>dashboard/start.command</code> or <code>node dashboard/server.mjs</code></li>
        </ul>
      </section>

      <section className="guide-card">
        <h3>Shortcuts</h3>
        <ul className="guide-list">
          <li><kbd>⌘J</kbd> — new conversation</li>
          <li><kbd>⌘K</kbd> — find conversation</li>
          <li>Enter — send · Shift+Enter — newline</li>
        </ul>
      </section>
    </div>
  );
}
