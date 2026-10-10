/* Deterministic editorial rules, shared by browser and server. No model claims. */
(() => {
  const normalize=s=>String(s||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  function classify(n){
    const text=(n.title+' '+(n.snippet||'')).toLowerCase();
    if(/\b(opinion|commentary|editorial)\b|评论|社论/.test(text))return '评论';
    if(/\b(propos(?:e|es|ed|al)|consultation|draft rule)\b|政策提议|征求意见/.test(text))return '政策提议';
    if(/\b(expected|expects|forecast|prediction|could|may|bets|pricing in)\b|预计|预期|可能/.test(text))return '预期／需核实';
    return n.kind==='官方'?'官方公布':'媒体报道';
  }
  function groupNews(items){
    const groups=[];
    for(const n of items){
      const title=normalize(n.title),words=new Set(title.split(' ').filter(w=>w.length>2)),numbers=(title.match(/\b\d+\b/g)||[]).join('|');
      const found=groups.find(g=>{
        if(n.url===g.url)return true;
        if(!n.publishedAt||!g.publishedAt||Math.abs(Date.parse(n.publishedAt)-Date.parse(g.publishedAt))>36*3600000||n.category!==g.category)return false;
        if(title===g.normalized)return true;
        if(words.size<6||numbers!==g.numbers)return false;
        const overlap=[...words].filter(w=>g.words.has(w)).length;
        return overlap/Math.max(words.size,g.words.size)>=.88;
      });
      if(found){if(!found.related.some(r=>r.url===n.url))found.related.push(n);continue;}
      groups.push({...n,normalized:title,words,numbers,related:[],status:classify(n)});
    }
    return groups.map(({normalized,words,numbers,...g})=>g);
  }
  function prioritize(items,selected=[],now=Date.now()){
    return groupNews(items).map(n=>{
      const age=(now-Date.parse(n.publishedAt))/3600000,reasons=[];
      if(!Number.isFinite(age)||age<0||age>24||n.sourceStale)return {...n,score:0,reasons};
      let score=age<6?25:15;reasons.push('过去 24 小时');
      if(n.kind==='官方'){score+=20;reasons.push('官方来源');}
      if(n.sectors?.some(s=>selected.includes(s))){score+=20;reasons.push('与你的关注相关');}
      const material=/\b(interest rate|monetary policy|fomc|consumer price|inflation|employment situation|gdp|gross domestic|tariff|sanction|export control|production|inventor(?:y|ies)|earnings|revenue|results)\b|利率|通胀|就业|关税|制裁|库存|产量|财报/.test((n.title+' '+n.snippet).toLowerCase());
      if(material){score+=20;reasons.push('涉及政策、数据或经营变化');}
      if(['评论','预期／需核实','政策提议'].includes(n.status))score-=15;
      return {...n,score,reasons};
    }).filter(n=>n.score>=50).sort((a,b)=>b.score-a.score||String(b.publishedAt).localeCompare(String(a.publishedAt))).slice(0,3);
  }
  function relativePerformance(sector,benchmark,period){
    if(!sector||!benchmark||sector.date!==benchmark.date)return null;
    const a=sector.changes?.[period],b=benchmark.changes?.[period];
    return Number.isFinite(a)&&Number.isFinite(b)?a-b:null;
  }
  globalThis.JING_MARKET_RULES={classify,groupNews,prioritize,relativePerformance};
})();
