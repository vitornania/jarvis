import path from 'node:path';
export const PROVIDERS = {
  chatgpt: {name:'ChatGPT',cli:'codex',model:'gpt-6-sol',login:['login'],status:['login','status']},
  claude: {name:'Claude',cli:'claude',model:'sonnet',login:['auth','login','--claudeai'],status:['auth','status']},
  cursor: {name:'Cursor',cli:'agent',model:'auto',login:['login'],status:['status','--format','json']},
  // Free / subscription-first slots. Gemini uses Google login when gcloud/gemini CLI is present.
  // Ollama is local HTTP — no paid API key.
  gemini: {name:'Gemini',cli:'gemini',model:'gemini',login:[''],status:['--version'],kind:'subscription'},
  ollama: {name:'Ollama',cli:'ollama',model:'local',login:['list'],status:['list'],kind:'local'},
};
export const PRIMARY_PROVIDERS = ['cursor','gemini','ollama'];
export const CHAT_PROVIDERS = ['cursor','chatgpt','gemini','ollama'];
export function cleanEnvironment(source) {
  const env={...source};
  for(const key of Object.keys(env)) if(/^(OPENAI_API_KEY|CODEX_API_KEY|ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|CLAUDE_CODE_OAUTH_TOKEN|CURSOR_API_KEY|CURSOR_API_KEY_FILE|CURSOR_SERVICE_ACCOUNT_KEY|CURSOR_AUTH_TOKEN|OPENAI_BASE_URL|ANTHROPIC_BASE_URL|CLAUDE_CODE_USE_BEDROCK|CLAUDE_CODE_USE_VERTEX|CLAUDE_CODE_USE_FOUNDRY)$/.test(key))delete env[key];
  return env;
}
export function executable(id){return process.env[`TERMINAL_${id.toUpperCase()}_BIN`]||path.join(process.env.HOME,'.local/bin',PROVIDERS[id].cli);}
export function authenticated(id,stdout,stderr='') {
  if(id==='chatgpt')return /Logged in using ChatGPT/i.test(stdout+stderr);
  if(id==='ollama')return /NAME|MODEL|\S+\s+\S+/.test(stdout||'')&&!/not found|error/i.test(stderr||'');
  if(id==='gemini')return !/not logged|unauthenticated|error:/i.test((stdout+stderr).toLowerCase())&&!!(stdout||stderr);
  try{const d=JSON.parse(stdout);return id==='claude'?d.loggedIn===true&&d.authMethod==='claude.ai'&&d.apiProvider==='firstParty':d.isAuthenticated===true&&d.hasAccessToken===true&&d.hasRefreshToken===true&&!/unable|expired|invalid/i.test(d.message||'');}catch{return false;}
}
export function invocation(s,prompt,instruction){
 const provider=s.provider||'chatgpt';const p=PROVIDERS[provider];
 if(!p)throw new Error('Unknown provider');
 const text=(s.threadId?'':instruction+'\n\n')+prompt;
 if(provider==='chatgpt'){
  const args=['exec','--ignore-user-config','--json','--skip-git-repo-check','-c','model_provider="openai"','-c','forced_login_method="chatgpt"','-c',`model_reasoning_effort="${s.effort}"`,'-c',`sandbox_mode="${s.role==='build'?'workspace-write':'read-only'}"`,'-c','approval_policy="never"','-m',p.model];
  if(s.threadId)args.push('resume',s.threadId,'-');else args.push('-');return {args,stdin:text};
 }
 if(provider==='claude'){
  const args=['-p','--output-format','stream-json','--verbose','--model',p.model,'--effort',s.effort,'--setting-sources','','--strict-mcp-config','--permission-mode',s.role==='build'?'acceptEdits':'dontAsk','--permission-prompts','none','--tools',s.role==='chat'?'':s.role==='build'?'Read,Glob,Grep,Edit,Write':'Read,Glob,Grep,WebSearch,WebFetch'];
  if(s.threadId)args.push('--resume',s.threadId);return {args,stdin:text};
 }
 const args=['--print','--output-format','stream-json','--model','auto','--sandbox','enabled','--trust'];
 if(s.role!=='build')args.push('--mode','ask');if(s.threadId)args.push('--resume',s.threadId);
 args.push('--',text);return {args,stdin:''};
}
export function normalizeEvent(provider,e){
 if(provider==='chatgpt'){
  if(e.type==='thread.started')return {threadId:e.thread_id};
  if(e.type==='item.completed'&&e.item?.type==='agent_message')return {append:e.item.text,activity:'Writing response'};
  if(e.type==='turn.completed')return {done:true,usage:e.usage};
  if(e.type==='turn.failed'||e.type==='error')return {error:e.error?.message||e.message||'Provider reported an error'};
  if(e.type==='item.started')return {activity:e.item?.type==='command_execution'?'Running a command':'Thinking'};
 }else{
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
