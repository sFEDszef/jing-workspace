// Read-only pre-deployment smoke check against the real public Markets sources.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '/Users/gonghuajing/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const base=process.env.JING_LIVE_BASE||'http://127.0.0.1:4311';
const password=process.env.JING_LIVE_PASSWORD;
if(!password)throw new Error('Set JING_LIVE_PASSWORD for the temporary local preview.');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox','--disable-gpu']});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),pageErrors=[];
page.on('pageerror',error=>pageErrors.push(error.message));
try{
  const login=await context.request.post(base+'/api/login',{data:{password}});assert.equal(login.status(),200,'temporary preview login');
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.evaluate(()=>go('markets'));
  await page.waitForFunction(()=>{const button=document.querySelector('[data-mk=refresh]'),raw=localStorage.getItem('jingMarketsV1');if(!button||button.disabled||!raw)return false;try{return JSON.parse(raw).snapshot?.schemaVersion===5}catch{return false}},{timeout:90000});
  const snapshot=await page.evaluate(()=>JSON.parse(localStorage.getItem('jingMarketsV1')).snapshot);
  const successfulSources=snapshot.sources.filter(source=>!source.error&&source.count>0).length,pulseAvailable=snapshot.pulse.filter(item=>item.data).length;
  assert.ok(successfulSources>=1,'at least one live public news source should succeed');
  assert.ok(pulseAvailable>=4,'the four no-key official market indicators should load');
  assert.equal(snapshot.pulse.find(item=>item.id==='goldProxy')?.data,null,'no-key gold proxy must remain unavailable');
  assert.ok(!(await page.locator('#markets').innerText()).includes('TEST fixture'),'synthetic acceptance fixtures must never appear in live preview');
  assert.equal(pageErrors.length,0,'no JavaScript page errors');
  await mkdir('tmp/markets-live-smoke',{recursive:true});
  await page.screenshot({path:'tmp/markets-live-smoke/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const mobile=await page.locator('#markets').evaluate(el=>({clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,documentWidth:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(mobile.scrollWidth<=mobile.clientWidth+2&&mobile.documentWidth<=mobile.viewport+2,'mobile layout must not overflow the page');
  await page.screenshot({path:'tmp/markets-live-smoke/mobile.png',fullPage:false});
  const report={checkedAt:new Date().toISOString(),base,newsCount:snapshot.news.length,successfulSources,totalSources:snapshot.sources.length,failedSources:snapshot.sources.filter(source=>source.error).map(source=>source.name),pulseAvailable,pulse:snapshot.pulse.map(item=>({id:item.id,date:item.data?.date||null,available:Boolean(item.data),stale:Boolean(item.stale),error:item.error||null})),eventCount:snapshot.events.length,quoteConfigured:snapshot.quoteConfigured,quoteAvailable:snapshot.quotes.filter(item=>item.data).length,pageErrors,mobile};
  await writeFile('tmp/markets-live-smoke/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close()}
