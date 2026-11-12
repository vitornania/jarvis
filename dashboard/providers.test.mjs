import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authenticated,invocation,normalizeEvent,cleanEnvironment,pickDefaultProvider,PRIMARY_PROVIDERS,GOD_MODE,FALLBACK_PROVIDERS} from './providers.mjs';
test('new chats prefer subscription providers over Ollama',()=>{
  assert.deepEqual(PRIMARY_PROVIDERS,['cursor','gemini','chatgpt']);
  assert.deepEqual(FALLBACK_PROVIDERS,['ollama']);
  assert.equal(pickDefaultProvider({ollama:{connected:true},cursor:{connected:false},gemini:{connected:false},chatgpt:{connected:false}}),'cursor');
  assert.equal(pickDefaultProvider({ollama:{connected:true},cursor:{connected:false},gemini:{connected:true},chatgpt:{connected:false}}),'gemini');
  assert.equal(pickDefaultProvider({ollama:{connected:true},cursor:{connected:true},gemini:{connected:true},chatgpt:{connected:true}}),'cursor');
});
test('God mode stays on subscription CLIs with browser + high parallel',()=>{
  assert.equal(GOD_MODE.browserControl,true);
  assert.equal(GOD_MODE.streaming,true);
  assert.equal(GOD_MODE.effort,'high');
  assert.ok(GOD_MODE.maxParallel>=6);
  assert.deepEqual(GOD_MODE.providerPrefer,['cursor','gemini','chatgpt']);
  assert.ok(!GOD_MODE.providerPrefer.includes('ollama'));
  const god=invocation({provider:'cursor',role:'god',effort:'high'},'go','instructions');
  assert.ok(!god.args.includes('ask'));
});
test('only account authentication is accepted',()=>{
 assert.equal(authenticated('chatgpt','','Logged in using ChatGPT'),true);
 assert.equal(authenticated('chatgpt','Logged in using an API key'),false);
 assert.equal(authenticated('claude',JSON.stringify({loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty'})),true);
 assert.equal(authenticated('claude',JSON.stringify({loggedIn:true,authMethod:'api_key',apiProvider:'firstParty'})),false);
 assert.equal(authenticated('cursor',JSON.stringify({isAuthenticated:true,hasAccessToken:true,hasRefreshToken:true})),true);
 assert.equal(authenticated('cursor',JSON.stringify({isAuthenticated:true})),false);
 assert.equal(authenticated('cursor',JSON.stringify({isAuthenticated:true,hasAccessToken:true,hasRefreshToken:true,message:'Logged in (unable to fetch user details)'})),false);
});
test('metered credential overrides are removed',()=>{
 const source={PATH:'/bin',CURSOR_API_KEY:'secret',ANTHROPIC_AUTH_TOKEN:'secret',CLAUDE_CODE_USE_BEDROCK:'1',CODEX_API_KEY:'secret',CURSOR_AUTH_TOKEN:'secret'};
 assert.deepEqual(cleanEnvironment(source),{PATH:'/bin'});assert.equal(source.CURSOR_API_KEY,'secret');
});
test('each provider resumes its own thread and receives only the follow-up',()=>{
 for(const provider of ['chatgpt','claude','cursor']){
 const run=invocation({provider,threadId:'thread-123',role:'chat',effort:'low'},'hello','instructions');
 assert.ok(run.args.includes('thread-123'));assert.ok(!run.args.includes('--force'));assert.ok(!JSON.stringify(run).includes('instructions'));
 assert.equal(provider==='cursor'?run.args.at(-1):run.stdin,'hello');
 }
});
test('non-building sessions cannot silently use a write-enabled mode',()=>{
 const c=invocation({provider:'claude',role:'chat',effort:'low'},'x','i');assert.equal(c.args[c.args.indexOf('--tools')+1],'');assert.ok(c.args.includes('dontAsk'));
 const u=invocation({provider:'cursor',role:'research',effort:'low'},'x','i');assert.ok(u.args.includes('ask'));assert.ok(u.args.includes('enabled'));
});
test('Claude and Cursor final result replaces buffered text and reports errors',()=>{
 for(const p of ['claude','cursor']){
 assert.equal(normalizeEvent(p,{type:'system',subtype:'init',session_id:'a'}).threadId,'a');
 assert.equal(normalizeEvent(p,{type:'assistant',message:{content:[{type:'text',text:'Hi'}]}}).append,'Hi');
 assert.deepEqual(normalizeEvent(p,{type:'result',subtype:'success',result:'Hi',session_id:'a',usage:{input_tokens:5,output_tokens:2}}),{done:true,final:'Hi',threadId:'a',usage:{input_tokens:5,cached_input_tokens:0,output_tokens:2}});
 assert.equal(normalizeEvent(p,{type:'result',subtype:'error_during_execution',is_error:true,result:'quota reached'}).failed,true);
 }
});
test('Codex final and failure formats remain supported',()=>{
 assert.equal(normalizeEvent('chatgpt',{type:'item.completed',item:{type:'agent_message',text:'hello'}}).append,'hello');
 assert.equal(normalizeEvent('chatgpt',{type:'turn.failed',error:{message:'limit'}}).error,'limit');
});
