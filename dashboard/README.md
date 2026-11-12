# Terminal dashboard

Open http://127.0.0.1:4318 while the server is running, or double-click `start.command`.

This custom React dashboard lives in the OpenJarvis source checkout. Chat runs through a separate Node bridge to the official Codex and Cursor CLIs using your existing account logins. OpenJarvis's Python environment is installed, but its inference server and tools are not connected to these chat sessions. ChatGPT and Cursor Agent are supported through their official account logins. Claude was left out at your request. Choose the provider above New conversation; existing sessions keep their provider.

## What works

- Four independent concurrent Codex sessions, persisted on disk.
- Chat, research, build, and review starting instructions.
- Thread-specific follow-up context, background runs, and split view on desktop.
- Per-session stop, search, Markdown rendering, copy, export, and deletion.
- Lean / balanced / deep reasoning selection for new ChatGPT sessions from Agent desk. Cursor uses Auto.
- Live status events and reported output tokens from the latest turn of each session.

ChatGPT chat, research, and review use read-only Codex tools; build uses workspace-write. Cursor non-build sessions use Ask mode; build uses the workspace sandbox. Actions requiring interactive approval are denied by the non-interactive runner. There is no unrestricted shell mode.

## Authentication and usage

Use the Sign in button on each Connections card, or run `codex login` or `agent login`. Sign in opens the official CLI flow in a visible Terminal window. The bridge requires account authentication for each CLI and strips API-key/token overrides from subprocess environments. ChatGPT pins the OpenAI provider and ignores provider overrides; Cursor uses Auto with its sandbox enabled. No API-key billing fallback is configured. Subscription limits still apply. Disable Cursor on-demand usage in the provider account settings to prevent overage charges; the dashboard cannot read or change these settings. The output-token figure is not a measurement of remaining subscription quota.

The bridge does not copy authentication tokens into the browser. Chat history and Codex thread IDs are saved in `dashboard/.data/sessions.json` (ignored by Git). Each provider also maintains its own thread history. Deleting a dashboard conversation removes the dashboard copy, not the underlying provider history.

## Run and rebuild

```sh
cd frontend
npm run build
cd ..
node dashboard/server.mjs
```

Node 22+ is required. Frontend package installation requires npm 11.19.x according to upstream's package manifest.

The HTTP server binds only to `127.0.0.1:4318`; foreign Host and Origin headers are rejected. Do not expose it through a public tunnel. Server state survives browser reloads. Restarting the bridge interrupts running jobs and marks them interrupted on the next launch.

## Validation

Production TypeScript/Vite build passes. Two real ChatGPT-backed sessions completed concurrently and retained separate follow-up context. Automated browser inspection was unavailable in the build session; visual and mobile behavior still need an in-browser review.

## Multi-provider validation

Six adapter tests cover subscription-auth checks, credential stripping, provider-specific resume, tool modes, and response/error parsing. The production build passes. Cursor login was refreshed successfully. Live tests verified a Cursor reply, thread-specific follow-up memory, and simultaneous ChatGPT and Cursor runs; test conversations were removed. Claude sign-in was cancelled at your request.
