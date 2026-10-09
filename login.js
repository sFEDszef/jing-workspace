document.getElementById('loginForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const button=document.getElementById('submit'),input=document.getElementById('password'),error=document.getElementById('error');
  button.disabled=true;error.textContent='';
  try{
    const password=input.value;input.value='';
    const response=await fetch('/api/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({password}),signal:AbortSignal.timeout(60000)});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'登录失败，请重试。');
    window.location.replace('/');
  }catch(e){error.textContent=e.name==='TimeoutError'?'服务正在启动或连接超时，请稍后重试。':e.message;input.focus();}
  finally{button.disabled=false;}
});
