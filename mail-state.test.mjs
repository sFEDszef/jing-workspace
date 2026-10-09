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
