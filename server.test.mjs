import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {handle,filterMessage} from './server.mjs';

test('private API rejects unauthenticated access, then checks server configuration after login',async()=>{
  const server=http.createServer((req,res)=>handle(req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    let r=await fetch(base+'/api/status');assert.equal(r.status,200);assert.equal((await r.json()).authenticated,false);
    r=await fetch(base+'/api/gmail/snapshot');assert.equal(r.status,401);
    r=await fetch(base+'/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'今天要做什么'})});assert.equal(r.status,401);
    r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'anything'})});assert.equal(r.status,503);
    process.env.WORKSPACE_PASSWORD='test-only-long-workspace-password';
    r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'wrong'})});assert.equal(r.status,401);
    r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:process.env.WORKSPACE_PASSWORD})});assert.equal(r.status,200);
    const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);const session=cookie.split(';')[0];
    r=await fetch(base+'/api/status',{headers:{Cookie:session}});assert.equal((await r.json()).authenticated,true);
    r=await fetch(base+'/api/ask',{method:'POST',headers:{Cookie:session,'Content-Type':'application/json'},body:JSON.stringify({question:'今天要做什么'})});assert.equal(r.status,503);
    r=await fetch(base+'/api/gmail/snapshot',{headers:{Cookie:session}});assert.equal(r.status,409);
    r=await fetch(base+'/api/status',{headers:{Origin:'https://untrusted.example'}});assert.equal(r.status,403);
    r=await fetch(base+'/.env');assert.equal(r.status,404);
    r=await fetch(base+'/api/logout',{method:'POST',headers:{Cookie:session,'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,200);
    r=await fetch(base+'/api/status',{headers:{Cookie:session}});assert.equal((await r.json()).authenticated,false);
  }finally{delete process.env.WORKSPACE_PASSWORD;await new Promise(resolve=>server.close(resolve));}
});
test('mail summaries exclude authentication messages and redact numeric secrets',()=>{
  const sample={id:'message',threadId:'thread',internalDate:String(Date.now()),labelIds:['UNREAD'],snippet:'Please submit by Friday. Account 123456789.',payload:{headers:[{name:'Subject',value:'Submission deadline'},{name:'From',value:'Faculty <private@example.com>'}]}};
  const mail=filterMessage(sample);assert.equal(mail.priority,'High');assert.equal(mail.sender,'Faculty');assert.ok(!mail.summary.includes('123456789'));assert.ok(!JSON.stringify(mail).includes('private@example.com'));
  sample.payload.headers[0].value='Your verification code';sample.snippet='123456';assert.equal(filterMessage(sample),null);
});
