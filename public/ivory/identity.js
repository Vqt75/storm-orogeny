// Generic public identity roles. A low-contrast source remains a surface,
// never a discarded identity. Contrast math follows the former generic resolver.
const INK = '#282923', PAPER = '#f5f5f7', QUIET = '#5d6057';
export const normalizeHex = (value, fallback=INK) => /^#[\da-f]{6}$/i.test(value||'') ? value.toLowerCase() : fallback;
export function luminance(hex) {
  return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
    .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
    .reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
}
export function contrast(a,b) {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function mix(a,b,weight) {
  return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*weight+parseInt(b.slice(i,i+2),16)*(1-weight)).toString(16).padStart(2,'0')).join('');
}
function onColor(color) {return contrast('#ffffff',color)>=contrast('#000000',color)?'#ffffff':'#000000';}
export function resolveProjectColors(colors={}) {
  const primary=normalizeHex(colors.primary),secondary=normalizeHex(colors.secondary,primary);
  let accent=primary;
  for(let step=0;contrast(accent,PAPER)<4.5&&step<20;step++)accent=mix(primary,'#000000',1-(step+1)/20);
  let primarySoft=mix(primary,PAPER,.12);
  for(let step=1;(contrast(INK,primarySoft)<4.5||contrast(QUIET,primarySoft)<4.5)&&step<=12;step++)primarySoft=mix(primary,PAPER,.12-step*.01);
  return {primary,secondary,accent,primarySoft,onPrimary:onColor(primary),onSecondary:onColor(secondary)};
}
export function resolveProjectFonts(fonts={}, assetUrl=()=>'', safeFamily=value=>value||'system-ui') {
  const primaryUrl=assetUrl(fonts.primary?.asset?.url),secondaryUrl=assetUrl(fonts.secondary?.asset?.url);
  const primary=primaryUrl?'ivory-project-primary':safeFamily(fonts.primary?.family);
  // File aliases are role-specific, so upload filenames and same-family files
  // cannot invalidate CSS or overwrite one another. Published labels stay intact.
  const secondary=secondaryUrl&&secondaryUrl!==primaryUrl?'ivory-project-secondary':primary;
  const faces=[[primary,primaryUrl],[secondary,secondaryUrl]].filter(([,url],i,a)=>url&&a.findIndex(x=>x[0]===a[i][0])===i)
    .map(([family,url])=>`@font-face{font-family:'${family}';src:url('${url}');font-display:swap}`).join('');
  return {primary,secondary,faces};
}
