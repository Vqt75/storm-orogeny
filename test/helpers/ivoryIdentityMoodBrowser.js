import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Real production shell/runtime/styles, actual public API publication and assets.
// Browser tooling and visual fixtures are provided outside product dependencies.
export async function verifyIdentityMoodBrowser({base,publication,label,colors,secondary=false,baseline=false,weather=false}) {
 const {chromium}=await import(process.env.IVORY_BROWSER_MODULE);
 const browser=await chromium.launch({headless:true});
 const out=process.env.IVORY_EVIDENCE_DIR; if(out)fs.mkdirSync(out,{recursive:true});
 const reports=[];
 try {
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(/\.(woff2?|ttf|otf)(\?|$)/.test(r.url()))requests.push({url:new URL(r.url()).pathname,status:r.status()});});
  if(baseline){
   for(const file of ['ivory.css','renderers/ivory.js'])await page.route('**/ivory/'+file,r=>r.fulfill({path:path.join(process.env.IVORY_BASELINE_DIR,file),contentType:file.endsWith('.css')?'text/css':'text/javascript'}));
  }
  const settle=async()=>{await page.waitForSelector('#main h1');await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'));await page.locator('.brand img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));};
  const metric=async()=>{
   const session=await context.newCDPSession(page);await session.send('DOM.enable');await session.send('CSS.enable');
   const {root}=await session.send('DOM.getDocument');const platform={};
   for(const [role,selector] of [['primary','#main h1'],['detail','.news-meta']]){
    const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector});
    if(nodeId)platform[role]=(await session.send('CSS.getPlatformFontsForNode',{nodeId})).fonts;
   }await session.detach();
   return {...await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,primary:getComputedStyle(document.querySelector('#main h1')).fontFamily,body:getComputedStyle(document.querySelector('.ivory-site')).fontFamily,detail:document.querySelector('.news-meta')&&getComputedStyle(document.querySelector('.news-meta')).fontFamily,fonts:[...document.fonts].map(f=>({family:f.family.replace(/["']/g,''),status:f.status})),colors:{primary:getComputedStyle(document.querySelector('.ivory-site')).getPropertyValue('--primary'),secondary:getComputedStyle(document.querySelector('.ivory-site')).getPropertyValue('--green'),weather:getComputedStyle(document.querySelector('.mood-fab')||document.body).backgroundColor},brands:[...document.querySelectorAll('.brand')].map(n=>({text:n.textContent,images:[...n.querySelectorAll('img')].map(i=>({loaded:i.complete&&i.naturalWidth>0,natural:[i.naturalWidth,i.naturalHeight],rect:[i.getBoundingClientRect().width,i.getBoundingClientRect().height]}))})),buttonsWithArrows:[...document.querySelectorAll('button')].filter(b=>/[→↗›]/.test(b.textContent)).length})),platform,requests,errors};
  };
  const capture=async name=>{if(out)await page.screenshot({path:path.join(out,name+'.png')});};
  await page.goto(base+publication.url+'#home');await settle();
  let metrics=await metric();reports.push({label,viewport:'desktop',baseline,...metrics});await capture(label+'-desktop');
  assert.equal(metrics.overflow,false);assert.deepEqual(errors,[]);
  if(!baseline){
   assert.ok(metrics.primary.includes('ivory-project-primary'));assert.ok(metrics.body.includes('ivory-project-primary'));
   assert.ok(metrics.detail.includes(secondary?'ivory-project-secondary':'ivory-project-primary'));
   assert.ok(metrics.fonts.some(f=>f.family==='ivory-project-primary'&&f.status==='loaded'));
   if(secondary)assert.ok(metrics.fonts.some(f=>f.family==='ivory-project-secondary'&&f.status==='loaded'));
   assert.ok(metrics.platform.primary.some(f=>f.isCustomFont&&f.glyphCount>0));
   assert.ok(metrics.platform.detail.some(f=>f.isCustomFont&&f.glyphCount>0));
   assert.ok(requests.length>0&&requests.every(r=>r.status===200));
   assert.equal(metrics.colors.primary.trim(),colors[0].toLowerCase());assert.equal(metrics.colors.secondary.trim(),colors[1].toLowerCase());
   for(const brand of metrics.brands){assert.equal(brand.text,'Maison du Rivage');for(const i of brand.images){assert.equal(i.loaded,true);assert.ok(Math.abs(i.rect[0]/i.rect[1]-i.natural[0]/i.natural[1])<.03);}}
   assert.equal(metrics.buttonsWithArrows,0);
   await page.setViewportSize({width:390,height:844});await settle();metrics=await metric();reports.push({label,viewport:'mobile',...metrics});assert.equal(metrics.overflow,false);assert.ok(await page.locator('#menu-open').isVisible());
   const bounds=await page.locator('.header .brand-name').boundingBox();assert.ok(bounds&&bounds.width>=55&&bounds.x+bounds.width<=390);
   await capture(label+'-mobile');
   await page.locator('#menu-open').click();await page.waitForSelector('#menu-dialog[open]');assert.equal(await page.locator('#menu-title').textContent(),'Maison du Rivage');await capture(label+'-mobile-menu');await page.locator('#menu-dialog [data-close]').click();
  }
  if(weather&&!baseline){
   await page.setViewportSize({width:1440,height:900});
   await context.clearCookies();await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();sessionStorage.setItem('storm_mood_attention_threshold','40000');});
   await page.clock.install();await page.reload();await settle();
   const fab=page.locator('.mood-fab'),panel=page.locator('.mood-panel');
   assert.equal(await panel.isVisible(),false);assert.equal(await fab.getAttribute('aria-expanded'),'false');await capture('weather-01-initial-desktop');
   // Real shared engine clock, no renderer hook or shortened config. No scroll
   // or meaningful click: fallback exposure must be reached, at a calm moment.
   await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
   await page.clock.runFor(24000);assert.equal(await fab.evaluate(n=>n.classList.contains('is-introduced')),false);
   await page.clock.runFor(1000);assert.equal(await panel.isVisible(),false);
   await page.clock.runFor(15500);assert.equal(await fab.evaluate(n=>n.classList.contains('is-wave')),true);assert.equal(await panel.isVisible(),false);
   assert.equal(await fab.getAttribute('aria-expanded'),'false');await capture('weather-02-label-wave');
   for(const ms of [200,300,400]){await page.clock.runFor(ms);await capture('weather-wave-'+ms);}
   await page.clock.runFor(2600);assert.equal(await fab.evaluate(n=>n.classList.contains('is-introduced')),false);
   await page.reload();await settle();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.clock.runFor(45000);
   assert.equal(await fab.evaluate(n=>n.classList.contains('is-introduced')),false,'one nudge per day');
   await fab.click();await page.clock.runFor(200);assert.equal(await panel.isVisible(),true);assert.equal(await page.locator('dialog[open]').count(),0);await capture('weather-03-panel-desktop');
   await page.keyboard.press('Escape');await page.clock.runFor(200);assert.equal(await panel.isVisible(),false);assert.equal(await fab.evaluate(n=>n===document.activeElement),true);
   await page.setViewportSize({width:390,height:844});await page.mouse.move(0,0);await page.locator('#main h1').focus();await capture('weather-04-initial-mobile');
   await fab.click();await page.clock.runFor(200);await capture('weather-05-panel-mobile');
   let submissions=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/telemetry')&&JSON.parse(r.postData()).event==='mood_feedback')submissions++;});
   await page.locator('[data-mood-value="4"]').click();await page.waitForSelector('.mood-thanks');await capture('weather-06-thanks-mobile');
   assert.equal(submissions,1);await page.clock.runFor(1100);await page.reload();await settle();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.clock.runFor(45000);
   assert.equal(await fab.evaluate(n=>n.classList.contains('is-wave')),false);await fab.click();await page.clock.runFor(200);assert.equal(await page.locator('.mood-thanks').count(),1);assert.equal(await page.locator('[data-mood-value]').count(),0);
   // Existing global and legacy answered/nudge keys remain authoritative.
   await page.evaluate(()=>{localStorage.clear();localStorage.setItem('xyz_mood_last_answered',new Date().toISOString().slice(0,10));});await page.reload();await settle();assert.equal(await fab.evaluate(n=>n.classList.contains('is-answered')),true);
   await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();sessionStorage.setItem('storm_mood_attention_threshold','40000');});await page.reload();await settle();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.clock.runFor(40500);
   assert.equal(await fab.evaluate(n=>n.classList.contains('is-introduced')),true);assert.equal(await fab.evaluate(n=>n.classList.contains('is-wave')),false);assert.equal(await panel.isVisible(),false);await capture('weather-07-reduced-mobile');
   // Storage getter failures are handled without breaking render/manual entry.
   await page.addInitScript(()=>{for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{get(){throw new Error('unavailable');}});});
   await page.reload();await settle();await fab.click();await page.clock.runFor(200);assert.equal(await panel.isVisible(),true);assert.deepEqual(errors,[]);
   reports.push({weather:{nudgeDoesNotOpen:true,onePerDay:true,answeredSuppresses:true,legacyAnsweredSuppresses:true,reducedMotionNoWave:true,storageFailureManualOpen:true,submissions}});
  }
  if(out)fs.writeFileSync(path.join(out,label+'-metrics.json'),JSON.stringify(reports,null,2));
  await context.close();return reports;
 }finally{await browser.close();}
}
