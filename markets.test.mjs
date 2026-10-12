import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFeed,parseDaily,parseFredCSV,selectSectors,marketSnapshot,explainMarket,sources,alphaVantageError} from './markets-service.mjs';
import {parseICS,parseFedCalendar,nextSevenDays,calendarSources} from './markets-calendar.mjs';
const xml=`<rss><channel><item><title><![CDATA[Oil &amp; energy update]]></title><link>https://example.org/story</link><pubDate>Fri, 09 Oct 2026 01:00:00 GMT</pubDate><description><![CDATA[<b>Supply</b> and demand &amp; inventories.]]></description></item><item><title>Duplicate</title><link>https://example.org/story</link></item><item><title>Unsafe</title><link>javascript:alert(1)</link></item></channel></rss>`;
test('RSS preserves publication/source, cleans markup, deduplicates and rejects unsafe links',()=>{
  const news=parseFeed(xml,sources[1]);assert.equal(news.length,1);assert.equal(news[0].title,'Oil & energy update');assert.equal(news[0].snippet,'Supply and demand & inventories.');assert.equal(news[0].publishedAt,'2026-10-09T01:00:00.000Z');assert.deepEqual(news[0].sectors,['energy']);assert.equal(news[0].kind,'官方');assert.throws(()=>parseFeed('<html>error</html>',sources[0]));
});
test('sector allowlist prevents unbounded provider requests',()=>{assert.equal(selectSectors(['gold','gold']).length,1);assert.throws(()=>selectSectors(['http://localhost']));assert.throws(()=>selectSectors('gold'));});
test('incomplete publication dates stay unknown instead of inventing a year',()=>{assert.equal(parseFeed(xml.replace('2026 ',''),sources[1])[0].publishedAt,null)});
test('daily returns use trading sessions and leave insufficient data empty',()=>{
  const series={};for(let i=1;i<=21;i++)series['2026-09-'+String(i).padStart(2,'0')]={'1. open':String(99+i),'2. high':String(102+i),'3. low':String(98+i),'4. close':String(100+i),'5. volume':String(1000+i)};
  const q=parseDaily({'Time Series (Daily)':series});assert.equal(q.history.length,21);assert.equal(q.close,121);assert.equal(q.open,120);assert.equal(q.high,123);assert.equal(q.low,119);assert.equal(q.history.at(-1).volume,1021);assert.equal(q.changes.week,(121/116-1)*100);assert.equal(q.changes.month,(121/101-1)*100);
  const small=parseDaily({'Time Series (Daily)':{'2026-10-01':{'4. close':'10'},'2026-10-02':{'4. close':'11'}}});assert.equal(small.changes.week,null);assert.throws(()=>parseDaily({Information:'Quota exhausted'}));
});
test('Alpha Vantage errors are safe and actionable',()=>{
  assert.equal(alphaVantageError({Information:'The API key is invalid.'}),'Alpha Vantage API Key 无效或尚未激活');
  assert.match(alphaVantageError({Note:'You have reached the 25 requests per day rate limit.'}),/免费额度已达上限/);
  assert.equal(alphaVantageError({}),'Alpha Vantage 暂未返回可用日线数据');
});
test('FRED CSV keeps only valid dated observations and calculates transparent changes',()=>{
  const csv='observation_date,DGS10\n2026-10-01,5.00\n2026-10-02,.\n2026-10-03,5.10\n2026-10-04,5.20\n2026-10-05,5.30\n2026-10-06,5.40\n2026-10-07,5.50';
  const data=parseFredCSV(csv,'DGS10');assert.equal(data.date,'2026-10-07');assert.equal(data.value,5.5);assert.ok(Math.abs(data.changes.week.difference-.5)<1e-10);assert.equal(data.history.length,6);
  assert.throws(()=>parseFredCSV('observation_date,OTHER\n2026-10-01,1','DGS10'),/格式无效/);
});
test('priority is explainable, limited to three, recent and never boosted by dramatic wording alone',()=>{
  const now=Date.parse('2026-10-10T02:00:00Z'),base={snippet:'',kind:'媒体',category:'world',sectors:[],publishedAt:'2026-10-10T01:00:00Z',url:'https://example.org/'};
  const items=[
    {...base,id:'a',title:'Markets crash shock fear',url:base.url+'a'},
    {...base,id:'b',title:'Monetary policy interest rate decision',url:base.url+'b',kind:'官方',category:'rates'},
    {...base,id:'c',title:'Technology company earnings and revenue',url:base.url+'c',kind:'公司公告',category:'company',sectors:['technology']},
    {...base,id:'d',title:'Oil production and inventories report',url:base.url+'d',kind:'官方',category:'energy',sectors:['energy']},
    {...base,id:'e',title:'Old official monetary policy decision',url:base.url+'e',kind:'官方',category:'rates',publishedAt:'2026-10-01T01:00:00Z'}
  ];
  const ranked=globalThis.JING_MARKET_RULES.prioritize(items,['technology','energy'],now);
  assert.deepEqual(ranked.map(x=>x.id),['d','b','c']);assert.ok(ranked.every(x=>x.reasons.length));assert.ok(!ranked.some(x=>x.id==='a'||x.id==='e'));
});
test('similar reports merge only with same category, close time and consistent numbers',()=>{
  const base={id:'a',title:'Official oil inventories increase 5 percent in weekly report today',url:'https://one.example',publishedAt:'2026-10-10T01:00:00Z',category:'energy'};
  const same={...base,id:'b',url:'https://two.example',title:'Official oil inventories increase 5 percent in weekly report today now'};
  const changed={...base,id:'c',url:'https://three.example',title:'Official oil inventories increase 9 percent in weekly report today now'};
  const groups=globalThis.JING_MARKET_RULES.groupNews([base,same,changed]);assert.equal(groups.length,2);assert.equal(groups[0].related.length,1);
});
test('official calendars preserve UTC, date-only uncertainty and seven-day filtering',()=>{
  const ics=`BEGIN:VCALENDAR\nX-WR-TIMEZONE:America/New_York\nBEGIN:VEVENT\nSUMMARY:Gross Domestic Product\\, Third Quarter 2026\nDTSTART:20261013T083000\nEND:VEVENT\nBEGIN:VEVENT\nSUMMARY:Unrelated release\nDTSTART:20261014T090000\nEND:VEVENT\nEND:VCALENDAR`;
  const events=parseICS(ics,calendarSources[0]);assert.equal(events.length,1);assert.equal(events[0].at,'2026-10-13T12:30:00.000Z');
  const fed=parseFedCalendar(`<a>2026 FOMC Meetings</a><div class="row fomc-meeting"><div class="fomc-meeting__month"><strong>October</strong></div><div class="fomc-meeting__date">27-28</div></div><a>2027 FOMC Meetings</a>`,calendarSources[2]);assert.equal(fed[0].date,'2026-10-28');assert.equal(fed[0].dateOnly,true);assert.match(fed[0].timeNote,/不推定/);
  assert.equal(nextSevenDays(events,Date.parse('2026-10-10T00:00:00Z')).length,1);
});
test('snapshot handles partial failures, cache, no key and AI consent without fake success',async()=>{
  const previous=globalThis.fetch,key=process.env.ALPHA_VANTAGE_API_KEY,ai=process.env.DEEPSEEK_API_KEY;delete process.env.ALPHA_VANTAGE_API_KEY;delete process.env.DEEPSEEK_API_KEY;let count=0;
  globalThis.fetch=async url=>{count++;if(String(url).includes('bbci'))throw Error('Offline');if(String(url).includes('fredgraph.csv')){const id=new URL(String(url)).searchParams.get('id');return new Response(`observation_date,${id}\n2026-10-01,4\n2026-10-02,4.1\n2026-10-03,4.2\n2026-10-04,4.3\n2026-10-05,4.4\n2026-10-06,4.5`)}return new Response(xml)};
  try{
    const snapshot=await marketSnapshot(['energy']);assert.equal(snapshot.schemaVersion,5);assert.equal(snapshot.news.length,1);assert.equal(snapshot.quoteConfigured,false);assert.equal(snapshot.quotes[0].data,null);assert.equal(snapshot.sources.filter(s=>s.error).length,2);assert.equal(snapshot.pulse.length,5);assert.equal(snapshot.pulse.find(x=>x.id==='fed').data.upper,4.5);assert.equal(snapshot.pulse.find(x=>x.id==='goldProxy').data,null);
    const first=count;await marketSnapshot(['energy']);assert.equal(count,first,'success and failure backoff cache both work');
    await assert.rejects(()=>explainMarket({articleId:snapshot.news[0].id}),/同意/);
    await assert.rejects(()=>explainMarket({articleId:snapshot.news[0].id,consent:true}),/AI 服务未配置/);
    process.env.DEEPSEEK_API_KEY='test-not-a-real-key';globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({summary:'测试摘要',impact:'测试可能影响',watch:'测试观察点'})}}]}));
    const result=await explainMarket({articleId:snapshot.news[0].id,consent:true});assert.equal(result.sourceUrl,'https://example.org/story');assert.equal(result.summary,'测试摘要');
    globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:'{}'}}]}));await assert.rejects(()=>explainMarket({articleId:snapshot.news[0].id,consent:true}),/不完整/);
  }finally{globalThis.fetch=previous;if(key===undefined)delete process.env.ALPHA_VANTAGE_API_KEY;else process.env.ALPHA_VANTAGE_API_KEY=key;if(ai===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=ai;}
});
