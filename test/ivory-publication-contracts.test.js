import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/domain/publication/compiler.js';
import { renderNews, renderNewsArticle, renderHome, renderProject, renderAmbassadors, safeLink } from '../public/ivory/renderers/ivory.js';

const context={projectId:'neutral',revision:1,generatedAt:'2026-10-06T07:00:00Z'};
const candidate=()=>({expressionProfile:'editorial',project:{name:'Projet collectif'},identity:{theme:'ivory'},contentLocale:'fr'});
const published=c=>compile(c,context).manifest.content;
const publicAsset=a=>({...a,url:'/public/client/project/cap/'+a.url});

test('published news tag is exact escaped editorial metadata on lead, rows, detail and featured home',()=>{
 const first={id:'one',title:'Une rencontre',date:'2026-10-06',tag:'Vie & gestes <partagés>',summary:'Texte'},second={...first,id:'two'};
 for(const html of [renderNews({items:[first]}),renderNews({items:[{},second]}),renderNewsArticle(first),renderHome({featured:{title:first.title,source:{id:first.id}}},{news:{items:[first]}})]){
  assert.ok(html.includes('Vie &amp; gestes &lt;partagés&gt;'));
  assert.ok(html.includes('news-meta'));
 }
 assert.ok(!renderNewsArticle({title:'Sans tag'}).includes('news-meta'));
});

test('phone formats compile safely and the existing public contact path accepts tel',()=>{
 for(const [raw,number] of [['01 23 45 67 89','0123456789'],['+33 (1) 23-45.67.89','+33123456789'],['+44 20 7946 0958','+442079460958']]){
  const c=candidate();c.ambassadors=[{name:'Camille',contactChannel:'phone',contactValue:raw}];
  const roster=published(c).ambassadors.roster;
  assert.equal(roster[0].contactHref,'tel:'+number);
  assert.ok(renderAmbassadors({roster}).includes(`href="tel:${number}"`));
 }
});
test('invalid phones and alternate schemes never become public contact links',()=>{
 for(const raw of ['javascript:123456789','data:123456789','tel:0123456789','https://example.test','bonjour','123','+12+3456789','1234567\n890','1234567890123456','0123456789;ext=1']){
  const c=candidate();c.ambassadors=[{contactChannel:'phone',contactValue:raw}];
  assert.equal(published(c).ambassadors.roster[0].contactHref,'',raw);
  if(!/^(tel:|https:\/\/)/.test(raw))assert.equal(safeLink(raw),'',raw);
 }
 const c=candidate();c.ambassadors=[{contactable:false,contactChannel:'phone',contactValue:'0123456789'}];
 assert.equal(published(c).ambassadors.roster[0].contactHref,'');
});

for(const count of [0,1,3])test(`image publication retains ${count} ordered media with alt and first-asset compatibility`,()=>{
 const c=candidate();c.assetContentTypes={a:'image/png',b:'image/png',c:'image/png'};
 const media=['a','b','c'].slice(0,count).map((assetId,position)=>({assetId,position,alt:'Vue '+assetId})).reverse();
 c.leProjet={sections:[{id:'image',sectionType:'image',enabled:true,media,payload:{caption:'Les vues'}}]};
 const before=structuredClone(c),section=published(c).project.sections[0];
 assert.equal(section.items.length,count);
 assert.deepEqual(section.items.map(a=>a.alt),['a','b','c'].slice(0,count).map(a=>'Vue '+a));
 assert.deepEqual(section.asset,section.items[0]||null);assert.deepEqual(c,before);
 const rendered=renderProject({sections:[{...section,asset:section.asset&&publicAsset(section.asset),items:section.items.map(publicAsset)}]});
 assert.equal((rendered.match(/data-media=/g)||[]).length,count);
 if(count===1)assert.ok(rendered.includes('wide-art'));
 if(count===3)assert.ok(rendered.includes('data-rail'));
});
test('historical asset-only image publications still render one wide image',()=>{
 assert.ok(renderProject({sections:[{type:'image',asset:{url:'/public/client/project/cap/assets/a.png',alt:'Ancienne vue'}}]}).includes('Ancienne vue'));
});

for(const type of ['timeline','team'])test(`${type}: absent, enabled, disabled marker controls placement without duplicating content`,()=>{
 for(const enabled of [undefined,true,false]){
  const c=candidate();c.leProjet={sections:[{id:'text',sectionType:'text',payload:{body:'Avant'}},...(enabled===undefined?[]:[{id:'marker',sectionType:type,enabled}]),{id:'last',sectionType:'text',payload:{body:'Après'}}]};
  const project=published(c).project;
  assert.equal(project[type==='timeline'?'showTimeline':'showTeam'],enabled!==false);
  const html=renderProject(project,{milestones:[{label:'JALON_UNIQUE'}]},{members:[{name:'MEMBRE_UNIQUE'}]});
  const value=type==='timeline'?'JALON_UNIQUE':'MEMBRE_UNIQUE';
  assert.equal(html.split(value).length-1,enabled===false?0:1);
  if(enabled===true)assert.ok(html.indexOf('Avant')<html.indexOf(value)&&html.indexOf(value)<html.indexOf('Après'));
  if(enabled===undefined)assert.ok(html.indexOf(value)>html.indexOf('Après'));
 }
});

test('roster assigns explicit context/contact columns independent of optional fields',()=>{
 const roster=[{name:'Avec',tag:'Transmission',contactHref:'tel:0123456789'},{name:'Sans tag',contactHref:'mailto:a@example.test'},{name:'Sans contact',tag:'Rencontres'},{name:'Sans les deux'}];
 const html=renderAmbassadors({roster});
 assert.equal((html.match(/class="person-identity"/g)||[]).length,4);
 assert.equal((html.match(/class="person-context"/g)||[]).length,2);
 assert.equal((html.match(/text-link person-contact/g)||[]).length,2);
});
