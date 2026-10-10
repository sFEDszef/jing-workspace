/* Jing Workspace: private backend adapter. Never place provider keys here. */
(() => {
  const key = 'jingWorkspaceConnectionV1';
  let config; try { config = JSON.parse(localStorage.getItem(key) || '{}'); } catch { config = {}; }
  const privateSite=window.JING_PRIVATE_SITE===true;
  if(privateSite)config.backendUrl=window.location.origin;
  let busy = false, status = null;
  let mailSyncing=false,checkingConnection=false;
  function mailPhase(phase,error=''){gmailSnapshot.connectionPhase=phase;gmailSnapshot.connectionError=error;renderGmailSnapshot();updateConnectionLabel();}
  function updateConnectionLabel(){const node=document.getElementById('connectionState');if(!node)return;node.textContent=status?`后端${status.authenticated?'已登录':'未登录'} · DeepSeek ${status.aiConfigured?'已配置':'待配置'} · ${document.getElementById('gmailConnectionTitle')?.textContent||'Gmail 状态待检查'}${gmailSnapshot.connectionError?' · '+gmailSnapshot.connectionError:''}`:'尚未确认服务器连接 · '+(gmailSnapshot.connectionError||'正在检查');}
  window.checkWorkspaceConnection=async function(autoSync=false){
    if(checkingConnection||mailSyncing)return;checkingConnection=true;const previousPhase=gmailSnapshot.connectionPhase,previousError=gmailSnapshot.connectionError;
    try{
      if(!base()){status=null;mailPhase('unconfigured','请先设置私人后端地址。');return;}
      if(!mailSyncing)mailPhase('checking');
      status=await request('/api/status');
      if(!status.authenticated)mailPhase('login','登录服务器后才能检查 Gmail 授权。');
      else if(!status.gmailConfigured)mailPhase('unconfigured','服务器尚未配置 Google OAuth。');
      else if(!status.gmailConnected)mailPhase('reauthorize','没有可恢复的 Gmail 授权；请重新连接一次。以后部署或重启将自动恢复。');
      else {mailPhase(previousPhase==='syncError'?'syncError':previousPhase!=='reauthorize'&&Number.isFinite(new Date(gmailSnapshot.lastSync).getTime())?'synced':'authorized',previousPhase==='syncError'?previousError:'');if(autoSync)await syncWorkspaceGmail(true);}
    }catch(e){mailPhase(e.httpStatus===401?'login':'error',e.message);}
    finally{checkingConnection=false;updateConnectionLabel();}
  };
  function base() { return String(config.backendUrl || '').replace(/\/$/, ''); }
  async function request(path, body) {
    if (!base()) throw new Error('请先设置后端地址。');
    const response = await fetch(base() + path, { method: body === undefined ? 'GET' : 'POST', credentials: 'include', headers: body === undefined ? {} : {'Content-Type':'application/json'}, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000) });
    const data = await response.json().catch(() => ({}));
    if(privateSite&&response.status===401)window.location.replace('/login');
    if (!response.ok) {const error=new Error(data.error || `连接失败 (${response.status})`);error.httpStatus=response.status;throw error;}
    return data;
  }
  window.requestPaperAnalysis = data => request('/api/papers/analyze', data);
  window.requestMarketSnapshot = sectors => request('/api/markets/snapshot', {sectors});
  window.requestMarketExplanation = data => request('/api/markets/explain', data);
  window.openWorkspaceConnection = function () {
    openModal(`<h2>AI & Gmail settings</h2><p class="small">GitHub Pages hosts this website. A private backend handles DeepSeek and Gmail. API keys belong in server environment variables.</p><div class="field"><label>Backend URL</label><input class="form-input" id="workspaceBackend" type="url" value="${escapeText(base())}" placeholder="https://your-private-backend.example.com"></div><div class="settings-actions"><button class="btn" onclick="saveWorkspaceConnection()">Save & check connection</button></div><div id="connectionState" class="course-note">${status ? escapeText(status.authenticated ? '已登录私人后端' : '请登录私人后端') : '未检测连接'}</div><div class="field"><label>Private backend password (not saved in this browser)</label><input class="form-input" id="backendPassword" type="password" autocomplete="off"></div><button class="btn ghost" onclick="loginWorkspaceBackend()">Sign in to backend</button><label class="check-row"><input type="checkbox" id="gmailAiConsent" ${config.gmailAiConsent ? 'checked' : ''} onchange="setGmailAiConsent(this.checked)"><span>允许将最近 7 天邮件的发件人、主题和已过滤的简短摘要发送到我的后端及 DeepSeek，用于分析待办。不会发送附件或完整正文。</span></label><div class="settings-actions"><button class="btn ghost" onclick="connectWorkspaceGmail()">Connect Gmail (read only)</button><button class="btn ghost" onclick="syncWorkspaceGmail()">Refresh mail</button><button class="btn ghost" onclick="disconnectWorkspaceGmail()">Disconnect Gmail</button><button class="btn ghost" onclick="logoutWorkspaceBackend()">Sign out</button></div><p class="small">自动刷新仅在网页打开时运行。Google 的授权页面会展示实际读取权限；尚未配置后端时这些连接功能不可用。</p>`);
  };
  const originalConnectionDialog=window.openWorkspaceConnection;
  window.openWorkspaceConnection=function(){originalConnectionDialog();const help=document.querySelector('#modalContent p.small');if(help)help.textContent='私人服务器负责 DeepSeek 和 Gmail。API Key 只保存在服务器环境变量中；Gmail 刷新凭证经加密后保存在 HttpOnly 安全凭证中，可在部署或重启后自动恢复。';updateConnectionLabel();checkWorkspaceConnection(false);};
  window.saveWorkspaceConnection = async function () {
    try {
      const value = document.getElementById('workspaceBackend').value.trim().replace(/\/$/, '');
      if(privateSite&&value!==window.location.origin)throw new Error('此私人网站只使用自身服务器，无需更改地址。');
      const parsed = new URL(value);
      if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost','127.0.0.1'].includes(parsed.hostname))) throw new Error('请使用 HTTPS 后端地址，本地测试可用 localhost。');
      if(parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error('请输入不含密钥、参数或路径的后端根地址。');
      config.backendUrl = value; localStorage.setItem(key, JSON.stringify(config));
      await checkWorkspaceConnection(false);
    } catch(e) { toast(e.message); }
  };
  window.loginWorkspaceBackend = async function () { try { const input = document.getElementById('backendPassword'); const password = input.value; input.value = ''; await request('/api/login', {password}); await checkWorkspaceConnection(true); toast('后端已登录'); } catch(e) { toast(e.message); } };
  window.setGmailAiConsent = function(value) { config.gmailAiConsent = Boolean(value); localStorage.setItem(key,JSON.stringify(config)); };
  window.connectWorkspaceGmail = async function () { try { const s = await request('/api/status'); if (!s.authenticated) throw new Error('请先登录私人后端。'); if (!s.gmailConfigured) throw new Error('服务器尚未配置 Google OAuth。'); window.location.assign(base() + '/auth/google/start'); } catch(e) { toast(e.message); } };
  function emptyMail() { mails.splice(0); Object.assign(gmailSnapshot,{account:'Not connected',lastSync:'Not connected',inboxUnread:0}); renderGmailSnapshot(); renderDashboard(); }
  window.syncWorkspaceGmail = async function(quiet=false) {
    if(mailSyncing)return;mailSyncing=true;mailPhase('syncing');
    try {const data=await request('/api/gmail/snapshot');if(!Array.isArray(data.emails)||!Number.isFinite(new Date(data.lastSync).getTime()))throw new Error('服务器返回的邮件快照格式不正确。');mails.splice(0,mails.length,...data.emails);Object.assign(gmailSnapshot,{account:data.account,lastSync:data.lastSync,inboxUnread:data.inboxUnread});if(status)status.gmailConnected=true;mailPhase('synced');renderDashboard();if(!quiet)toast(`${data.emails.length} 个邮件会话已刷新`);}
    catch(e){mailPhase(e.httpStatus===409?'reauthorize':e.httpStatus===401?'login':'syncError',e.name==='TimeoutError'?'同步超时，请稍后重试；这不代表授权已断开。':e.name==='TypeError'?'无法连接服务器，请检查网络或稍后重试。':e.message);if(!quiet)toast(gmailSnapshot.connectionError);}
    finally{mailSyncing=false;}
  };
  window.disconnectWorkspaceGmail = async function () { try { await request('/api/gmail/disconnect',{}); emptyMail();if(status)status.gmailConnected=false;mailPhase('reauthorize','你已主动断开 Gmail。');toast('已断开本工作台的 Gmail 连接'); } catch(e) { toast(e.message); } };
  window.logoutWorkspaceBackend = async function () { try { await request('/api/logout',{}); status=null; emptyMail(); if(privateSite)window.location.replace('/login');else toast('已退出后端'); } catch(e) { toast(e.message); } };
  showSyncInfo = openWorkspaceConnection;
  const localAnswer = workspaceAnswer;
  // Escape before formatting: model output must never become executable HTML.
  function renderAssistantText(value) {
    const inline = text => escapeText(text).replace(/\[([^\]\n]+)\]\((https:\/\/mail\.google\.com\/mail\/[^\s<>]+)\)/g, (match,label,url) => {
      try { const parsed=new URL(url.replace(/&amp;/g,'&')); if(parsed.hostname!=='mail.google.com'||parsed.username||parsed.password)return label; return `<a class="assistant-mail-link" href="${escapeText(parsed.href)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`; } catch { return label; }
    }).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`\n]+)`/g,'<code>$1</code>');
    return String(value||'').split(/\r?\n/).map(line=>{
      if(!line.trim())return '<div class="assistant-gap"></div>';
      if(/^\s*---+\s*$/.test(line))return '<hr>';
      const heading=line.match(/^#{1,6}\s+(.+)/); if(heading)return `<h4>${inline(heading[1])}</h4>`;
      const item=line.match(/^\s*(?:[-*]|\d+[.)])\s+(.+)/); if(item)return `<div class="assistant-list-row">${inline(line.trim())}</div>`;
      return `<p>${inline(line)}</p>`;
    }).join('');
  }
  openAssistant = function () {
    const history = workspaceState.chat.slice(-10);
    openModal(`<h2>Ask a Question · Jing Workspace</h2><p class="small">${base() ? '通过你的私人后端调用模型。邮件仅在勾选分析选项后读取。' : '本地规则模式 · 尚未连接 DeepSeek，可查看本地任务状态。'}</p><button class="btn ghost" onclick="openWorkspaceConnection()">AI & Gmail settings</button><div class="assistant-thread" id="assistantThread">${history.map(m=>`<div class="assistant-msg ${m.role==='user'?'user':'ai'}">${m.role==='user'?escapeText(m.text):renderAssistantText(m.text)}</div>`).join('')}</div><textarea id="assistantQuestion" placeholder="我最近有哪些需要处理的邮件和作业？" ${busy?'disabled':''}></textarea><label class="check-row"><input type="checkbox" id="askIncludeGmail" ${config.gmailAiConsent?'checked':''} ${busy?'disabled':''}><span>分析最近 7 天的 Gmail 摘要（发送至后端与 DeepSeek）</span></label><button class="btn" onclick="askWorkspace()" ${busy?'disabled':''}>${busy?'正在分析…':'Ask'}</button>`);
  };
  function context() {
    return { date:new Date().toISOString(), assignments:(workspaceState.customAssignments||[]).slice(0,30).map(a=>({title:a.title,course:a.course,done:a.done,dueAt:a.dueAt})), generatedAssignments:(workspaceState.generatedAssignments||[]).slice(0,20).map(a=>({title:a.title,course:a.course,source:a.source,done:a.done})), tasks:(workspaceState.miscTasks||[]).slice(0,30).map(t=>({title:t.title,done:t.done,dueAt:t.dueAt})), events:(workspaceState.events||[]).slice(0,30).map(e=>({title:e.title,date:e.date,time:e.time,end:e.end,recurring:e.recurring})), papers:(workspaceState.papers||[]).filter(p=>p.fileName||!/^p[1-4]$/.test(p.id)).slice(0,20).map(p=>({title:p.title,status:p.status,course:p.course})) };
  }
  async function ask(question,includeGmail) {
    if(busy)return;
    if(includeGmail && !config.gmailAiConsent) { toast('请先在 AI & Gmail settings 中确认邮件摘要分析。'); return; }
    busy=true; workspaceState.chat.push({role:'user',text:question}); saveWorkspaceState(); openAssistant();
    try {
      let text;
      if(!base()) { if(includeGmail)throw new Error('尚未连接私人后端，无法读取 Gmail。'); text='[本地规则模式，非 AI 分析]\n'+localAnswer(question); }
      else { const result=await request('/api/ask',{question,includeGmail,consent:includeGmail&&config.gmailAiConsent,context:context()}); text=result.answer; if(includeGmail) await syncWorkspaceGmail(true); }
      workspaceState.chat.push({role:'ai',text}); saveWorkspaceState();
    } catch(e) { workspaceState.chat.push({role:'ai',text:'未完成分析：'+e.message}); saveWorkspaceState(); }
    finally { busy=false; openAssistant(); }
  }
  askWorkspace=function(){const input=document.getElementById('assistantQuestion'),q=input?.value.trim();if(q)ask(q,Boolean(document.getElementById('askIncludeGmail')?.checked));};
  askFromDashboard=function(){const input=document.getElementById('dashboardAsk'),q=input?.value.trim();if(q){input.value='';ask(q,false);}};
  document.getElementById('askAI').onclick=openAssistant;
  if(privateSite){const logout=document.createElement('button');logout.className='nav-item';logout.textContent='Sign out · 退出工作台';logout.onclick=logoutWorkspaceBackend;document.getElementById('settingsBtn').after(logout);}
  const notice=document.createElement('div'); notice.className='small';notice.style.cssText='padding:8px 0;color:var(--muted)';notice.textContent='Published edition · Courses, assignment examples and market figures are demonstrations. Upload your files and create your own tasks. Gmail and cloud AI require connection.';document.getElementById('dashboard').prepend(notice);
  const settings=document.createElement('button'); settings.className='btn ghost';settings.textContent='AI & Gmail settings';settings.onclick=openWorkspaceConnection;document.querySelector('#mail .toolbar').appendChild(settings);
  checkWorkspaceConnection(true);
  setInterval(()=>{if(base()&&document.visibilityState==='visible')checkWorkspaceConnection(true);},3600000);
})();
