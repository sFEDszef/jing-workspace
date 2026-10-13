import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('./workspace-api.js',import.meta.url),'utf8');
const prefix=source.slice(source.indexOf("  const key ="),source.indexOf('  window.openWorkspaceConnection ='));
const sync=source.slice(source.indexOf('  window.syncWorkspaceGmail ='),source.indexOf('  window.disconnectWorkspaceGmail ='));
function setup(status,payload,code=200){
  const s={URL,Date,AbortSignal,gmailSnapshot:{lastSync:'Not connected'},mails:[],localStorage:{getItem:()=>JSON.stringify({backendUrl:'https://workspace.example'}),setItem:()=>{}},document:{getElementById:()=>null},renderGmailSnapshot:()=>{},renderDashboard:()=>{},toast:()=>{},fetch:async(url)=>({ok:url.endsWith('/api/status')||code===200,status:url.endsWith('/api/status')?200:code,json:async()=>url.endsWith('/api/status')?status:payload})};
  s.window=s;vm.createContext(s);vm.runInContext(prefix+sync,s);return s;
}
test('assistant Gmail checkbox provides explicit one-time consent without a second settings gate',()=>{
  assert.doesNotMatch(source,/includeGmail\s*&&\s*!config\.gmailAiConsent/);
  assert.match(source,/consent:Boolean\(includeGmail\)/);
  assert.match(source,/本次分析最近 7 天的 Gmail 摘要/);
});
test('assistant history supports confirmed record deletion and clearing',()=>{
  assert.match(source,/删除记录/);
  assert.match(source,/清空记录/);
  const historyCode=source.slice(source.indexOf('  function assistantHistoryEntries()'),source.indexOf('  function context()'));
  const s={workspaceState:{chat:[{role:'user',text:'Question 1'},{role:'ai',text:'Answer 1'},{role:'user',text:'Question 2'},{role:'ai',text:'Answer 2'}]},confirm:()=>true};
  s.saveWorkspaceState=()=>{s.saved=(s.saved||0)+1;};s.openAssistant=()=>{s.opened=(s.opened||0)+1;};s.toast=value=>{s.toastValue=value;};
  s.window=s;vm.createContext(s);vm.runInContext('let busy=false;'+historyCode,s);
  const entries=vm.runInContext('assistantHistoryEntries().map(({start,count})=>({start,count}))',s);
  assert.deepEqual(JSON.parse(JSON.stringify(entries)),[{start:0,count:2},{start:2,count:2}]);
  s.deleteAssistantRecord(0,2);assert.deepEqual(s.workspaceState.chat.map(x=>x.text),['Question 2','Answer 2']);assert.equal(s.saved,1);assert.equal(s.opened,1);
  s.clearAssistantHistory();assert.deepEqual(JSON.parse(JSON.stringify(s.workspaceState.chat)),[]);assert.equal(s.saved,2);assert.equal(s.opened,2);assert.equal(s.toastValue,'AI 对话记录已清空');
});
test('assistant deletion is cancelled without changing saved history',()=>{
  const historyCode=source.slice(source.indexOf('  function assistantHistoryEntries()'),source.indexOf('  function context()'));
  const s={workspaceState:{chat:[{role:'user',text:'Keep me'},{role:'ai',text:'Keep this answer'}]},confirm:()=>false};
  s.saveWorkspaceState=()=>{s.saved=true;};s.openAssistant=()=>{};s.toast=()=>{};
  s.window=s;vm.createContext(s);vm.runInContext('let busy=false;'+historyCode,s);s.deleteAssistantRecord(0,2);
  assert.equal(s.workspaceState.chat.length,2);assert.equal(s.saved,undefined);
});
test('startup checks authorization then syncs; an empty mailbox is still connected',async()=>{
  const s=setup({authenticated:true,gmailConfigured:true,gmailConnected:true},{emails:[],account:'owner',lastSync:'2026-10-09T08:00:00Z',inboxUnread:0});
  await s.checkWorkspaceConnection(true);assert.equal(s.gmailSnapshot.connectionPhase,'synced');assert.equal(s.mails.length,0);
});
test('missing grant requires reauthorization, not a zero-mail result',async()=>{
  const s=setup({authenticated:true,gmailConfigured:true,gmailConnected:false},{});
  await s.checkWorkspaceConnection(true);assert.equal(s.gmailSnapshot.connectionPhase,'reauthorize');assert.equal(s.gmailSnapshot.lastSync,'Not connected');
});
test('network errors retain old snapshot and status checks do not mask sync failure',async()=>{
  const s=setup({authenticated:true,gmailConfigured:true,gmailConnected:true},{error:'Temporary network failure'},502);s.mails.push({title:'Existing'});s.gmailSnapshot.lastSync='2026-10-09T08:00:00Z';
  await s.syncWorkspaceGmail(true);assert.equal(s.gmailSnapshot.connectionPhase,'syncError');assert.equal(s.mails.length,1);
  await s.checkWorkspaceConnection(false);assert.equal(s.gmailSnapshot.connectionPhase,'syncError');
});
test('expired grants are distinct from upstream/network failures',async()=>{
  const s=setup({}, {error:'Please reconnect'},409);await s.syncWorkspaceGmail(true);assert.equal(s.gmailSnapshot.connectionPhase,'reauthorize');
});
