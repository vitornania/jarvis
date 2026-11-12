import path from 'node:path';
export const PROVIDERS = {
  chatgpt: {name:'ChatGPT',cli:'codex',model:'gpt-6-sol',login:['login'],status:['login','status'],kind:'subscription',tier:'preferred'},
  claude: {name:'Claude',cli:'claude',model:'sonnet',login:['auth','login','--claudeai'],status:['auth','status'],kind:'subscription',tier:'hidden'},
  cursor: {name:'Cursor',cli:'agent',model:'auto',login:['login'],status:['status','--format','json'],kind:'subscription',tier:'preferred'},
  // Free Google account via Antigravity CLI (`agy`). Legacy `gemini` binary still probed.
  gemini: {name:'Gemini',cli:'agy',model:'gemini',login:[''],status:['--version'],kind:'subscription',tier:'preferred'},
  ollama: {name:'Ollama',cli:'ollama',model:'local',login:['list'],status:['list'],kind:'local',tier:'fallback'},
};
/** Preferred subscription providers for new chats (never default to Ollama). */
export const PRIMARY_PROVIDERS = ['cursor','gemini','chatgpt'];
export const FALLBACK_PROVIDERS = ['ollama'];
export const CHAT_PROVIDERS = ['cursor','chatgpt','gemini','ollama'];
export const GOD_MODE = {
  id: 'god',
  label: 'God mode',
  browserControl: true,
  providerPrefer: ['cursor','gemini','chatgpt'],
  maxParallel: 6,
  streaming: true,
  effort: 'high',
  roleBoost: 'You are JARVIS God mode: fast, decisive, tool-capable. Prefer parallel investigation. Use browser/computer-use tools when the task needs live web or UI verification. Stay on subscription CLIs — never invent paid API keys. Beaumont Voss is the primary project unless told otherwise.',
};
export function cleanEnvironment(source) {
  const env={...source};
  for(const key of Object.keys(env)) if(/^(OPENAI_API_KEY|CODEX_API_KEY|ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|CLAUDE_CODE_OAUTH_TOKEN|CURSOR_API_KEY|CURSOR_API_KEY_FILE|CURSOR_SERVICE_ACCOUNT_KEY|CURSOR_AUTH_TOKEN|OPENAI_BASE_URL|ANTHROPIC_BASE_URL|CLAUDE_CODE_USE_BEDROCK|CLAUDE_CODE_USE_VERTEX|CLAUDE_CODE_USE_FOUNDRY|GEMINI_API_KEY|GOOGLE_API_KEY)$/.test(key))delete env[key];
  return env;
}
export function executable(id){
  if(id==='gemini')return process.env.TERMINAL_GEMINI_BIN||process.env.TERMINAL_AGY_BIN||'agy';
  return process.env[`TERMINAL_${id.toUpperCase()}_BIN`]||path.join(process.env.HOME,'.local/bin',PROVIDERS[id].cli);
}
export function authenticated(id,stdout,stderr='') {
  if(id==='chatgpt')return /Logged in using ChatGPT/i.test(stdout+stderr);
  if(id==='ollama')return /NAME|MODEL|\S+\s+\S+/.test(stdout||'')&&!/not found|error/i.test(stderr||'');
  if(id==='gemini'){
    const text=(stdout+stderr).toLowerCase();
    if(/not signed|not authenticated|unauthenticated|login required|sign in|no active session|agy_error/i.test(text))return false;
    return !/command not found|enoent/i.test(text)&&!!(stdout||stderr);
  }
  try{const d=JSON.parse(stdout);return id==='claude'?d.loggedIn===true&&d.authMethod==='claude.ai'&&d.apiProvider==='firstParty':d.isAuthenticated===true&&d.hasAccessToken===true&&d.hasRefreshToken===true&&!/unable|expired|invalid/i.test(d.message||'');}catch{return false;}
}
export function resolveProjectId(raw, aliases={}, defaultProject='beaumont-voss'){
  if(!raw||raw==='global'||raw==='all')return raw||'global';
  return aliases[raw]||aliases[String(raw).toLowerCase()]||raw||defaultProject;
}
export function pickDefaultProvider(providers){
  for(const id of PRIMARY_PROVIDERS){
    if(providers?.[id]?.connected)return id;
  }
  return 'cursor';
}
export function invocation(s,prompt,instruction){
 const provider=s.provider||'chatgpt';const p=PROVIDERS[provider];
 if(!p)throw new Error('Unknown provider');
 const text=(s.threadId?'':instruction+'\n\n')+prompt;
 if(provider==='chatgpt'){
  const args=['exec','--ignore-user-config','--json','--skip-git-repo-check','-c','model_provider="openai"','-c','forced_login_method="chatgpt"','-c',`model_reasoning_effort="${s.effort}"`,'-c',`sandbox_mode="${s.role==='build'||s.role==='god'?'workspace-write':'read-only'}"`,'-c','approval_policy="never"','-m',p.model];
  if(s.threadId)args.push('resume',s.threadId,'-');else args.push('-');return {args,stdin:text};
 }
 if(provider==='claude'){
  const args=['-p','--output-format','stream-json','--verbose','--model',p.model,'--effort',s.effort,'--setting-sources','','--strict-mcp-config','--permission-mode',s.role==='build'||s.role==='god'?'acceptEdits':'dontAsk','--permission-prompts','none','--tools',s.role==='chat'?'':s.role==='god'||s.role==='build'?'Read,Glob,Grep,Edit,Write,WebSearch,WebFetch,Bash':'Read,Glob,Grep,WebSearch,WebFetch'];
  if(s.threadId)args.push('--resume',s.threadId);return {args,stdin:text};
 }
 if(provider==='gemini'){
  const args=['-p',text,'--output-format','stream-json','--print-timeout','14m','--disable-slash-commands'];
  if(s.role==='god')args.push('--dangerously-skip-permissions');
  else if(s.role!=='build')args.push('--mode','plan');
  if(s.threadId)args.push('--conversation',s.threadId);
  return {args,stdin:''};
 }
 // Cursor agent
 const args=['--print','--output-format','stream-json','--model','auto','--sandbox','enabled','--trust'];
 if(s.role==='god'){/* ask mode off — fuller agency via subscription */}
 else if(s.role!=='build')args.push('--mode','ask');
 if(s.threadId)args.push('--resume',s.threadId);
 args.push('--',text);return {args,stdin:''};
}
export function normalizeEvent(provider,e){
 if(provider==='chatgpt'){
  if(e.type==='thread.started')return {threadId:e.thread_id};
  if(e.type==='item.completed'&&e.item?.type==='agent_message')return {append:e.item.text,activity:'Writing response'};
  if(e.type==='turn.completed')return {done:true,usage:e.usage};
  if(e.type==='turn.failed'||e.type==='error')return {error:e.error?.message||e.message||'Provider reported an error'};
  if(e.type==='item.started')return {activity:e.item?.type==='command_execution'?'Running a command':'Thinking'};
 }
 if(provider==='gemini'){
  if(e.event==='init'&&e.init)return {threadId:e.conversation_id||e.init.conversation_id,activity:'Connected to Gemini'};
  if(e.event==='step_update'&&e.step_update){
   const step=e.step_update;
   if(step.text_delta)return {append:step.text_delta,activity:'Writing response',threadId:step.conversation_id};
   if(step.state==='DONE'&&step.step_type==='agent_response'&&step.text)return {append:step.text,activity:'Writing response',threadId:step.conversation_id};
   return {activity:step.step_type==='tool_call'?'Using tools':'Thinking',threadId:step.conversation_id};
  }
  if(e.event==='result'&&e.result){
   const r=e.result;
   if(String(r.status||'').toUpperCase()==='ERROR'||r.error)return {error:r.error||'Gemini reported an error',failed:true,threadId:r.conversation_id};
   return {done:true,final:typeof r.response==='string'?r.response:undefined,threadId:r.conversation_id,usage:r.usage?{input_tokens:r.usage.input_tokens||0,cached_input_tokens:r.usage.cache_read_tokens||0,output_tokens:r.usage.output_tokens||0}:undefined};
  }
  if(e.conversation_id&&e.status==='SUCCESS'&&typeof e.response==='string')return {done:true,final:e.response,threadId:e.conversation_id,usage:e.usage?{input_tokens:e.usage.input_tokens||0,cached_input_tokens:e.usage.cache_read_tokens||0,output_tokens:e.usage.output_tokens||0}:undefined};
  if(e.AGY_ERROR||e.error)return {error:typeof e.error==='string'?e.error:(e.error?.short_error||e.short_error||'Gemini error'),failed:true};
 }
 {
  if(e.type==='system'&&e.subtype==='init')return {threadId:e.session_id,activity:`Connected to ${PROVIDERS[provider].name}`};
  if(e.type==='assistant'){
   const text=(e.message?.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');
   return text?{append:text,activity:'Writing response'}:{activity:'Using tools'};
  }
  if(e.type==='tool_call')return {activity:e.subtype==='started'?'Using a tool':'Tool finished'};
  if(e.type==='result'){
   if(e.is_error||String(e.subtype).startsWith('error'))return {error:e.result||(e.errors||[]).join('\n')||'Provider reported an error',failed:true};
   return {done:true,final:typeof e.result==='string'?e.result:undefined,threadId:e.session_id,usage:e.usage?{input_tokens:e.usage.input_tokens||0,cached_input_tokens:e.usage.cache_read_input_tokens||0,output_tokens:e.usage.output_tokens||0}:undefined};
  }
  if(e.type==='error')return {error:e.error?.message||e.message||'Provider reported an error',failed:true};
 }
 return {};
}
