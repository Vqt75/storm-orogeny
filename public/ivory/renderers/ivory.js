import { createMoodSolicitationEngine } from '../mood-engine.js';

// One public presentation. Published content in, product actions out.
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const array = value => Array.isArray(value) ? value : [];
export function safeLink(value) {
  const url=String(value||'').trim();
  if (/^tel:\+?[0-9]{7,15}$/.test(url)) return url;
  return /^(https?:\/\/|mailto:|msteams:)/i.test(url) && !/[\s<>"'\\]/.test(url) ? url : '';
}
export function safeAssetUrl(value) {
  const url=String(value||'');
  return /^\/public\/[a-z0-9-]+\/[a-z0-9-]+\/[a-zA-Z0-9_-]+\/assets\/[a-zA-Z0-9.-]+$/.test(url) ? url : '';
}
export function safeCssFont(value, fallback='system-ui') {
  return typeof value==='string' && /^[\p{L}\p{N} _-]+$/u.test(value) ? value : fallback;
}
export function inlineRichText(value) {
  return esc(value).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\+\+([^+]+)\+\+/g,'<u>$1</u>').replace(/(^|[\s>])\/\/([^/]+)\/\//g,'$1<em>$2</em>');
}
function paragraphs(value) { return String(value||'').split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${inlineRichText(p)}</p>`).join(''); }
function runs(items) { return array(items).map(r=>{let text=esc(r.text);if(r.bold)text=`<strong>${text}</strong>`;if(r.italic)text=`<em>${text}</em>`;if(r.underline)text=`<u>${text}</u>`;const href=safeLink(r.href);return href?`<a href="${esc(href)}" rel="noreferrer">${text}</a>`:text;}).join(''); }
function media(asset, className='gallery-art', interactive=false) {
  const url=safeAssetUrl(asset?.url);if(!url)return '';
  if(/\.pdf$/i.test(url))return `<a class="media-link" href="${esc(url)}" target="_blank" rel="noreferrer">${esc(asset.label||asset.alt||'Ouvrir le document')}</a>`;
  const img=`<img src="${esc(url)}" alt="${esc(asset.alt)}" loading="lazy">`;
  return interactive?`<button class="${className} media-button" data-media="${esc(url)}" data-alt="${esc(asset.alt)}" aria-label="${esc(asset.alt||'Agrandir l’image')}">${img}</button>`:`<div class="${className}">${img}</div>`;
}
const link=(href,label)=>`<a class="text-link" href="${href}">${esc(label)}</a>`;
const eligible = questions => array(questions?.items).filter(e=>typeof e.title==='string'&&e.title.trim()&&typeof e.answer==='string'&&e.answer.trim());
export function profileFor(manifest) {
  // Explicit pre-contract publication compatibility; never inferred from identity.
  const profile=manifest.presentation?.expressionProfile;
  if(profile===undefined)return 'balanced';
  if(!['balanced','editorial','panoramic'].includes(profile))throw new TypeError('EXPRESSION_PROFILE_INVALID');
  return profile;
}
function intro(title,body='') {return `<header class="page-opening"><h1>${esc(title)}</h1>${body?`<div class="deck">${paragraphs(body)}</div>`:''}</header>`;}
function spaceRail(items) {
  if(!items.length)return '';
  return `<ul class="gallery-track" data-rail tabindex="0" aria-label="Explorer les espaces">${items.map(s=>`<li class="gallery-item"><a href="#space-${encodeURIComponent(s.id)}">${media(s.asset)}<h3>${esc(s.title)}</h3>${s.comment?`<p>${esc(s.comment)}</p>`:''}</a></li>`).join('')}</ul>${items.length>1?'<div class="gallery-controls"><button data-rail-step="-1">Précédent</button><button data-rail-step="1">Suivant</button></div>':''}`;
}
function newsMetadata(item, className='') {
  if (!item.date && !item.tag) return '';
  return `<div class="news-meta ${className}">${item.date?`<time datetime="${esc(item.date)}">${esc(item.date)}</time>`:''}${item.tag?`<span>${esc(item.tag)}</span>`:''}</div>`;
}
function newsRows(items) {return items.map(n=>`<a class="news-row" href="#news-${encodeURIComponent(n.id)}">${newsMetadata(n)}<div><h3>${esc(n.title)}</h3>${n.summary?`<p>${inlineRichText(n.summary)}</p>`:''}</div></a>`).join('');}
export function renderHome(home={}, content={}, projectName='Projet') {
  const story=content.project||{}, firstImage=array(story.sections).find(s=>s.type==='image'&&safeAssetUrl(s.asset?.url));
  const headline=home.message||projectName;
  const spaces=array(content.spaces?.items),news=array(content.news?.items);
  const headlineMedia=firstImage?.asset;
  return `<div class="page wrap"><section class="hero"><div class="hero-grid"><div class="hero-copy"><h1>${esc(headline)}</h1>${story.intro?.body?`<p>${inlineRichText(story.intro.body)}</p>`:''}${content.project?link('#timeline','Découvrir le projet'):''}</div>${headlineMedia?`<figure class="hero-art">${media(headlineMedia,'hero-image')}</figure>`:''}</div>${home.showMilestones!==false&&(home.now||home.next)?`<div class="hero-bottom">${home.now?`<span>${esc(home.now.label)}${home.now.date?` · ${esc(home.now.date)}`:''}</span>`:''}${home.next?`<span>${esc(home.next.label)}${home.next.date?` · ${esc(home.next.date)}`:''}</span>`:''}</div>`:''}</section>${story.intro?.title?`<section class="intro-section"><h2>${esc(story.intro.title)}</h2><div>${paragraphs(array(story.sections).find(s=>s.type==='focus')?.body)}${link('#timeline','Lire le récit')}</div></section>`:''}${spaces.length?`<section><div class="section-head"><h2>Espaces</h2>${link('#spaces','Tous les espaces')}</div>${spaceRail(spaces)}</section>`:''}${home.featured?`<section class="news-home"><div class="section-head"><h2>${esc(home.featured.title)}</h2>${link(`#news-${encodeURIComponent(home.featured.source.id)}`,'Lire l’actualité')}</div>${newsMetadata(news.find(n=>n.id===home.featured.source.id)||{})}${paragraphs(home.featured.summary)}${home.latest?newsRows([home.latest]):''}</section>`:news.length?`<section class="news-home"><div class="section-head"><h2>Actualités</h2>${link('#news','Toutes les actualités')}</div>${newsRows(news)}</section>`:''}${home.showAskPrompt!==false&&content.questions?`<section class="end-invite"><h2>${esc(home.askPrompt||'Questions')}</h2>${link('#questions','Ouvrir les questions')}</section>`:''}</div>`;
}
function timelineMarkup(timeline) {return array(timeline?.milestones).length?`<ol class="milestones">${timeline.milestones.map(m=>`<li class="${m.status==='current'?'present':''}">${m.date?`<time>${esc(m.date)}</time>`:'<span></span>'}<div>${esc(m.label)}${m.description?`<p>${esc(m.description)}</p>`:''}</div></li>`).join('')}</ol>`:'';}
function peopleMarkup(people, contacts=false) {return `<ul class="people-list">${people.map(p=>`<li class="person"><div class="portrait">${safeAssetUrl(p.photo?.url)?`<img src="${esc(p.photo.url)}" alt="${esc(p.photo.alt)}" loading="lazy">`:''}</div><div class="person-identity"><h2>${esc(p.name)}</h2><p>${esc(p.role||p.title)}</p></div>${p.tag||p.group?`<p class="person-context">${esc(p.tag||p.group)}</p>`:''}${contacts&&p.contactable!==false&&safeLink(p.contactHref)?`<a class="text-link person-contact" href="${esc(safeLink(p.contactHref))}" rel="noreferrer">${esc(p.contactLabel||'Contacter')}</a>`:''}</li>`).join('')}</ul>`;}
export function renderProject(project={}, timeline={}, team={}) {
  const sections=array(project.sections), headings=sections.filter(s=>s.title&&['text','focus','choices','keyFigures','gallery'].includes(s.type));
  const blocks=sections.map((s,i)=>{
    const id=`chapter-${i}`;
    if(s.type==='image') {
      const items=Array.isArray(s.items)?s.items:(s.asset?[s.asset]:[]);
      if(!items.length)return '';
      const visuals=items.length===1?media(items[0],'wide-art',true):`<ul class="gallery-track" data-rail tabindex="0" aria-label="Images du projet">${items.map(a=>`<li class="gallery-item">${media(a,'gallery-art',true)}</li>`).join('')}</ul><div class="gallery-controls"><button data-rail-step="-1">Précédent</button><button data-rail-step="1">Suivant</button></div>`;
      return `<figure>${visuals}${s.caption?`<figcaption>${esc(s.caption)}</figcaption>`:''}</figure>`;
    }
    if(s.type==='quote')return `<section class="quote-band"><blockquote>${inlineRichText(s.quote)}${s.attribution?`<cite>${esc(s.attribution)}</cite>`:''}</blockquote></section>`;
    if(s.type==='gallery')return `<section class="chapter" id="${id}"><div class="chapter-title"><h2>${esc(s.title)}</h2></div><div><ul class="gallery-track" data-rail tabindex="0" aria-label="${esc(s.title||'Galerie')}">${array(s.items).map(a=>`<li class="gallery-item">${media(a,'gallery-art',true)}</li>`).join('')}</ul>${array(s.items).length>1?'<div class="gallery-controls"><button data-rail-step="-1">Précédent</button><button data-rail-step="1">Suivant</button></div>':''}</div></section>`;
    if(s.type==='timeline')return `<section class="chapter"><div class="chapter-title"><h2>Les étapes</h2></div><div>${timelineMarkup(timeline)}</div></section>`;
    if(s.type==='team')return `<section class="chapter"><div class="chapter-title"><h2>L’équipe</h2></div><div>${peopleMarkup(array(team.members))}</div></section>`;
    return `<section class="chapter" id="${id}"><div class="chapter-title">${s.title?`<h2>${esc(s.title)}</h2>`:''}</div><div class="reading">${s.type==='keyFigures'?`<ul class="facts">${array(s.items).map(x=>`<li><strong>${esc(x.value)}</strong><p>${esc(x.label)}</p></li>`).join('')}</ul>`:s.type==='choices'?array(s.items).map(x=>`<h3>${esc(x.title)}</h3>${paragraphs(x.body)}`).join(''):paragraphs(s.body)}</div></section>`;
  }).join('');
  return `<div class="page wrap"><header class="page-opening story-open"><div><h1>${esc(project.intro?.title||'Le projet')}</h1>${project.intro?.body?`<div class="deck">${paragraphs(project.intro.body)}</div>`:''}</div>${headings.length>1?`<aside><nav aria-label="Sommaire du récit">${headings.map(s=>`<a href="#timeline!chapter-${sections.indexOf(s)}">${esc(s.title)}</a>`).join('')}</nav></aside>`:''}</header>${blocks}${project.showTimeline!==false&&!sections.some(s=>s.type==='timeline')?timelineMarkup(timeline):''}${project.showTeam!==false&&!sections.some(s=>s.type==='team')&&array(team.members).length?`<section class="news-home"><h2>L’équipe</h2>${peopleMarkup(team.members)}</section>`:''}</div>`;
}
export function renderSpaces(spaces={}, selectedId) {
  const items=array(spaces.items), selected=items.find(s=>String(s.id)===selectedId);
  if(selected)return `<div class="page wrap">${intro(selected.title)}${link('#spaces','Tous les espaces')}${media(selected.asset,'wide-art',true)}<div class="detail-layout"><div class="reading">${paragraphs(selected.comment)}${selected.location?`<p>${esc(selected.location)}</p>`:''}${selected.status?`<p>${esc(selected.status)}</p>`:''}${paragraphs(selected.statusBody)}</div><div>${array(selected.usages).length?`<h2>Usages</h2><ul>${selected.usages.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}${array(selected.media).slice(1).map(a=>media(a,'gallery-art',true)).join('')}</div></div></div>`;
  return `<div class="page wrap">${intro(spaces.intro?.title||'Espaces',spaces.intro?.description)}${spaceRail(items)}<div class="space-list">${items.map(s=>`<article class="space-row">${media(s.asset)}<div><h2>${esc(s.title)}</h2>${paragraphs(s.comment)}${link(`#space-${encodeURIComponent(s.id)}`,'Découvrir cet espace')}</div></article>`).join('')}</div></div>`;
}
export function renderNewsArticle(item={}) {
  return `<div class="page"><article class="article">${intro(item.title)}${link('#news','Toutes les actualités')}${newsMetadata(item,'article-date')}${item.summary?`<div class="deck">${inlineRichText(item.summary)}</div>`:''}<div class="reading">${array(item.blocks).map(b=>b.type==='image'?`<figure>${media(b.asset,'gallery-art',true)}</figure>`:b.type==='heading'?`<h2>${runs(b.runs)}</h2>`:`<p>${runs(b.runs)}</p>`).join('')}</div></article></div>`;
}
export function renderNews(news={}, selectedId) {const items=array(news.items),selected=items.find(n=>String(n.id)===selectedId);if(selected)return renderNewsArticle(selected);const lead=items[0];return `<div class="page wrap">${intro('Actualités')}${lead?`<article class="news-lead">${media(lead.asset)}<div>${newsMetadata(lead)}<h2>${esc(lead.title)}</h2><p>${inlineRichText(lead.summary)}</p>${link(`#news-${encodeURIComponent(lead.id)}`,'Lire l’article')}</div></article>${newsRows(items.slice(1))}`:''}</div>`;}
export function renderAmbassadors(data={}) {
  const contact=safeLink(data.contact?.defaultHref),join=safeLink(data.join?.href);
  return `<div class="page wrap">${intro(data.intro?.title||'Ambassadeurs',data.intro?.body)}${array(data.roster).length>6?'<label for="people-search">Rechercher une personne</label><input class="collection-search" id="people-search" type="search">':''}${peopleMarkup(array(data.roster),true)}${data.contact?.enabled&&contact?link(esc(contact),data.contact.label||'Contacter l’équipe'):''}${data.join?.enabled&&join?`<section class="end-invite"><div><h2>${esc(data.join.title)}</h2>${paragraphs(data.join.body)}</div>${link(esc(join),data.join.label||'Participer')}</section>`:''}</div>`;
}
export function humanRelay(content) {
  const ambassadors=content?.ambassadors;
  const direct=ambassadors?.contact?.enabled&&safeLink(ambassadors.contact.defaultHref);
  if(direct)return link(esc(direct),ambassadors.contact.label||'Contacter l’équipe');
  return array(ambassadors?.roster).some(p=>p.contactable!==false&&safeLink(p.contactHref))?link('#ambassadors','Contacter un ambassadeur'):'';
}
export function resultMarkup(result, entries=[], content={}) {
  if(!result)return '';
  if(result.state==='covered'){
    const entry=entries.find(e=>String(e.id)===result.sourceQuestionId);
    return `<section class="result" data-state="covered"><h2 id="result-title" tabindex="-1">${esc(entry?.title||'Réponse publiée')}</h2><div class="answer-text">${inlineRichText(result.answer)}</div><p class="provenance">Dans les questions publiées.</p><div class="result-actions"><button class="plain" data-reformulate>Poser une autre question</button></div></section>`;
  }
  if(result.state==='ambiguous')return `<section class="result" data-state="ambiguous"><h2 id="result-title" tabindex="-1">Quel sujet aviez-vous en tête ?</h2><ul>${array(result.candidates).map(c=>`<li><button class="candidate" data-entry="${esc(c.sourceQuestionId)}">${esc(c.question)}</button></li>`).join('')}</ul><button class="plain" data-reformulate>Préciser ma question</button></section>`;
  return `<section class="result" data-state="notCovered"><h2 id="result-title" tabindex="-1">Ce point n’est pas abordé dans les réponses publiées.</h2><div class="result-actions">${humanRelay(content)}<button class="plain" data-reformulate>Reformuler</button></div></section>`;
}
export function renderQuestions(questions={}, knowledge={corpusState:'CORPUS_UNAVAILABLE'}, content={}, query='') {
  if(knowledge.corpusState!=='CORPUS_READY'){
    const empty=knowledge.corpusState==='CORPUS_EMPTY';return `<div class="page wrap" data-state="${empty?'corpusEmpty':'corpusUnavailable'}"><section class="absence"><h1>${empty?'Une question ?':'Les réponses font une pause.'}</h1><p>${empty?'Les premières réponses du projet seront publiées ici.':'La recherche de réponses est momentanément indisponible. Les autres pages du projet restent accessibles.'}</p><div class="result-actions">${empty?'':'<button class="solid" data-retry>Réessayer</button>'}${humanRelay(content)}${link('#timeline','Découvrir le projet')}</div></section></div>`;
  }
  const entries=eligible(questions);
  return `<div class="page wrap" data-state="ready"><header class="page-opening questions-top"><div><h1>Les réponses du projet.</h1>${questions.intro?.description?`<p class="deck">${esc(questions.intro.description)}</p>`:''}</div><form class="question-form" id="question-form"><label for="question-input">Votre question</label><div class="input-line"><input id="question-input" name="question" value="${esc(query)}" placeholder="Que souhaitez-vous savoir ?" maxlength="500" required><button type="submit">Rechercher</button></div><p class="form-note" role="status"></p></form></header><div id="answer-region" aria-live="polite" aria-atomic="true"></div>${entries.length?`<section class="published-list"><h2>À lire aussi.</h2><ul>${entries.map(e=>`<li><button data-entry="${esc(e.id)}">${esc(e.title)}</button></li>`).join('')}</ul></section>`:''}</div>`;
}
function navigation(content,profile) {
  const base=[['timeline','Le projet','project'],['spaces','Espaces','spaces'],['news','Actualités','news'],['ambassadors','Ambassadeurs','ambassadors']];
  if(profile==='panoramic')base.unshift(base.splice(1,1)[0]);
  return base.filter(([, ,module])=>content[module]).map(([key,label])=>`<a href="#${key}">${label}</a>`).join('');
}
export function render(manifest, root, actions={}) {
  const content=manifest.content||{},profile=profileFor(manifest),name=manifest.project?.name||'Projet';
  document.documentElement.style.setProperty('--motion',profile==='editorial'?'230ms':profile==='panoramic'?'170ms':'200ms');
  const color=value=>/^#[\da-f]{6}$/i.test(value||'')?value:'#282923';
  const primary=color(manifest.branding?.colors?.primary),secondary=color(manifest.branding?.colors?.secondary);
  const luminance=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const accent=luminance(primary)<=.183?primary:'#282923';
  const onSecondary=luminance(secondary)<=.183?'#ffffff':'#282923';
  const fontPrimary=safeCssFont(manifest.branding?.fonts?.primary?.family),fontSecondary=safeCssFont(manifest.branding?.fonts?.secondary?.family,fontPrimary);
  const fontFaces=['primary','secondary'].map(role=>{const font=manifest.branding?.fonts?.[role];const url=safeAssetUrl(font?.asset?.url);return url?`@font-face{font-family:'${safeCssFont(font.family)}';src:url('${url}');font-display:swap}`:'';}).join('');
  const logo=safeAssetUrl(manifest.branding?.logo?.url),brand=logo?`<img src="${esc(logo)}" alt="${esc(name)}">`:esc(name);
  const nav=navigation(content,profile),questionLink=content.questions?'<a class="question-link" href="#questions">Questions</a>':'';
  const mood=manifest.experience?.mood;
  root.innerHTML=`<style>${fontFaces}</style><div class="ivory-site" data-expression="${profile}" style="--serif:'${fontPrimary}',system-ui,sans-serif;--body:'${fontPrimary}',system-ui,sans-serif;--detail:'${fontSecondary}',system-ui,sans-serif;--red:${accent};--green:${secondary};--on-secondary:${onSecondary}"><a href="#main" class="skip">Aller au contenu</a><header class="header"><div class="wrap header-inner"><a class="brand" href="#home" aria-label="${esc(name)} — accueil">${brand}</a><nav class="desktop-nav" aria-label="Navigation principale">${nav}</nav>${questionLink}<button class="menu-button" id="menu-open" aria-haspopup="dialog" aria-controls="menu-dialog" aria-expanded="false">Menu</button></div></header><main id="main" tabindex="-1"></main><footer class="footer"><div class="wrap footer-line"><a class="brand" href="#home">${brand}</a>${mood?.enabled!==false&&mood?.status!=='suspended'?'<button class="plain" data-mood-open>Partager mon ressenti</button>':''}</div></footer><dialog id="menu-dialog" class="menu-dialog" aria-labelledby="menu-title"><div class="dialog-inside"><div class="dialog-head"><h2 id="menu-title">${esc(name)}</h2><button data-close class="close-dialog" aria-label="Fermer le menu">×</button></div><nav aria-label="Navigation mobile"><a href="#home">Accueil</a>${nav}${questionLink}</nav></div></dialog><dialog class="media-dialog" id="media-dialog" aria-label="Image du projet"><div class="dialog-inside"><div class="media-actions"><button data-zoom class="plain">Agrandir</button><button data-close class="plain">Fermer</button></div><img alt=""></div></dialog><dialog id="mood-dialog" aria-labelledby="mood-title"><div class="dialog-inside"><div class="dialog-head"><h2 id="mood-title">${esc(mood?.question||'Comment vous sentez-vous par rapport au projet aujourd’hui ?')}</h2><button data-close class="close-dialog" aria-label="Fermer">×</button></div><div class="mood-choices">${['Très difficile','Difficile','Mitigé','Bien','Très bien'].map((label,i)=>`<button data-mood="${i+1}">${label}</button>`).join('')}</div><p role="status" id="mood-status"></p></div></dialog></div>`;
  const $=s=>root.querySelector(s),main=$('#main');
  let query='',result=null,knowledge={corpusState:'CORPUS_UNAVAILABLE'},request=0,currentPath='',trigger=null;
  const positions=new Map();let observer=null;
  const reduce=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const entries=eligible(content.questions);
  function wireRails(){observer?.disconnect();const rails=[...root.querySelectorAll('[data-rail]')];const update=()=>rails.forEach(rail=>{const controls=rail.nextElementSibling;if(!controls?.classList.contains('gallery-controls'))return;const prev=controls.querySelector('[data-rail-step="-1"]'),next=controls.querySelector('[data-rail-step="1"]');controls.hidden=rail.scrollWidth<=rail.clientWidth+2;prev.disabled=rail.scrollLeft<2;next.disabled=rail.scrollLeft+rail.clientWidth>=rail.scrollWidth-2;});rails.forEach(rail=>rail.addEventListener('scroll',update,{passive:true}));if(globalThis.ResizeObserver){observer=new ResizeObserver(update);rails.forEach(r=>observer.observe(r));}requestAnimationFrame(update);}
  function morph(){const region=$('#answer-region');if(!region)return;region.getAnimations?.().forEach(a=>a.cancel());region.innerHTML=resultMarkup(result,entries,content);if(!reduce())region.animate?.([{opacity:.4,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:profile==='editorial'?230:profile==='panoramic'?170:200,easing:'ease-out'});const title=$('#result-title');title?.focus({preventScroll:true});title?.scrollIntoView({block:'nearest',behavior:reduce()?'instant':'smooth'});}
  function route(focus=true){const raw=location.hash.slice(1)||'home';if(raw==='main'){main.focus();return;}const [path,anchor]=raw.split('!');if(currentPath&&currentPath!==path)positions.set(currentPath,{top:scrollY,href:document.activeElement?.getAttribute('href')});const returning=currentPath!==path?positions.get(path):null;currentPath=path;request++;
    let html,base=path;
    if(path==='home')html=renderHome(content.home,content,name);
    else if(path==='timeline')html=renderProject(content.project,content.timeline,content.team);
    else if(path==='spaces'||path.startsWith('space-')){base='spaces';html=renderSpaces(content.spaces,path.startsWith('space-')?decodeURIComponent(path.slice(6)):undefined);}
    else if(path==='news'||path.startsWith('news-')){base='news';html=renderNews(content.news,path.startsWith('news-')?decodeURIComponent(path.slice(5)):undefined);}
    else if(path==='ambassadors')html=renderAmbassadors(content.ambassadors);
    else if(path==='questions')html=renderQuestions(content.questions,knowledge,content,query);
    else if(path==='team')html=`<div class="page wrap">${intro('L’équipe')}${peopleMarkup(array(content.team?.members))}</div>`;
    else html=`<div class="page wrap">${intro('Page introuvable')}${link('#home','Revenir à l’accueil')}</div>`;
    main.innerHTML=html;wireRails();if(path==='questions')morph();
    root.querySelectorAll('nav a,.question-link').forEach(a=>{if(a.getAttribute('href')==='#'+base)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if($('#menu-dialog').open)$('#menu-dialog').close();
    document.title=`${main.querySelector('h1')?.textContent||name} — ${name}`;document.documentElement.lang=manifest.meta?.contentLocale||'fr';
    if(focus){scrollTo({top:returning?.top||0,behavior:'instant'});const target=returning?.href?[...main.querySelectorAll('a')].find(a=>a.getAttribute('href')===returning.href):main.querySelector('h1');if(target){target.tabIndex=-1;target.focus({preventScroll:true});}}
    if(anchor){const target=document.getElementById(anchor);target?.scrollIntoView({behavior:reduce()?'instant':'smooth'});target?.focus({preventScroll:true});}
    actions.trackPageView?.(path);
  }
  async function loadKnowledge(){try{const data=await actions.prepareKnowledge?.();knowledge=data?.publicationRevision===manifest.meta?.revision?data:{corpusState:'CORPUS_UNAVAILABLE'};}catch{knowledge={corpusState:'CORPUS_UNAVAILABLE'};}if(currentPath==='questions')route(false);}
  async function ask(){const input=$('#question-input'),form=$('#question-form');if(!input||!form)return;query=input.value.trim();if(!query)return;const token=++request;const button=form.querySelector('button');button.disabled=true;$('.form-note').textContent='Recherche…';try{const data=await actions.matchKnowledge?.({query,locale:manifest.meta?.contentLocale,publicationRevision:manifest.meta?.revision});if(token!==request)return;if(data?.corpusState!=='CORPUS_READY'){knowledge={corpusState:data?.corpusState==='CORPUS_EMPTY'?'CORPUS_EMPTY':'CORPUS_UNAVAILABLE'};result=null;route(false);return;}if(!['covered','ambiguous','notCovered'].includes(data.result?.state))throw new TypeError('MATCH_UNAVAILABLE');result=data.result;morph();actions.trackMatchResult?.(result.state==='covered'?'matched':result.state==='ambiguous'?'disambiguated':'abstained',{matchedEntryId:result.sourceQuestionId});}catch{if(token===request){knowledge={corpusState:'CORPUS_UNAVAILABLE'};result=null;route(false);}}finally{if(button.isConnected){button.disabled=false;const note=$('.form-note');if(note)note.textContent='';}}}
  root.addEventListener('submit',e=>{if(e.target.id==='question-form'){e.preventDefault();ask();}});
  root.addEventListener('input',e=>{if(e.target.id==='question-input'){query=e.target.value;request++;const button=$('#question-form button');if(button)button.disabled=false;}if(e.target.id==='people-search'){const term=e.target.value.toLocaleLowerCase();root.querySelectorAll('.person').forEach(p=>p.hidden=!p.textContent.toLocaleLowerCase().includes(term));}});
  function open(dialog,button){trigger=button;dialog.showModal();}
  root.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;
    if(b.id==='menu-open'){open($('#menu-dialog'),b);b.setAttribute('aria-expanded','true');}
    if(b.hasAttribute('data-close'))b.closest('dialog')?.close();
    if(b.dataset.entry){const entry=entries.find(x=>String(x.id)===b.dataset.entry);if(entry){request++;result={state:'covered',sourceQuestionId:String(entry.id),answer:entry.answer};query=entry.title;$('#question-input').value=query;morph();}}
    if(b.hasAttribute('data-reformulate')){request++;result=null;morph();$('#question-input')?.focus();$('#question-input')?.select();}
    if(b.hasAttribute('data-retry')){b.disabled=true;await loadKnowledge();if(b.isConnected)b.disabled=false;}
    if(b.dataset.railStep){const rail=b.parentElement.previousElementSibling;rail.scrollBy({left:Number(b.dataset.railStep)*rail.clientWidth*.8,behavior:reduce()?'instant':'smooth'});}
    if(b.dataset.media){const dialog=$('#media-dialog'),img=dialog.querySelector('img');img.src=b.dataset.media;img.alt=b.dataset.alt||'';img.classList.remove('zoomed');dialog.querySelector('[data-zoom]').textContent='Agrandir';open(dialog,b);}
    if(b.hasAttribute('data-zoom')){const img=$('#media-dialog img');img.classList.toggle('zoomed');b.textContent=img.classList.contains('zoomed')?'Vue entière':'Agrandir';}
    if(b.hasAttribute('data-mood-open'))open($('#mood-dialog'),b);
    if(b.dataset.mood){const stamp=new Date().toISOString().slice(0,10),key=`project-mood:${location.pathname}:${stamp}`;let answered=false;try{answered=localStorage.getItem(key)==='1';}catch{}if(answered){$('#mood-status').textContent='Vous avez déjà partagé votre ressenti aujourd’hui.';return;}const buttons=[...root.querySelectorAll('[data-mood]')];buttons.forEach(x=>x.disabled=true);try{const response=await actions.submitMood?.({value:Number(b.dataset.mood)});if(response?.ok){try{localStorage.setItem(key,'1');}catch{}$('#mood-status').textContent='Merci pour votre retour.';}else{buttons.forEach(x=>x.disabled=false);$('#mood-status').textContent='Votre retour n’a pas pu être envoyé. Réessayez.';}}catch{buttons.forEach(x=>x.disabled=false);$('#mood-status').textContent='Votre retour n’a pas pu être envoyé. Réessayez.';}}
  });
  root.addEventListener('keydown',e=>{if(e.target.matches('[data-rail]')&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();e.target.scrollBy({left:(e.key==='ArrowRight'?1:-1)*e.target.clientWidth*.8,behavior:reduce()?'instant':'smooth'});}});
  root.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>{$('#menu-open').setAttribute('aria-expanded','false');if(trigger?.isConnected)trigger.focus();}));
  const moodButton=root.querySelector('[data-mood-open]');
  const solicitation=moodButton?createMoodSolicitationEngine({
    legacyNudgeKey:`project-mood:${location.pathname.split('/').slice(0,4).join('/')}:nudge`,
    storageKeyPrefix:`project-mood:${location.pathname.split('/').slice(0,4).join('/')}`,
    hasAnswered:()=>{try{return localStorage.getItem(`project-mood:${location.pathname}:${new Date().toISOString().slice(0,10)}`)==='1';}catch{return false;}},
    isBusy:()=>!!root.querySelector('dialog[open]')||document.activeElement?.matches('input,textarea'),
    onNudge:()=>{if(!reduce())moodButton.animate?.([{opacity:.3},{opacity:1}],{duration:200});return true;}
  }):null;
  solicitation?.start();
  const navigate=()=>{if(document.startViewTransition&&!reduce())document.startViewTransition(()=>route());else route();};window.addEventListener('hashchange',navigate);route(false);loadKnowledge();
  return ()=>{window.removeEventListener('hashchange',navigate);observer?.disconnect();solicitation?.stop();request++;};
}
