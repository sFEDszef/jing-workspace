import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const script=await readFile(new URL('./dashboard-engine.js',import.meta.url),'utf8');
const segment=script.slice(script.indexOf('// Confirmed dates only:'),script.indexOf('const plannerStyle='));
function setup(){
  const fields={ddlTitle:{value:'Actual deadline'},ddlDate:{value:'2026-10-09T12:00'},ddlMail:{value:'0'},deadlineStrip:{},calendarGrid:{},courseTimetable:{}};
  const s={Date,Intl,Set,JSON,DAY:86400000,workspaceState:{miscTasks:[],events:[{id:'personal-plan',title:'Keep me',module:'Personal'}]},mails:[{title:'Source',url:'https://mail.google.com/mail/u/0/#all/abc'}],document:{getElementById:id=>fields[id]},collectPriorityItems:()=>[],controlFor:()=>({}),nowDate:()=>new Date('2026-10-09T08:00:00+08:00'),safeTime:v=>Number.isNaN(new Date(v).getTime())?null:new Date(v),escapeText:String,relativeTime:()=>'',persist:()=>true,closeModal:()=>{},renderAssignments:()=>{},renderDashboard:()=>{},toast:()=>{},openModal:()=>{},startOfDay:d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()),addDays:(d,n)=>new Date(d.getTime()+n*86400000),dateKey:d=>d.toISOString().slice(0,10),allOccurrences:()=>[],parseDateTime:(d,t='23:59')=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&/^\d{2}:\d{2}$/.test(t)?new Date(d+'T'+t+':00'):null};
  vm.createContext(s);vm.runInContext(segment,s);return {s,fields};
}
test('DDL excludes demo assignments and completed tasks',()=>{
  const {s}=setup();s.collectPriorityItems=()=>[{id:'demo',sourceType:'assignment',sourceId:'eds6001',dueAt:'2026-10-10'},{id:'actual',sourceType:'personal',sourceId:'x',dueAt:'2026-10-11'},{id:'done',sourceType:'personal',dueAt:'2026-10-09',sourceCompleted:true}];
  assert.deepEqual(Array.from(s.realDeadlines(),x=>x.id),['actual']);
});
test('confirmed mail deadline saves Hong Kong timezone and deduplicates its source',()=>{
  const {s,fields}=setup();s.saveConfirmedDeadline('');assert.equal(s.workspaceState.miscTasks[0].dueAt,'2026-10-09T04:00:00.000Z');
  fields.ddlTitle.value='Updated';s.saveConfirmedDeadline('');assert.equal(s.workspaceState.miscTasks.length,1);assert.equal(s.workspaceState.miscTasks[0].title,'Updated');
});
test('timetable import preserves personal Plans and rejects invalid imports atomically',async()=>{
  const {s}=setup();const sample={course:'ABC1000',title:'Example',date:'2026-08-31',time:'10:00',end:'11:00',until:'2026-12-05',location:'Room'};
  await s.importTimetableFile({files:[{size:100,text:async()=>JSON.stringify([sample])}]});assert.equal(s.workspaceState.events.length,2);assert.equal(s.workspaceState.events[0].id,'personal-plan');
  await s.importTimetableFile({files:[{size:100,text:async()=>JSON.stringify([sample])}]});assert.equal(s.workspaceState.events.length,2);
  await s.importTimetableFile({files:[{size:100,text:async()=>JSON.stringify([{...sample,end:'09:00'}])}]});assert.equal(s.workspaceState.events.length,2);
});
