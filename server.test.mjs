import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {handle,filterMessage,resolveMailReferences,assistantInstructions} from './server.mjs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('mail citations resolve only to snapshot originals',()=>{
  const emails=[{url:'https://mail.google.com/mail/u/0/#all/abc'},{url:'javascript:alert(1)'}];
  assert.equal(resolveMailReferences('Source: [M1]',emails),'Source: [打开原邮件](https://mail.google.com/mail/u/0/#all/abc)');
  assert.doesNotMatch(resolveMailReferences('[M2] [M99]',emails),/javascript:|\]\(/);
  assert.match(assistantInstructions,/expired/);
});
test('assistant formats paragraphs and original links without executing model HTML',async()=>{
  const source=await readFile(new URL('./workspace-api.js',import.meta.url),'utf8');
  const fn=source.slice(source.indexOf('  function renderAssistantText('),source.indexOf('  openAssistant = function'));
  const escapeText=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const render=vm.runInNewContext(fn+'\nrenderAssistantText',{escapeText,URL});
  const output=render('### 1. High\n**行动：** 检查\n\n[打开原邮件](https://mail.google.com/mail/u/0/#all/abc)\n<script>alert(1)</script>');
  assert.match(output,/<h4>1. High<\/h4>/);assert.match(output,/<strong>行动：<\/strong>/);
  assert.match(output,/target="_blank" rel="noopener noreferrer"/);assert.match(output,/assistant-gap/);
  assert.doesNotMatch(output,/<script>/);assert.doesNotMatch(render('[bad](javascript:alert(1))'),/<a /);
  assert.doesNotMatch(render('[bad](https://mail.google.com.evil.example/mail/x)'),/<a /);
});

test('private API rejects unauthenticated access, then checks server configuration after login',async()=>{
  const server=http.createServer((req,res)=>handle(req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    let r=await fetch(base+'/api/status');assert.equal(r.status,200);assert.equal((await r.json()).authenticated,false);
    r=await fetch(base+'/',{redirect:'manual'});assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/login');
    r=await fetch(base+'/index.html',{redirect:'manual'});assert.equal(r.status,303);
    r=await fetch(base+'/course-engine.js');assert.equal(r.status,401);
    r=await fetch(base+'/login');assert.equal(r.status,200);assert.match(await r.text(),/请输入密码/);
    r=await fetch(base+'/api/gmail/snapshot');assert.equal(r.status,401);
    r=await fetch(base+'/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'今天要做什么'})});assert.equal(r.status,401);
    r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'anything'})});assert.equal(r.status,503);
    process.env.WORKSPACE_PASSWORD='test-only-long-workspace-password';
    r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'wrong'})});assert.equal(r.status,401);
    r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:process.env.WORKSPACE_PASSWORD})});assert.equal(r.status,200);
    const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);const session=cookie.split(';')[0];
    assert.match(cookie,/SameSite=Lax/);assert.doesNotMatch(cookie,/Max-Age=28800/);
    r=await fetch(base+'/',{headers:{Cookie:session}});assert.equal(r.status,200);assert.match(await r.text(),/window.JING_PRIVATE_SITE=true/);
    r=await fetch(base+'/course-engine.js',{headers:{Cookie:session}});assert.equal(r.status,200);
    process.env.WORKSPACE_PASSWORD='changed-test-only-long-password';
    r=await fetch(base+'/',{headers:{Cookie:session},redirect:'manual'});assert.equal(r.status,303);
    process.env.WORKSPACE_PASSWORD='test-only-long-workspace-password';
    r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:process.env.WORKSPACE_PASSWORD})});
    const renewed=r.headers.get('set-cookie').split(';')[0];
    r=await fetch(base+'/api/status',{headers:{Cookie:renewed}});assert.equal((await r.json()).authenticated,true);
    r=await fetch(base+'/api/ask',{method:'POST',headers:{Cookie:renewed,'Content-Type':'application/json'},body:JSON.stringify({question:'今天要做什么'})});assert.equal(r.status,503);
    r=await fetch(base+'/api/gmail/snapshot',{headers:{Cookie:renewed}});assert.equal(r.status,409);
    for(let i=0;i<65;i++){r=await fetch(base+'/api/status',{headers:{Cookie:renewed}});assert.equal(r.status,200);}
    r=await fetch(base+'/api/status',{headers:{Origin:'https://untrusted.example'}});assert.equal(r.status,403);
    r=await fetch(base+'/.env');assert.equal(r.status,404);
    r=await fetch(base+'/api/logout',{method:'POST',headers:{Cookie:renewed,'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,200);
    r=await fetch(base+'/api/status',{headers:{Cookie:renewed}});assert.equal((await r.json()).authenticated,false);
  }finally{delete process.env.WORKSPACE_PASSWORD;await new Promise(resolve=>server.close(resolve));}
});
test('mail summaries exclude authentication messages and redact numeric secrets',()=>{
  const sample={id:'message',threadId:'thread',internalDate:String(Date.now()),labelIds:['UNREAD'],snippet:'Please submit by Friday. Account 123456789.',payload:{headers:[{name:'Subject',value:'Submission deadline'},{name:'From',value:'Faculty <private@example.com>'}]}};
  const mail=filterMessage(sample);assert.equal(mail.priority,'High');assert.equal(mail.sender,'Faculty');assert.ok(!mail.summary.includes('123456789'));assert.ok(!JSON.stringify(mail).includes('private@example.com'));
  sample.payload.headers[0].value='Your verification code';sample.snippet='123456';assert.equal(filterMessage(sample),null);
});
