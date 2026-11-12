import http from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Brain } from './brain.mjs';
import { PROVIDERS, CHAT_PROVIDERS, PRIMARY_PROVIDERS, cleanEnvironment, executable, authenticated, invocation, normalizeEvent } from './providers.mjs';
const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'dashboard', '.data');
const staticDir = path.join(root, 'src/openjarvis/server/static');
const port = Number(process.env.TERMINAL_PORT || 4318);
const env = cleanEnvironment(process.env);
let jarvisConfig={vaultPath:path.resolve(root,'..','vault'),brand:'JARVIS'};
try{jarvisConfig={...jarvisConfig,...JSON.parse(await readFile(path.join(root,'dashboard','jarvis.config.json'),'utf8'))};}catch{}
await mkdir(dataDir, { recursive: true, mode: 0o700 });
let sessions = [];
try { sessions = JSON.parse(await readFile(path.join(dataDir, 'sessions.json'), 'utf8')); } catch {}
for (const s of sessions) s.provider ||= 'chatgpt';
for (const s of sessions) if (s.status === 'running') { s.status = 'interrupted'; s.activity = 'Server restarted. Send a message to continue.'; }
const brain=new Brain(root,{vaultPath:jarvisConfig.vaultPath});
await brain.init();
const jobs = new Map(), listeners = new Set();
let persistTimer;
let writeChain = Promise.resolve();
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const snapshot = JSON.stringify(sessions);
    writeChain = writeChain.then(async () => {
      await writeFile(path.join(dataDir, 'sessions.tmp'), snapshot, { mode: 0o600 });
      await rename(path.join(dataDir, 'sessions.tmp'), path.join(dataDir, 'sessions.json'));
    }).catch(console.error);
  }, 150);
}
function publish(s) { const msg = `data: ${JSON.stringify({type:'session', session:s})}\n\n`; for (const res of listeners) res.write(msg); persist(); }
async function providerStatus(id) {
  const p=PROVIDERS[id];
  if(id==='ollama'){
    try{
      const r=await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(2000)});
      if(!r.ok)throw new Error('Ollama not ready');
      const data=await r.json();
      const models=(data.models||[]).map(m=>m.name);
      return {id,name:p.name,model:models[0]||'local',installed:true,connected:true,loginCommand:'ollama serve',kind:'local',models,priority:PRIMARY_PROVIDERS.includes(id)};
    }catch{
      try{await exec(executable(id),['--version'],{env,timeout:4000});return {id,name:p.name,model:'local',installed:true,connected:false,loginCommand:'ollama serve',kind:'local',priority:true};}
      catch(e){return {id,name:p.name,model:'local',installed:e.code!=='ENOENT',connected:false,loginCommand:'Install Ollama from ollama.com (free)',kind:'local',priority:true};}
    }
  }
  if(id==='gemini'){
    try{
      const bin=process.env.TERMINAL_GEMINI_BIN||'gemini';
      const r=await exec(bin,['--version'],{env,timeout:8000});
      return {id,name:p.name,model:p.model,installed:true,connected:authenticated(id,r.stdout,r.stderr),loginCommand:'gemini (Google AI subscription / free tier)',kind:'subscription',priority:true};
    }catch(e){
      return {id,name:p.name,model:p.model,installed:false,connected:false,loginCommand:'Install Gemini CLI or use Google AI Studio free tier later',kind:'subscription',priority:true,hint:'Slot ready — no paid API key required'};
    }
  }
  try {const r=await exec(executable(id),p.status,{env,timeout:10000});return {id,name:p.name,model:p.model,installed:true,connected:authenticated(id,r.stdout,r.stderr),loginCommand:[p.cli,...p.login].filter(Boolean).join(' '),priority:PRIMARY_PROVIDERS.includes(id)};}
  catch(e){return {id,name:p.name,model:p.model,installed:e.code!=='ENOENT',connected:false,loginCommand:[p.cli,...p.login].filter(Boolean).join(' '),priority:PRIMARY_PROVIDERS.includes(id)};}
}
async function status() {
 const list=await Promise.all(['cursor','gemini','ollama','chatgpt'].map(providerStatus));
 const providers=Object.fromEntries(list.map(p=>[p.id,p]));
 const primary=PRIMARY_PROVIDERS.find(id=>providers[id]?.connected)||'cursor';
 return {connected:!!providers[primary]?.connected,provider:PROVIDERS[primary].name,model:providers[primary]?.model||PROVIDERS[primary].model,providers,apiBilling:false,maxConcurrent:4,running:jobs.size,openjarvis:existsSync(path.join(root,'.venv/bin/jarvis')),workspace:root,vaultPath:jarvisConfig.vaultPath,brand:jarvisConfig.brand||'JARVIS',primaryProviders:PRIMARY_PROVIDERS};
}
function json(res, code, body) { res.writeHead(code, {'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(body)); }
async function body(req) { let raw=''; for await (const chunk of req) { raw+=chunk; if(raw.length>29_000_000) throw new Error('Message is too large'); } return JSON.parse(raw||'{}'); }
const roles = {
  chat:'You are a thoughtful conversational assistant. Answer directly and concisely. Do not inspect files or use tools unless the user specifically asks. Avoid unnecessary research and repeated checks.',
  research:'You are a research assistant. Investigate the specific question, distinguish evidence from uncertainty, and give a clear answer. Use tools only when useful; avoid redundant searches.',
  build:'You are a practical coding assistant working in the JARVIS workspace. Complete the requested change and verify it. Keep actions scoped and summaries concise.',
  review:'You are a critical reviewer. Find the most consequential flaws, explain the evidence, and recommend concrete fixes. Do not change files unless explicitly requested.'
};
async function runOllama(s, contextualPrompt, answer) {
  const tags=await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(2000)});
  if(!tags.ok)throw new Error('Ollama is not running. Start it with `ollama serve`.');
  const models=((await tags.json()).models||[]).map(m=>m.name);
  if(!models.length)throw new Error('No Ollama models installed. Run `ollama pull llama3.2` (free).');
  const model=models[0];
  s.activity=`Talking to Ollama · ${model}`;
  publish(s);
  const r=await fetch('http://127.0.0.1:11434/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,prompt:contextualPrompt,stream:false}),signal:AbortSignal.timeout(14*60*1000)});
  if(!r.ok)throw new Error(`Ollama error ${r.status}`);
  const data=await r.json();
  answer.content=String(data.response||'').trim();
  s.usage={input_tokens:data.prompt_eval_count||0,cached_input_tokens:0,output_tokens:data.eval_count||0};
}
async function run(s, prompt, res) {
  if (jobs.has(s.id)) return json(res,409,{error:'This session is already running.'});
  if (jobs.size>=4) return json(res,429,{error:'Four sessions are running. Stop one or wait for it to finish.'});
  // Reserve a slot before checking auth so concurrent requests cannot exceed the cap.
  jobs.set(s.id, {pending:true});
  const connection=await providerStatus(s.provider);
  if (!connection.connected) { jobs.delete(s.id); return json(res,401,{error:`Connect ${connection.name}: ${connection.loginCommand}. Free/subscription only — no paid API-key fallback.`}); }
  let context;
  try { if(s.memoryEnabled!==false)await brain.capture(prompt,s); context=await brain.context(prompt,s); } catch(e){jobs.delete(s.id);return json(res,500,{error:`Memory could not be loaded: ${e.message}`});}
  s.contextSources=context.sources;
  s.messages.push({id:randomUUID(),role:'user',content:prompt});
  if(s.messages.length===1) s.title=prompt.slice(0,48);
  s.status='running'; s.error=''; s.activity=`Starting ${PROVIDERS[s.provider].name}`; s.startedAt=Date.now();
  const answer={id:randomUUID(),role:'assistant',content:''}; s.messages.push(answer);
  const contextualPrompt=context.text?`${context.text}\n\nCURRENT USER MESSAGE:\n${prompt}`:prompt;
  if(s.provider==='ollama'){
    const controller={kill(){}};
    jobs.set(s.id,controller);
    publish(s);json(res,202,{id:s.id});
    try{
      await runOllama(s,contextualPrompt,answer);
      s.status='done';s.activity='Response complete';s.elapsedMs=Date.now()-s.startedAt;publish(s);
      void brain.archive(s).catch(e=>console.error('Archive failed:',e.message));
    }catch(e){s.status='error';s.error=e.message;s.activity='Run interrupted';s.elapsedMs=Date.now()-s.startedAt;publish(s);}
    finally{jobs.delete(s.id);}
    return;
  }
  if(s.provider==='gemini'){
    jobs.delete(s.id);
    s.messages.pop();s.messages.pop();
    s.status='idle';s.activity='Ready when you are';
    return json(res,501,{error:'Gemini slot is ready in Connections. CLI chat wiring lands next — use Cursor or Ollama for live replies today.'});
  }
  const call=invocation(s,contextualPrompt,roles[s.role]);
  const child=spawn(executable(s.provider),call.args,{cwd:root,env,stdio:['pipe','pipe','pipe'],detached:true});
  jobs.set(s.id,child);
  let buffer='', stderr='', lastPublish=0, completed=false;
  const timer=setTimeout(()=>{ s.error='Run reached the 15-minute time limit.'; stop(s.id); },15*60*1000);
  const finish=(code)=> {
    clearTimeout(timer); jobs.delete(s.id);
    if(s.status==='running') s.status=s.error?'error':completed?'done':code===0&&answer.content?'done':'error';
    if(s.status==='error'&&!s.error) s.error=stderr.slice(-1500)||'The run ended without a response. Check your subscription connection.';
    s.activity=s.status==='done'?'Response complete':s.status==='stopped'?'Stopped by you':'Run interrupted';
    s.elapsedMs=Date.now()-s.startedAt; publish(s);
    void brain.archive(s).catch(e=>console.error('Archive failed:',e.message));
  };
  function event(e) {
    const n=normalizeEvent(s.provider,e);
    if(n.threadId)s.threadId=n.threadId;
    if(n.activity)s.activity=n.activity;
    if(n.append)answer.content+=(answer.content?'\n\n':'')+n.append;
    if(n.final!==undefined)answer.content=n.final;
    if(n.usage)s.usage=n.usage;
    if(n.done)completed=true;
    if(n.error)s.error=n.error;
    if(Date.now()-lastPublish>100||n.append||n.done){publish(s);lastPublish=Date.now();}
  }
  child.stdout.on('data',chunk=>{buffer+=chunk;let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);try{event(JSON.parse(line));}catch{}}});
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-4000);});
  child.on('error',err=>{s.error=err.message;});
  child.on('close',code=>{if(buffer.trim())try{event(JSON.parse(buffer));}catch{}finish(code);});
  child.stdin.on('error',()=>{});
  child.stdin.end(call.stdin);
  publish(s);json(res,202,{id:s.id});
}
function stop(id) { const child=jobs.get(id), s=sessions.find(x=>x.id===id); if(child?.pid){s.status='stopped';try{process.kill(-child.pid,'SIGTERM');}catch{child.kill();}publish(s);setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}},2000).unref();} }
const server=http.createServer(async(req,res)=>{
  try {
    const host=req.headers.host;
    if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(host)) return json(res,403,{error:'Local access only'});
    if(req.headers.origin && ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(req.headers.origin)) return json(res,403,{error:'Origin rejected'});
    const url=new URL(req.url,`http://${host}`), p=url.pathname;
    if(p==='/terminal-api/brain'&&req.method==='GET')return json(res,200,brain.summary());
    if(p==='/terminal-api/brain/search'&&req.method==='GET')return json(res,200,brain.search(url.searchParams.get('q')||'',url.searchParams.get('project')||'all'));
    if(p==='/terminal-api/brain/memories'&&req.method==='POST')return json(res,200,await brain.saveMemory(await body(req)));
    const memory=p.match(/^\/terminal-api\/brain\/memories\/([a-f0-9-]+)$/);
    if(memory&&req.method==='DELETE'){await brain.forget(memory[1]);return json(res,200,{ok:true});}
    if(p==='/terminal-api/brain/import'&&req.method==='POST')return json(res,201,await brain.importFile(await body(req)));
    if(p==='/terminal-api/brain/reindex'&&req.method==='POST')return json(res,200,await brain.reindex());
    const document=p.match(/^\/terminal-api\/brain\/documents\/([a-f0-9]+)(\/download)?$/);
    if(document&&req.method==='GET'){
      const d=await brain.document(document[1]);
      if(document[2]){res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(d.name)}`,'X-Content-Type-Options':'nosniff'});return res.end(await readFile(d.full));}
      const {full,...safe}=d;return json(res,200,safe);
    }
    if(p==='/terminal-api/cursor/open'&&req.method==='POST'){
      await exec(path.join(process.env.HOME,'.local/bin/cursor'),['--new-window',path.join(root,'Second Brain.code-workspace')],{env,timeout:10000});
      return json(res,200,{message:'Workspace opened in Cursor. Use Terminal → Run Task to build or run the dashboard.'});
    }
    if(p==='/terminal-api/status') return json(res,200,await status());
    const login=p.match(/^\/terminal-api\/providers\/(chatgpt|cursor)\/login$/);
    if(login&&req.method==='POST'){
      const loginFile=path.join(root,'dashboard',`login-${login[1]}.command`);
      if(existsSync(loginFile)) await exec('/usr/bin/open',['-a','Terminal',loginFile],{env,timeout:10000});
      return json(res,200,{message:'Complete the official sign-in in Terminal and your browser, then refresh connections.'});
    }
    const softLogin=p.match(/^\/terminal-api\/providers\/(gemini|ollama)\/login$/);
    if(softLogin&&req.method==='POST'){
      if(softLogin[1]==='ollama'){
        try{await exec('ollama',['serve'],{env,timeout:500});}catch{}
        return json(res,200,{message:'If Ollama is installed, start it with `ollama serve`, then Refresh connections. Pull a free model with `ollama pull llama3.2`.'});
      }
      return json(res,200,{message:'Gemini connection slot is ready. Install the free Gemini CLI when available, or keep using Cursor / Ollama. No paid API key required.'});
    }
    if(p==='/terminal-api/events') {
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
      res.write(`data: ${JSON.stringify({type:'snapshot',sessions})}\n\n`);listeners.add(res);
      const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),15000);req.on('close',()=>{clearInterval(heartbeat);listeners.delete(res);});return;
    }
    if(p==='/terminal-api/sessions'&&req.method==='POST') {
      const b=await body(req);if(b.provider&&!CHAT_PROVIDERS.includes(b.provider))return json(res,400,{error:'Unknown provider'});const s={project:typeof b.project==='string'?b.project:'global',memoryEnabled:b.memoryEnabled!==false,skillIds:Array.isArray(b.skillIds)?b.skillIds.filter(id=>brain.skills.some(k=>k.id===id)).slice(0,3):[],provider:b.provider||'cursor',id:randomUUID(),title:'New conversation',role:Object.hasOwn(roles,b.role)?b.role:'chat',effort:['low','medium','high'].includes(b.effort)?b.effort:'low',status:'idle',messages:[],createdAt:Date.now(),activity:'Ready when you are'};
      sessions.unshift(s);publish(s);return json(res,201,s);
    }
    const m=p.match(/^\/terminal-api\/sessions\/([a-f0-9-]+)(?:\/(message|stop))?$/);
    if(m){const s=sessions.find(x=>x.id===m[1]);if(!s)return json(res,404,{error:'Session not found'});
      if(m[2]==='message'&&req.method==='POST'){const b=await body(req);if(typeof b.prompt!=='string'||!b.prompt.trim()||b.prompt.length>100000)return json(res,400,{error:'Enter a message up to 100,000 characters'});return await run(s,b.prompt.trim(),res);}
      if(m[2]==='stop'&&req.method==='POST'){stop(s.id);return json(res,200,{ok:true});}
      if(req.method==='DELETE'){if(jobs.has(s.id))return json(res,409,{error:'Stop the session before deleting it'});sessions=sessions.filter(x=>x.id!==s.id);persist();for(const r of listeners)r.write(`data: ${JSON.stringify({type:'snapshot',sessions})}\n\n`);return json(res,200,{ok:true});}
    }
    if(p.startsWith('/terminal-api/'))return json(res,404,{error:'Not found'});
    if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
    const file=path.resolve(staticDir,'.'+decodeURIComponent(p));
    if(!file.startsWith(staticDir+path.sep)&&file!==staticDir)return json(res,403,{error:'Invalid path'});
    let target=file;if(!existsSync(target)||p==='/')target=path.join(staticDir,'index.html');
    const ext=path.extname(target);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'})[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(await readFile(target));
  }catch(e){if(!res.headersSent)json(res,500,{error:e.message});else res.end();}
});
server.listen(port,'127.0.0.1',()=>console.log(`JARVIS dashboard: http://127.0.0.1:${port}`));
process.on('SIGTERM',()=>{for(const id of jobs.keys())stop(id);server.close();setTimeout(()=>process.exit(),500);});
