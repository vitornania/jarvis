import { useEffect, useState } from 'react';

export type ElixirMcpStatus = {
  enabled?: boolean;
  endpoint?: string | null;
  serverName?: string;
  label?: string;
  docs?: string[];
  notes?: string;
  cursorConfigured?: boolean;
  reachable?: boolean;
  httpStatus?: number | null;
  state?: string;
  tools?: { name: string; description?: string }[];
  resources?: { uri: string; name?: string }[];
};

const stateLabel: Record<string, string> = {
  disabled: 'Disabled in jarvis.config.json',
  offline: 'Endpoint unreachable',
  endpoint_up_attach_mcp: 'Endpoint up - attach MCP in Cursor',
  ready_to_connect: 'MCP entry found - connect in Cursor',
};

export function ElixirEcomPanel({
  elixir,
  onRefresh,
  refreshing,
}: {
  elixir?: ElixirMcpStatus | null;
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  const [local, setLocal] = useState<ElixirMcpStatus | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const data = elixir || local;
  const loading = !data;
  const state = data?.state || (loading ? 'checking' : 'offline');
  const tools = data?.tools || [];
  const resources = data?.resources || [];
  const busy = !!(refreshing || localBusy);

  useEffect(() => {
    if (elixir) return;
    let cancelled = false;
    setLocalBusy(true);
    fetch('/terminal-api/status')
      .then((r) => r.json())
      .then((s) => { if (!cancelled) setLocal(s.elixirMcp || null); })
      .catch(() => { if (!cancelled) setLocal(null); })
      .finally(() => { if (!cancelled) setLocalBusy(false); });
    return () => { cancelled = true; };
  }, [elixir]);

  return (
    <div className="elixir-page">
      <section className="elixir-hero">
        <p className="elixir-kicker">Beaumont Voss · Ecommerce MCP</p>
        <h2>ELIXIR ECOM</h2>
        <p>
          Connect the Elixir ecommerce MCP so JARVIS can use store tools for Beaumont Voss and market research workflows.
          Credentials stay in Cursor MCP config - this panel never invents or stores keys.
        </p>
      </section>

      <section className="elixir-card">
        <div className="elixir-card-head">
          <h3>Connection</h3>
          <button type="button" className="quiet-button" onClick={onRefresh} disabled={busy}>
            {busy ? 'Checking…' : 'Refresh status'}
          </button>
        </div>
        <dl className="elixir-meta">
          <div><dt>Status</dt><dd>{loading ? 'Checking bridge…' : (stateLabel[state] || state)}</dd></div>
          <div><dt>Endpoint</dt><dd><code>{loading ? '…' : (data?.endpoint || 'Not set in jarvis.config.json')}</code></dd></div>
          <div><dt>Cursor MCP server</dt><dd><code>{data?.serverName || 'elixir'}</code> · {loading ? '…' : (data?.cursorConfigured ? 'found in ~/.cursor/mcp.json' : 'not found yet')}</dd></div>
          <div><dt>Reachable</dt><dd>{loading ? '…' : (data?.reachable ? `Yes${data.httpStatus ? ` (HTTP ${data.httpStatus})` : ''}` : 'No')}</dd></div>
          <div><dt>Enabled</dt><dd>{loading ? '…' : (data?.enabled === false ? 'No' : 'Yes')}</dd></div>
        </dl>
        <p className="elixir-note">{data?.notes || 'Attach Elixir MCP in Cursor. JARVIS does not store MCP credentials.'}</p>
      </section>

      <section className="elixir-card">
        <h3>Attach Elixir MCP</h3>
        <ol className="elixir-steps">
          <li>Open Cursor Settings → MCP (or edit <code>~/.cursor/mcp.json</code>).</li>
          <li>Add / keep a server named <code>{data?.serverName || 'elixir'}</code> pointing at <code>{data?.endpoint || 'https://mvp.ecomelixir.com/api/mcp'}</code>.</li>
          <li>Put your Elixir auth header in Cursor only - not in JARVIS config or git.</li>
          <li>Reload MCP in Cursor, then return here and refresh status.</li>
          <li>Once tools stream through a live session, they will list below.</li>
        </ol>
      </section>

      <section className="elixir-card">
        <h3>Tools</h3>
        {tools.length ? (
          <ul className="elixir-list">
            {tools.map((t) => (
              <li key={t.name}><strong>{t.name}</strong>{t.description ? <span>{t.description}</span> : null}</li>
            ))}
          </ul>
        ) : (
          <p className="elixir-empty">No tools listed yet. Connect Elixir MCP in Cursor, then refresh. Placeholder until a live MCP session reports tools.</p>
        )}
      </section>

      <section className="elixir-card">
        <h3>Resources</h3>
        {resources.length ? (
          <ul className="elixir-list">
            {resources.map((r) => (
              <li key={r.uri}><code>{r.uri}</code>{r.name ? <span>{r.name}</span> : null}</li>
            ))}
          </ul>
        ) : (
          <p className="elixir-empty">No resources yet. Same connect flow as tools.</p>
        )}
      </section>

      <section className="elixir-card">
        <h3>Vault references</h3>
        <p className="elixir-note">
          Market research notes cover EcomElixir templates, brand voice, and product-page workflows (template 13 selected; Kaching subscriptions).
        </p>
        <ul className="elixir-list">
          {(data?.docs?.length ? data.docs : [
            'vault/imports/market-research/market-research-export.md',
            'vault/01-projects/market-research/market-research-export.md',
          ]).map((d) => (
            <li key={d}><code>{d}</code></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
