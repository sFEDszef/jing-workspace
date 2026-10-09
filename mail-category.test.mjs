import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
const fn=html.slice(html.indexOf('function classifyWorkspaceMail('),html.indexOf("let currentMailCategory="));
const classify=vm.runInNewContext(fn+'\nclassifyWorkspaceMail');
test('Moodle and all four courses go to Academic',()=>{
  assert.equal(classify({sender:'Teacher (via Moodle)',title:'New course file'}).category,'Academic');
  for(const code of ['EDS 6001','EDS6019','ECE6156','CUI 6078'])assert.equal(classify({title:code+' new content'}).category,'Academic');
  assert.equal(classify({title:'Document shared: Reading Week Group Activity-worksheet'}).category,'Academic');
});
test('course deadlines retain both Academic and Deadline membership',()=>{
  const result=classify({title:'EDS6001 assignment submission deadline'});assert.equal(result.category,'Academic');assert.equal(result.hasDeadline,true);
});
test('activities are FYI; school administration is Admin, not Academic',()=>{
  assert.equal(classify({sender:'School Office',title:'AI Graphic Design Workshop invitation'}).category,'FYI');
  assert.equal(classify({title:'Scholarship application deadline'}).category,'Admin');
  assert.equal(classify({title:'Institutional fees payment due date'}).category,'Admin');
  assert.equal(classify({title:'Curriculum Leadership lecture notes'}).category,'Academic');
});
