import { createMoodSolicitationEngine } from './mood-engine.js';

const MOOD_LABELS = Object.freeze({
  1: 'Orageux',
  2: 'Nuageux',
  3: 'Couvert',
  4: 'Éclairci',
  5: 'Ensoleillé'
});

const MOOD_ICONS = Object.freeze({
  1: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5a4 4 0 0 1 .5-7.97A5.5 5.5 0 0 1 17 8.5a4 4 0 0 1 .3 7.98"/><path d="M13 12l-2.5 4h3L11 20"/></svg>',
  2: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17.5a4 4 0 0 1 .4-7.98A5.5 5.5 0 0 1 16 8.7a4.2 4.2 0 0 1 3.5 4.15 3.9 3.9 0 0 1-.4 4.65"/><path d="M8 17.5h10.5"/></svg>',
  3: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3.4"/><path d="M11 17.5a4 4 0 0 1 .4-7.9c.4-.05.8-.03 1.2.03A5.5 5.5 0 0 1 22.5 12a4 4 0 0 1-1 5.5"/></svg>',
  4: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3.6"/><path d="M8 2.6v1.4M8 12v1.4M2.6 8h1.4M12 8h1.4M4.3 4.3l1 1M10.7 4.3l-1 1"/><path d="M13 19.5a3.7 3.7 0 0 1 .4-7.36A5 5 0 0 1 22.5 14a3.7 3.7 0 0 1-1 5.5"/></svg>',
  5: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.6"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7"/></svg>'
});

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderMoodExperience(config={}) {
  if(config.enabled===false||config.status==='suspended')return '';
  return `<button type="button" class="mood-fab" data-tct-mood-fab aria-expanded="false" aria-controls="mood-panel" aria-label="Météo du projet"><span class="mood-icon" aria-hidden="true">${MOOD_ICONS[4]}</span><span class="mood-label" aria-hidden="true">Météo du projet</span></button>
  <section class="mood-panel" id="mood-panel" data-tct-mood-panel hidden aria-label="Météo du projet"><div data-mood-body><p class="mood-question">${esc(config.question||'Comment vous sentez-vous par rapport au projet aujourd’hui ?')}</p><div class="mood-options">${[1,2,3,4,5].map(value=>`<button type="button" data-mood-value="${value}" aria-label="${MOOD_LABELS[value]}" title="${MOOD_LABELS[value]}">${MOOD_ICONS[value]}<span>${MOOD_LABELS[value]}</span></button>`).join('')}</div><p class="mood-note" role="status">Anonyme, agrégé uniquement — jamais individuel.</p></div></section>`;
}
export function wireMoodExperience(root,actions) {
  const doc=root.ownerDocument,win=doc?.defaultView,fab=root.querySelector('[data-tct-mood-fab]'),panel=root.querySelector('[data-tct-mood-panel]'),body=root.querySelector('[data-mood-body]');
  if(!win||!fab||!panel||!body)return ()=>{};
  const timers=new Set(),later=(fn,ms)=>{const id=win.setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;};
  const today=()=>new Date().toISOString().slice(0,10);
  const safeGet=key=>{try{return win.localStorage.getItem(key);}catch{return null;}};
  const scope=`project-mood:${win.location.pathname.split('/').slice(0,4).join('/')}`;
  const currentAnswerKey=()=>`project-mood:${win.location.pathname}:${today()}`;
  let answered=false,pending=false,disposed=false;
  const hasAnswered=()=>answered||safeGet('storm_mood_last_answered')===today()||safeGet('xyz_mood_last_answered')===today()||safeGet(currentAnswerKey())==='1';
  const renderAnswered=()=>{fab.classList.add('is-answered');body.innerHTML='<p class="mood-thanks" role="status">Merci — votre ressenti a bien été pris en compte.</p>';};
  if(hasAnswered())renderAnswered();
  const open=()=>{panel.hidden=false;if(win.requestAnimationFrame)win.requestAnimationFrame(()=>{if(!panel.hidden)panel.classList.add('is-open');});else panel.classList.add('is-open');fab.setAttribute('aria-expanded','true');};
  const close=(restore=false)=>{panel.classList.remove('is-open');later(()=>{if(!panel.classList.contains('is-open'))panel.hidden=true;},160);fab.setAttribute('aria-expanded','false');if(restore)fab.focus();};
  const toggle=()=>panel.hidden?open():close();
  const outside=e=>{if(!panel.hidden&&!panel.contains(e.target)&&!fab.contains(e.target))close();};
  const escape=e=>{if(e.key==='Escape'&&!panel.hidden)close(true);};
  const submit=async e=>{
    const button=e.target.closest('[data-mood-value]');if(!button||pending||hasAnswered())return;
    const value=Number(button.dataset.moodValue);if(!Number.isInteger(value)||value<1||value>5)return;
    pending=true;body.querySelectorAll('button').forEach(b=>b.disabled=true);
    let response;try{response=await actions.submitMood?.({value});}catch{}
    if(disposed)return;
    pending=false;
    if(!response?.ok){body.querySelectorAll('button').forEach(b=>b.disabled=false);body.querySelector('.mood-note').textContent=response?.error||'Enregistrement impossible pour le moment.';return;}
    answered=true;try{win.localStorage.setItem('storm_mood_last_answered',today());win.localStorage.setItem(currentAnswerKey(),'1');}catch{}
    renderAnswered();later(()=>close(),1000);
  };
  fab.addEventListener('click',toggle);body.addEventListener('click',submit);doc.addEventListener('click',outside);doc.addEventListener('keydown',escape);
  // The shared scheduler remains the only exposure/timing authority. The data
  // hooks above are its existing exclusion protocol, not legacy presentation.
  const engine=createMoodSolicitationEngine({window:win,document:doc,storageKeyPrefix:'storm_mood',hasAnswered,
    isBusy:()=>!panel.hidden||!!root.querySelector('dialog[open]')||safeGet(`${scope}_nudge_shown`)===today()||safeGet(`${scope}:nudge`)===today(),
    onNudge({reducedMotion,introMs}) {
      if(hasAnswered())return false;
      if(!reducedMotion){fab.classList.add('is-wave');later(()=>fab.classList.remove('is-wave'),1500);}
      fab.classList.add('is-introduced');later(()=>fab.classList.remove('is-introduced'),introMs||3200);
      return true;
    }
  });engine.start();
  return ()=>{disposed=true;engine.stop();timers.forEach(id=>win.clearTimeout(id));fab.removeEventListener('click',toggle);body.removeEventListener('click',submit);doc.removeEventListener('click',outside);doc.removeEventListener('keydown',escape);};
}
