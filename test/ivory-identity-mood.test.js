import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveProjectColors,resolveProjectFonts,contrast} from '../public/ivory/identity.js';
import {safeAssetUrl,safeCssFont} from '../public/ivory/renderers/ivory.js';
import {renderMoodExperience} from '../public/ivory/weather.js';
import {DEFAULTS} from '../public/ivory/mood-engine.js';

for(const [primary,secondary] of [['#173b55','#e2d2b8'],['#f1dba6','#173b55'],['#367c76','#bb526c'],['#ffffff','#ffff00']])test(`identity keeps both sources ${primary}/${secondary} with AA text counterparts`,()=>{
 const roles=resolveProjectColors({primary,secondary});
 assert.equal(roles.primary,primary);assert.equal(roles.secondary,secondary);
 assert.ok(contrast(roles.onPrimary,primary)>=4.5);assert.ok(contrast(roles.onSecondary,secondary)>=4.5);
 assert.ok(contrast(roles.accent,'#f5f5f7')>=4.5);
 assert.ok(contrast('#5d6057',roles.primarySoft)>=4.5);
});
test('absent secondary stays the primary, never an invented project color',()=>{assert.equal(resolveProjectColors({primary:'#123456'}).secondary,'#123456');});
for(const ext of ['woff2','woff','ttf','otf'])test(`${ext} files get safe @font-face independent of upload filename`,()=>{
 const url=`/public/client/project/cap/assets/font.${ext}`;
 const resolved=resolveProjectFonts({primary:{family:"Primary.Name 'v2'",asset:{url}}},safeAssetUrl,safeCssFont);
 assert.match(resolved.faces,/font-family:'ivory-project-primary'/);assert.ok(resolved.faces.includes(url));
 assert.equal(resolved.secondary,resolved.primary);assert.ok(!resolved.faces.includes('Primary.Name'));
});
test('distinct font files with the same published family cannot overwrite roles',()=>{
 const fonts=resolveProjectFonts({primary:{family:'Shared Name',asset:{url:'/public/c/p/cap/assets/one.ttf'}},secondary:{family:'Shared Name',asset:{url:'/public/c/p/cap/assets/two.woff'}}},safeAssetUrl,safeCssFont);
 assert.notEqual(fonts.primary,fonts.secondary);assert.equal(fonts.faces.match(/@font-face/g).length,2);
});
test('same-file secondary has one face; missing assets use a system-safe fallback',()=>{
 const primary={family:'Uploaded',asset:{url:'/public/c/p/cap/assets/one.ttf'}};
 assert.equal(resolveProjectFonts({primary,secondary:primary},safeAssetUrl,safeCssFont).faces.match(/@font-face/g).length,1);
 assert.equal(resolveProjectFonts({},safeAssetUrl,safeCssFont).primary,'system-ui');
 assert.equal(resolveProjectFonts({primary:{family:"';color:red",asset:{url:'https://outside/font.ttf'}}},safeAssetUrl,safeCssFont).faces,'');
});
test('weather is a compact floating entry and contextual panel, not a dialog or footer action',()=>{
 const html=renderMoodExperience();assert.match(html,/aria-label="Météo du projet"/);assert.match(html,/<section[^>]+hidden/);
 assert.doesNotMatch(html,/<dialog|Partager mon ressenti|aria-modal/);assert.equal((html.match(/data-mood-value=/g)||[]).length,5);
 assert.equal(renderMoodExperience({enabled:false}),'');assert.equal(renderMoodExperience({status:'suspended'}),'');
});
test('published weather question is escaped and the original weather choices are preserved',()=>{
 const html=renderMoodExperience({question:'<script>Question</script>'});assert.ok(html.includes('&lt;script&gt;'));assert.doesNotMatch(html,/<script>/);
 for(const label of ['Orageux','Nuageux','Couvert','Éclairci','Ensoleillé'])assert.ok(html.includes(label));
});
test('shared solicitation remains the timing authority with 35-second exposure fallback',()=>{
 assert.equal(DEFAULTS.fallbackExposureMs,35000);assert.equal(DEFAULTS.quietMs,1500);
 const source=readFileSync(new URL('../public/ivory/weather.js',import.meta.url),'utf8');
 assert.match(source,/createMoodSolicitationEngine/);assert.match(source,/storageKeyPrefix:'storm_mood'/);
 const nudge=source.slice(source.indexOf('onNudge('),source.indexOf('});engine.start()'));
 assert.match(nudge,/is-wave/);assert.match(nudge,/is-introduced/);assert.doesNotMatch(nudge,/open\(|panel.hidden=false/);
 assert.match(source,/actions.submitMood\?\.\(\{value\}\)/);
});
test('reduced motion disables the wave and the weather panel adds no decorative glass',()=>{
 const css=readFileSync(new URL('../public/ivory/ivory.css',import.meta.url),'utf8');
 assert.match(css,/\.mood-fab\.is-wave \{animation:none!important\}/);
 assert.match(css,/@keyframes moodWave/);assert.doesNotMatch(css,/\.mood-panel[^}]*backdrop-filter/);
});


test('all weather typography uses the primary font role, including options and status',()=>{
 const css=readFileSync(new URL('../public/ivory/ivory.css',import.meta.url),'utf8').split('/* One contextual weather control')[1];
 assert.doesNotMatch(css,/--detail/);
 for(const selector of ['mood-label','mood-question','mood-options span','mood-note','mood-thanks'])assert.match(css,new RegExp('\\.'+selector+' \\{[^}]*var\\(--body\\)'));
});
test('selected weather choice uses resolved secondary foreground with inherited icon stroke',()=>{
 const css=readFileSync(new URL('../public/ivory/ivory.css',import.meta.url),'utf8');
 assert.match(css,/\.mood-options button\.is-selected \{background:var\(--green\);border-color:var\(--green\);color:var\(--on-secondary\);opacity:1\}/);
 assert.match(css,/\.mood-fab svg,\.mood-options svg \{[^}]*stroke:currentColor/);
 const source=readFileSync(new URL('../public/ivory/weather.js',import.meta.url),'utf8');
 assert.ok(source.indexOf("button.classList.add('is-selected')")<source.indexOf('await actions.submitMood'));
 assert.match(source,/if\(!response\?\.ok\)\{button.classList.remove\('is-selected'\)/);
});
