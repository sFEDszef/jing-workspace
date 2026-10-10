/* Official schedules only. Date-only events remain date-only, never guessed times. */
import {createHash} from 'node:crypto';
export const calendarSources=[
  {id:'bea-calendar',name:'BEA · 经济数据',url:'https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics',home:'https://www.bea.gov/news/schedule',format:'ics'},
  {id:'bls-calendar',name:'BLS · 通胀与就业',url:'https://www.bls.gov/schedule/news_release/bls.ics',home:'https://www.bls.gov/schedule/',format:'ics'},
  {id:'fed-calendar',name:'FOMC · 议息日程',url:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',home:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',format:'fed'}
];
const id=s=>createHash('sha256').update(s).digest('hex').slice(0,24);
const clean=s=>String(s).replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
function zoneISO(raw,zone){
  const m=raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);if(!m)return null;
  const [year,month,day,hour,minute,second]=m.slice(1,7).map(x=>Number(x||0)),utc=Date.UTC(year,month-1,day,hour,minute,second);
  if(m[7])return new Date(utc).toISOString();if(!zone)return null;
  try{const formatter=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});let t=utc;
    for(let i=0;i<3;i++){const parts=Object.fromEntries(formatter.formatToParts(new Date(t)).map(p=>[p.type,p.value]));t+=utc-Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);}return new Date(t).toISOString();
  }catch{return null;}
}
export function parseICS(text,source){
  if(!text.includes('BEGIN:VCALENDAR'))throw Error('日历格式无效');
  const unfolded=text.replace(/\r?\n[ \t]/g,'');
  const defaultZone=unfolded.match(/^X-WR-TIMEZONE:(.+)$/m)?.[1]?.trim();
  return [...unfolded.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)END:VEVENT/g)].flatMap(([,block])=>{
    if(/^STATUS:CANCELLED\s*$/m.test(block))return [];
    const title=block.match(/^SUMMARY(?:;[^:]*)?:(.*)$/m)?.[1]?.trim().replace(/\\n/g,' ').replace(/\\([,;\\])/g,'$1');
    const dt=block.match(/^DTSTART([^:]*):([^\r\n]+)/m);if(!title||!dt)return [];
    if(!/gross domestic|personal income|trade|consumer price|producer price|employment situation|job openings|employment cost/i.test(title))return [];
    const allDay=/VALUE=DATE(?:;|$)/.test(dt[1])||/^\d{8}$/.test(dt[2]);
    const date=allDay?dt[2].replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'):null;
    const at=allDay?null:zoneISO(dt[2],dt[1].match(/TZID=([^;]+)/)?.[1]||defaultZone);if(!date&&!at)return [];
    return [{id:id(source.id+title+dt[2]),title,at,date,dateOnly:allDay,source:source.name,sourceId:source.id,url:source.home,category:'economy',status:'官方日程',timeNote:allDay?'官方仅提供日期；不是北京时间的具体时点':'已转换为北京时间'}];
  });
}
export function parseFedCalendar(html,source){
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'],events=[];
  const sections=[...html.matchAll(/(\d{4}) FOMC Meetings([\s\S]*?)(?=\d{4} FOMC Meetings|$)/g)];
  for(const [,year,section] of sections){
    const matches=[...section.matchAll(/class="[^"]*fomc-meeting__month[^" ]*(?: [^"]*)?"[^>]*>([\s\S]*?)<\/div>[\s\S]*?class="[^"]*fomc-meeting__date[^"]*"[^>]*>([\s\S]*?)<\/div>/g)];
    for(const [,monthRaw,daysRaw] of matches){const month=months.indexOf(clean(monthRaw)),days=clean(daysRaw).match(/^(\d{1,2})(?:-(\d{1,2}))?\*?$/);if(month<0||!days)continue;
      const date=`${year}-${String(month+1).padStart(2,'0')}-${String(days[2]||days[1]).padStart(2,'0')}`;
      events.push({id:id('fed'+date),title:'FOMC 议息会议 · 最后一天',date,at:null,dateOnly:true,source:source.name,sourceId:source.id,url:source.home,category:'rates',status:'官方日程',timeNote:'美国当地会议日期；具体发布时间待确认，不推定北京时间'});
    }
  }
  if(!events.length)throw Error('未识别到官方会议日期');return events;
}
export function nextSevenDays(events,now=Date.now()){
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  const end=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now+7*86400000));
  return events.filter(x=>x.dateOnly?x.date>=today&&x.date<end:Date.parse(x.at)>=now&&Date.parse(x.at)<now+7*86400000).sort((a,b)=>(a.at||a.date).localeCompare(b.at||b.date));
}
