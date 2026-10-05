import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';
import { seedTenantMembership, seedProjectMembership } from './helpers/memberships.js';
import { findCurrentAccess, decryptCurrentCapability } from '../src/domain/publicAccess/repository.js';
import { removeProjectIdentityLogo } from '../src/domain/project-setup/repository.js';
import { renderHome, renderProject, renderSpaces, renderNews, renderNewsArticle, renderAmbassadors, renderQuestions, resultMarkup } from '../public/ivory/renderers/ivory.js';

const config=loadConfig(),pool=getPool(config),storageAdapter=createStorageAdapter(config);
let server,base,actor,outsider,project;
const r=text=>[{text}],png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
async function request(route,method='GET',data,user=actor){
 const headers={'X-Storm-Dev-User':user};if(data!==undefined)headers['Content-Type']='application/json';
 const response=await fetch(base+route,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});
 const text=await response.text();return {status:response.status,data:text?JSON.parse(text):null};
}
async function api(route,method,data,status=200){const result=await request(route,method,data);assert.equal(result.status,status,JSON.stringify(result.data));return result.data;}
const root=()=>`/api/projects/${project}`;
async function identity(){return (await api(root()+'/context')).identity;}
async function patchSection(key,fields){const before=await api(root()+'/studio/section-content/'+key);return api(root()+'/studio/section-content/'+key,'PATCH',{fields,version:before.version??undefined});}
async function upload(route,field,bytes,mime,extra={}){const fd=new FormData();fd.append(field,new Blob([bytes],{type:mime}),'fixture.'+(mime==='image/png'?'png':'woff2'));for(const [k,v] of Object.entries(extra))fd.append(k,v);const response=await fetch(base+root()+route,{method:'POST',headers:{'X-Storm-Dev-User':actor},body:fd});assert.equal(response.status,201);return response.json();}
async function published(){const access=await findCurrentAccess(pool,project);const capability=decryptCurrentCapability(access,config.publicAccessEncryptionKey);const url=`/public/${access.client_slug}/${access.project_slug}/${capability}`;const response=await fetch(base+url+'/manifest');assert.equal(response.status,200);return {manifest:await response.json(),url};}
function htmlFor(m){const c=m.content;return [renderHome(c.home,c,m.project.name),renderProject(c.project,c.timeline,c.team),renderSpaces(c.spaces),...c.spaces.items.map(s=>renderSpaces(c.spaces,s.id)),renderNews(c.news),...c.news.items.map(renderNewsArticle),renderAmbassadors(c.ambassadors),renderQuestions(c.questions,{corpusState:'CORPUS_READY'},c),...c.questions.items.filter(q=>q.title.trim()&&q.answer.trim()).map(q=>resultMarkup({state:'covered',sourceQuestionId:q.id,answer:q.answer},c.questions.items,c))].join('\n');}
test.before(async()=>{
 await runMigrations();
 const {rows:[tenant]}=await pool.query("insert into tenants(name) values('Contract audit tenant') returning id");
 const {rows:[user]}=await pool.query("insert into users(email,display_name) values('contract-owner@example.test','Contract Owner') returning id");actor=user.id;
 const {rows:[other]}=await pool.query("insert into users(email,display_name) values('contract-viewer@example.test','Contract Viewer') returning id");outsider=other.id;
 await seedTenantMembership(pool,{tenantId:tenant.id,userId:actor,permissionBundle:'organization_admin'});
 await seedTenantMembership(pool,{tenantId:tenant.id,userId:outsider,permissionBundle:'member'});
 const {rows:[client]}=await pool.query("insert into clients(tenant_id,name,normalized_slug) values($1,'Collectif Rivage','collectif-rivage') returning id",[tenant.id]);
 server=http.createServer(createApp({pool,config,storageAdapter,logger:{info(){},warn(){},error(){}}}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
 const created=await api('/api/projects','POST',{name:'Maison du Rivage',clientId:client.id,contentLocale:'fr',workspaceLocale:'en',identity:{theme:'ivory',primaryColor:'#824631',secondaryColor:'#34483e'},modules:{faq:true,actu:true},invites:[]},201);project=created.id;
 await seedProjectMembership(pool,{tenantId:tenant.id,projectId:project,userId:outsider,permissionBundle:'contributor'});
});
test.after(async()=>{if(project){const {rows:[p]}=await pool.query('select tenant_id from projects where id=$1',[project]);if(p){await pool.query('delete from project_publications where project_id=$1',[project]);await pool.query('delete from project_public_access where project_id=$1',[project]);await pool.query('delete from projects where id=$1',[project]);await pool.query('delete from clients where tenant_id=$1',[p.tenant_id]);await pool.query('delete from tenant_memberships where tenant_id=$1',[p.tenant_id]);await pool.query('delete from users where id=any($1::uuid[])',[[actor,outsider]]);await pool.query('delete from tenants where id=$1',[p.tenant_id]);}}await new Promise(resolve=>server?.close(resolve));await closePool();});

test('logo removal repository scopes tenant/project/version, detaches without deleting assets',async()=>{
 const calls=[];const result=await removeProjectIdentityLogo({query:async(sql,args)=>{calls.push({sql,args});return {rows:[{version:4}]};}},{tenantId:'tenant',projectId:'project',expectedVersion:3,userId:'actor'});
 assert.equal(result.version,4);assert.deepEqual(calls[0].args,['actor','tenant','project',3]);assert.match(calls[0].sql,/tenant_id = \$2 and project_id = \$3 and version = \$4/);assert.doesNotMatch(calls[0].sql,/delete/i);
});

test('complete Studio APIs → Snapshot → Candidate → public Manifest → production consumers; immutable N/N+1 across all seven domains',async()=>{
 const logo=await upload('/logo','logo',png,'image/png');
 const asset=await upload('/studio/assets','file',png,'image/png',{kind:'narrative_media'});
 const assetId=asset.assetId;
 assert.ok(assetId);
 const font=fs.readFileSync(path.join(process.cwd(),'node_modules/@fontsource/roboto/files/roboto-latin-400-normal.woff2'));
 await upload('/identity/fonts/primary','font',font,'font/woff2',{fontName:'Rivage Primary'});
 await upload('/identity/fonts/secondary','font',font,'font/woff2',{fontName:'Rivage Detail'});
 await api(root()+'/expression-profile','PATCH',{expressionProfile:'editorial',version:(await identity()).version});
 await patchSection('homepage',{message:'Faire et transmettre',askPrompt:'Vos questions sur la Maison',showMilestones:true,showAskPrompt:true,featuredArticleMode:'latest',featuredArticleId:null});
 await patchSection('le_projet',{title:'Un lieu de savoir-faire',body:'Apprendre avec les habitants.'});
 const payloads={focus:{title:'Pratiquer',body:'Un geste partagé.'},text:{title:'Comprendre',body:'Le temps de comprendre.'},quote:{quote:'La rencontre transmet.',attribution:'Le collectif'},keyFigures:{title:'Ensemble',items:[{value:'8',label:'Participants'}]},choices:{title:'Nos choix',items:[{title:'Petits groupes',body:'Du temps pour chacun.'}]},image:{caption:'Le grand atelier'},gallery:{title:'Les lieux'},timeline:{},team:{}};
 let pos=0;for(const [sectionType,payload] of Object.entries(payloads))await api(root()+'/studio/narrative-sections','POST',{sectionType,payload,position:pos++,enabled:true,media:['image','gallery'].includes(sectionType)?[{assetId,alt:'Atelier au bord de la rivière',position:0}]:[]},201);
 const milestone=await api(root()+'/studio/milestones','POST',{status:'current',dateLabel:'Octobre',label:'Ouvrir les ateliers',description:'Les premières rencontres.',position:0},201);
 await api(root()+'/studio/milestones','POST',{status:'future',dateLabel:'Novembre',label:'Partager les récits',description:'Les traces des rencontres.',position:1},201);
 await api(root()+'/studio/team-members','POST',{name:'Lou Martin',title:'Coordination',badge:'Programme',photoAssetId:assetId,position:0},201);
 const space=await api(root()+'/studio/spaces','POST',{name:'Grand atelier',location:'Rez-de-chaussée',description:'Une table pour pratiquer.',status:'delivered',usages:['Collaborer'],media:[{kind:'view',assetId,label:'Vue de l’atelier',alt:'La table commune',position:0}],position:0},201);
 const article=await api(root()+'/studio/articles','POST',{title:'La terre et les gestes',tag:'Rencontres',publicationDate:'2026-10-05',chapeauRuns:r('Une première matinée.'),position:0,blocks:[{blockType:'heading',runs:r('Prendre le temps'),position:0},{blockType:'paragraph',runs:[{text:'Une méthode ',bold:true},{text:'partagée.',italic:true,underline:true,href:'https://example.test/programme'}],position:1},{blockType:'image',imageAssetId:assetId,position:2}]},201);
 const ambassador=await api(root()+'/studio/ambassadors','POST',{name:'Camille',role:'Ateliers',tag:'Transmission',photoAssetId:assetId,contactable:true,contactChannel:'email',contactValue:'camille@example.test',position:0},201);
 const question=await api(root()+'/studio/questions','POST',{question:'Comment participer ?',answerRuns:r('Contactez Camille pour choisir un atelier.'),position:0},201);
 await api(root()+'/studio/questions','POST',{question:' ',answerRuns:r('Invisible'),position:1},201);
 const n=await api(root()+'/publications','POST',undefined,201),publicN=await published();
 assert.deepEqual(publicN.manifest,n.manifest);
 const {rows:[storedN]}=await pool.query('select snapshot,candidate,manifest from project_publications where id=$1',[n.id]);
 assert.equal(storedN.snapshot.homepage.message,'Faire et transmettre');assert.equal(storedN.candidate.spaces[0].location,'Rez-de-chaussée');assert.equal(storedN.manifest.branding.logo.url,`assets/${logo.assetId}.png`);
 assert.equal(n.manifest.presentation.expressionProfile,'editorial');assert.equal(n.manifest.branding.fonts.primary.family,'Rivage Primary');assert.equal(n.manifest.branding.fonts.secondary.family,'Rivage Detail');assert.equal(n.manifest.content.project.sections.length,9);
 const rendered=htmlFor(n.manifest);for(const value of ['Faire et transmettre','Un lieu de savoir-faire','Grand atelier','Rez-de-chaussée','La terre et les gestes','Camille','Comment participer ?','Contactez Camille','Nos choix','Participants','Le collectif','Lou Martin'])assert.ok(rendered.includes(value),value);assert.ok(!rendered.includes('Invisible'));assert.ok(!JSON.stringify(n.manifest).includes('workspaceLocale'));
 // A real browser is provided only by temporary CI tooling, never a product dependency.
 if(process.env.IVORY_BROWSER_MODULE){const {chromium}=await import(process.env.IVORY_BROWSER_MODULE);const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+publicN.url);await page.waitForSelector('#main h1');for(const [hash,value] of [['home','Faire et transmettre'],['timeline','Un lieu de savoir-faire'],['spaces','Grand atelier'],['news','La terre et les gestes'],['ambassadors','Camille'],['questions','Comment participer ?']]){await page.goto(base+publicN.url+'#'+hash);await page.waitForFunction(v=>document.querySelector('#main')?.textContent.includes(v),value);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.IVORY_EVIDENCE_DIR){fs.mkdirSync(process.env.IVORY_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.IVORY_EVIDENCE_DIR,hash+'.png')});}}await page.locator('#question-input').fill('Comment participer ?');await page.locator('#question-form button').click();await page.waitForSelector('[data-state=covered]');assert.ok((await page.locator('.answer-text').textContent()).includes('Contactez Camille'));await page.goto(base+publicN.url+'#timeline');await page.waitForSelector('[data-media]');await page.locator('[data-media]').first().click();await page.waitForSelector('#media-dialog[open]');await page.locator('#media-dialog [data-close]').click();await page.setViewportSize({width:390,height:844});await page.locator('#menu-open').click();await page.waitForSelector('#menu-dialog[open]');await page.locator('#menu-dialog [data-close]').click();assert.deepEqual(errors,[]);await browser.close();}
 const frozen=JSON.stringify(storedN);
 await patchSection('homepage',{...storedN.snapshot.homepage,message:'Transmettre demain'});
 await patchSection('le_projet',{title:'Un récit enrichi',body:'Une nouvelle rencontre.'});
 await api(root()+'/studio/spaces/'+space.id,'PATCH',{...space,name:'Atelier des voisins'});
 await api(root()+'/studio/articles/'+article.id,'PATCH',{...article,title:'Les prochains gestes'});
 await api(root()+'/studio/ambassadors/'+ambassador.id,'PATCH',{...ambassador,role:'Rencontres ouvertes'});
 await api(root()+'/studio/questions/'+question.id,'PATCH',{...question,question:'Comment rejoindre les ateliers ?'});
 await api(root()+'/studio/milestones/'+milestone.id,'PATCH',{...milestone,label:'Accueillir les voisins'});
 await api(root()+'/expression-profile','PATCH',{expressionProfile:'panoramic',version:(await identity()).version});
 const v=(await identity()).version;
 assert.equal((await request(root()+'/logo','DELETE',{version:v},outsider)).status,403);
 assert.equal((await request(root()+'/logo','DELETE',{})).status,400);
 assert.equal((await request(root()+'/logo','DELETE',{version:v-1})).status,409);
 assert.equal((await request(root()+'/logo','DELETE',{version:v})).status,204);
 assert.equal((await identity()).logoAssetId,null);
 assert.equal((await identity()).version,v+1);
 assert.deepEqual((await published()).manifest,n.manifest,'Studio edits cannot mutate active N');
 assert.equal((await fetch(base+publicN.url+'/assets/'+logo.assetId+'.png')).status,200,'published N keeps removed draft logo asset');
 const next=await api(root()+'/publications','POST',undefined,201);assert.equal(next.revision,n.revision+1);
 assert.deepEqual((await published()).manifest,next.manifest);
 assert.equal(next.manifest.branding.logo,null);assert.equal(next.manifest.presentation.expressionProfile,'panoramic');
 const nextHtml=htmlFor(next.manifest);for(const value of ['Transmettre demain','Un récit enrichi','Atelier des voisins','Les prochains gestes','Rencontres ouvertes','Comment rejoindre les ateliers ?','Accueillir les voisins'])assert.ok(nextHtml.includes(value),value);
 const {rows:[historic]}=await pool.query('select snapshot,candidate,manifest from project_publications where id=$1',[n.id]);assert.equal(JSON.stringify(historic),frozen);
 if(process.env.IVORY_EVIDENCE_DIR)fs.writeFileSync(path.join(process.env.IVORY_EVIDENCE_DIR,'publication-matrix.json'),JSON.stringify({N:storedN,Nplus1:next.manifest},null,2));
});
