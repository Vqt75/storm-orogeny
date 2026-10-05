import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isExpressionProfile, EXPRESSION_PROFILES } from '../src/domain/projects/expressionProfile.js';
import { buildCandidate } from '../src/domain/publication/candidate.js';
import { compile } from '../src/domain/publication/compiler.js';
import { updateProjectExpressionProfile } from '../src/domain/project-setup/repository.js';

const context={projectId:'neutral',revision:1,generatedAt:'2026-10-05T12:00:00Z'};
function snapshot(profile){return {expressionProfile:profile,project:{name:'Projet collectif'},identity:{theme:'ivory',primaryColor:'#123456',fontPrimary:'Custom'},contentLocale:'fr',workspaceLocale:'de'};}
for(const profile of EXPRESSION_PROFILES){
  test(`publication transports ${profile} exactly once without changing branding`,()=>{
    const source=snapshot(profile), before=structuredClone(source);
    const candidate=buildCandidate(source);
    assert.equal(candidate.expressionProfile,profile);
    assert.equal(candidate.workspaceLocale,undefined);
    const {manifest}=compile(candidate,context);
    assert.deepEqual(manifest.presentation,{expressionProfile:profile});
    assert.equal(JSON.stringify(manifest).match(/"expressionProfile"/g).length,1);
    assert.equal(manifest.branding.colors.primary,'#123456');
    assert.equal(manifest.branding.fonts.primary.family,'Custom');
    assert.equal(manifest.project.name,source.project.name);
    assert.equal(JSON.stringify(manifest).includes('workspaceLocale'),false);
    assert.deepEqual(source,before);
  });
}
test('unknown, missing and noncanonical profiles rejected without identity inference',()=>{
  for(const value of [undefined,null,'','EDITORIAL',' editorial','custom',{},0]){
    assert.equal(isExpressionProfile(value),false);
    assert.throws(()=>compile(buildCandidate(snapshot(value)),context),{code:'EXPRESSION_PROFILE_INVALID'});
  }
});
test('snapshot selection is independent of colors fonts and name',()=>{
  const source=snapshot('panoramic');
  source.identity={theme:'ivory',primaryColor:'#ffffff',fontPrimary:'Other'};
  source.project.name='Autre collectif';
  assert.equal(compile(buildCandidate(source),context).manifest.presentation.expressionProfile,'panoramic');
});
test('repository binds tenant project optimistic version and exact profile',async()=>{
  const calls=[];
  const pool={query:async(sql,args)=>{calls.push({sql,args});return {rows:[{expression_profile:'editorial',version:4}]};}};
  const result=await updateProjectExpressionProfile(pool,{tenantId:'tenant',projectId:'project',expressionProfile:'editorial',expectedVersion:3,userId:'actor'});
  assert.deepEqual(calls[0].args,['editorial','actor','tenant','project',3]);
  assert.match(calls[0].sql,/tenant_id=\$3 and project_id=\$4 and version=\$5/);
  assert.equal(result.expression_profile,'editorial');
});
test('migration persists legacy balanced with closed database constraint and leaves publications untouched',()=>{
  const sql=readFileSync(new URL('../db/migrations/0020_project_expression_profile.sql',import.meta.url),'utf8');
  assert.match(sql,/not null default 'balanced'/);
  assert.match(sql,/in \('balanced', 'editorial', 'panoramic'\)/);
  assert.doesNotMatch(sql,/update project_publications|create table/i);
});
test('Studio uses a concise accessible select without raw design controls',()=>{
  const html=readFileSync(new URL('../public/studio-identite.html',import.meta.url),'utf8');
  assert.match(html,/label for="expressionProfile"/);
  assert.match(html,/aria-describedby="expressionDescription"/);
  assert.match(html,/method:"PATCH",body:JSON.stringify\(\{expressionProfile:profileSelect.value,version:state.identity.version\}\)/);
});

test('repository rejects invalid profiles before database access',async()=>{
  await assert.rejects(updateProjectExpressionProfile({query(){assert.fail('must not query');}},{expressionProfile:'unknown'}),{message:'EXPRESSION_PROFILE_INVALID'});
});
