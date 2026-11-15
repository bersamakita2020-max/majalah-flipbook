(async function(){
const RATIO=297/210, PW=FB.PW;
const $=id=>document.getElementById(id);
const book=$('book'), wrap=$('bookWrap'), stage=$('stage');
let data;
try{ data=await FB.load(); }catch(e){ $('loader').querySelector('.lt').textContent='Gagal memuat majalah. Periksa koneksi lalu muat ulang.'; return; }
const PAGES=FB.publicPages(data.pages), N=PAGES.length, S=data.settings;
$('blogos').innerHTML=FB.logosHTML(S);
// build pages (HTML)
const secs=[];
PAGES.forEach((p,i)=>{
  const d=document.createElement('div'); d.className='pg';
  if(i===0||i===N-1) d.dataset.density='hard';
  const inn=document.createElement('div'); inn.className='pgin';
  const s=FB.renderPage(p,i+1,S,{lazy:true}); secs.push(s);
  inn.appendChild(s); d.appendChild(inn);
  const sk=document.createElement('div'); sk.className='sk'; d.appendChild(sk);
  book.appendChild(d);
});
const pgs=[...book.children];
// scale each page to its box
const ro=new ResizeObserver(es=>es.forEach(e=>{const w=e.target.clientWidth; if(w>0) e.target.firstChild.style.transform='scale('+(w/PW)+')';}));
pgs.forEach(p=>ro.observe(p));
const loading=new Array(N).fill(null);
function load(i){
  if(i<0||i>=N) return Promise.resolve();
  if(loading[i]) return loading[i];
  const ims=[...secs[i].querySelectorAll('img[data-src]')];
  loading[i]=Promise.all(ims.map(im=>new Promise(res=>{im.onload=im.onerror=res;im.src=im.dataset.src;im.removeAttribute('data-src');}))).then(()=>pgs[i].classList.add('ok'));
  return loading[i];
}
// layout
let single=false;
function layout(){
  const W=stage.clientWidth-(innerWidth>720?130:16), H=stage.clientHeight-(innerWidth>720?24:12);
  const hS=Math.min(H,(W/2)*RATIO), h1=Math.min(H,W*RATIO);
  single = innerWidth<=720 || h1>hS*1.45;
  let w = single ? Math.min(h1/RATIO, 620) : 2*(hS/RATIO);
  wrap.style.width=Math.floor(w)+'px';
  wrap.style.height=Math.floor((single?w:w/2)*RATIO)+'px';
}
layout(); addEventListener('resize',layout);
// sound
const AC=window.AudioContext||window.webkitAudioContext; let actx=null, soundOn=localStorage.getItem('fbSound')!=='0';
function swish(){
  if(!soundOn||!AC) return;
  try{ actx=actx||new AC(); const t=actx.currentTime, len=.42, sr=actx.sampleRate;
    const buf=actx.createBuffer(1,sr*len,sr), d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++){const x=i/d.length; d[i]=(Math.random()*2-1)*Math.pow(Math.sin(Math.PI*x),2)*(1-x*.6);}
    const s=actx.createBufferSource(); s.buffer=buf;
    const f=actx.createBiquadFilter(); f.type='bandpass'; f.Q.value=.7; f.frequency.setValueAtTime(900,t); f.frequency.exponentialRampToValueAtTime(3800,t+len*.5); f.frequency.exponentialRampToValueAtTime(1500,t+len);
    const g=actx.createGain(); g.gain.value=.22; s.connect(f).connect(g).connect(actx.destination); s.start(t);
  }catch(e){}
}
// init
const first=Math.max(0,Math.min(N-1,(parseInt((location.hash.match(/halaman=(\d+)/)||[])[1])||1)-1));
const prog=$('lprog'); let done=0;
const initial=[first,first+1,first+2,first-1,0,1].filter((v,i,a)=>v>=0&&v<N&&a.indexOf(v)===i);
await document.fonts.ready.catch(()=>{});
const pf=new St.PageFlip(book,{width:620,height:Math.round(620*RATIO),size:'stretch',minWidth:250,maxWidth:1240,minHeight:300,maxHeight:1754,
  showCover:true,usePortrait:true,maxShadowOpacity:.45,flippingTime:850,mobileScrollSupport:false,startPage:first,autoSize:true,drawShadow:true,showPageCorners:true});
pf.loadFromHTML(pgs);
Promise.all(initial.map(i=>load(i).then(()=>{done++;prog.style.width=(done/initial.length*100)+'%'}))).then(()=>{
  setTimeout(()=>{$('loader').classList.add('done');document.body.dataset.ready='1';},250);
  const order=[...Array(N).keys()].sort((a,b)=>Math.abs(a-first)-Math.abs(b-first));
  (async()=>{for(const i of order){await load(i);}})();
});
function cur(){return pf.getCurrentPageIndex();}
function visible(){const c=cur(); if(pf.getOrientation()==='portrait'||c===0||c===N-1) return [c]; return c%2===1?[c,c+1].filter(x=>x<N):[c-1,c];}
function ui(){
  const v=visible(); const c=cur();
  $('pInput').value=v.length>1?`${v[0]+1}-${v[1]+1}`:`${v[0]+1}`;
  $('pTotal').textContent='/ '+N;
  const atStart=c===0, atEnd=v[v.length-1]>=N-1;
  [$('bPrev'),$('sPrev'),$('bFirst')].forEach(b=>b.disabled=atStart);
  [$('bNext'),$('sNext'),$('bLast')].forEach(b=>b.disabled=atEnd);
  document.querySelectorAll('.th').forEach((t,i)=>t.classList.toggle('cur',v.includes(i)));
  history.replaceState(null,'','#halaman='+(v[0]+1));
  for(let k=c-2;k<=c+5;k++) load(k);
}
pf.on('flip',ui);
pf.on('changeState',e=>{ if(e.data==='flipping') swish(); });
pf.on('changeOrientation',()=>setTimeout(ui,50));
pf.on('init',ui); setTimeout(ui,300);
const next=()=>pf.flipNext(), prev=()=>pf.flipPrev();
$('bNext').onclick=next; $('sNext').onclick=next; $('bPrev').onclick=prev; $('sPrev').onclick=prev;
$('bFirst').onclick=()=>pf.flip(0); $('bLast').onclick=()=>pf.flip(N-1);
$('pInput').addEventListener('focus',e=>e.target.select());
$('pInput').addEventListener('change',e=>{const n=parseInt(e.target.value); if(n>=1&&n<=N){pf.flip(n-1);} else ui(); e.target.blur();});
addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT') return;
  if($('zoom').classList.contains('open')){ if(e.key==='Escape') closeZoom(); if(e.key==='+'||e.key==='=') setZ(z+.4); if(e.key==='-') setZ(z-.4); return;}
  if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' ') {e.preventDefault();next();}
  if(e.key==='ArrowLeft'||e.key==='PageUp') {e.preventDefault();prev();}
  if(e.key==='Home') pf.flip(0); if(e.key==='End') pf.flip(N-1);
  if(e.key==='Escape') $('thumbs').classList.remove('open');
});
if(matchMedia('(pointer:coarse)').matches)$('hint').textContent='👆 Geser halaman ke kiri/kanan untuk membalik';
setTimeout(()=>$('hint').style.opacity=0,5000);
// thumbnails (render langsung dari isi halaman)
const tg=$('tgrid'); let thumbsBuilt=false;
function buildThumbs(){
  if(thumbsBuilt) return; thumbsBuilt=true;
  PAGES.forEach((p,i)=>{const t=document.createElement('div');t.className='th';
    const box=document.createElement('div');box.className='tbox';const inn=document.createElement('div');inn.className='pgin';
    const s=FB.renderPage(p,i+1,S); s.querySelectorAll('img').forEach(im=>im.loading='lazy'); inn.appendChild(s); box.appendChild(inn);
    t.appendChild(box); const sp=document.createElement('span'); sp.textContent=i+1; t.appendChild(sp);
    t.onclick=()=>{$('thumbs').classList.remove('open');$('bThumbs').classList.remove('on');setTimeout(()=>pf.flip(i),200);};
    tg.appendChild(t); ro.observe(box);});
  ui();
}
$('bThumbs').onclick=()=>{buildThumbs();const o=$('thumbs').classList.toggle('open');$('bThumbs').classList.toggle('on',o);if(o){const c=tg.querySelector('.cur');c&&c.scrollIntoView({block:'nearest'});}};
$('tClose').onclick=()=>{$('thumbs').classList.remove('open');$('bThumbs').classList.remove('on');};
const sb=$('bSound'); sb.classList.toggle('on',soundOn);
sb.onclick=()=>{soundOn=!soundOn;localStorage.setItem('fbSound',soundOn?'1':'0');sb.classList.toggle('on',soundOn);toast(soundOn?'Suara balik halaman aktif':'Suara dimatikan');};
$('bFull').onclick=()=>{const d=document; if(!d.fullscreenElement){(d.documentElement.requestFullscreen||d.documentElement.webkitRequestFullscreen||function(){}).call(d.documentElement);} else {(d.exitFullscreen||d.webkitExitFullscreen).call(d);} };
document.addEventListener('fullscreenchange',()=>{ $('bFull').classList.toggle('on',!!document.fullscreenElement); setTimeout(()=>{layout();pf.update&&pf.update();},120);});
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2000);}
$('bShare').onclick=async()=>{const url=location.href.split('#')[0]+'#halaman='+(visible()[0]+1);
  if(navigator.share){try{await navigator.share({title:document.title,url});return;}catch(e){}}
  try{await navigator.clipboard.writeText(url);toast('Tautan disalin ✓');}catch(e){prompt('Salin tautan:',url);} };
// zoom (halaman dirender ulang, tetap tajam)
let z=1; const zs=$('zscroll'), zi=$('zinner');
function baseH(){return innerHeight-110;}
function setZ(v){ z=Math.max(1,Math.min(4,v)); const cx=(zs.scrollLeft+zs.clientWidth/2)/zi.scrollWidth, cy=(zs.scrollTop+zs.clientHeight/2)/zi.scrollHeight;
  const h=baseH()*z, w=h/RATIO;
  zi.querySelectorAll('.zp').forEach(el=>{el.style.height=h+'px';el.style.width=w+'px';el.firstChild.style.transform='scale('+(w/PW)+')';});
  $('zLvl').textContent=Math.round(z*100)+'%';
  requestAnimationFrame(()=>{zs.scrollLeft=cx*zi.scrollWidth-zs.clientWidth/2; zs.scrollTop=cy*zi.scrollHeight-zs.clientHeight/2;});
}
function openZoom(){ zi.innerHTML=''; visible().forEach(i=>{const zp=document.createElement('div');zp.className='zp';const inn=document.createElement('div');inn.className='pgin';inn.appendChild(FB.renderPage(PAGES[i],i+1,S));zp.appendChild(inn);zi.appendChild(zp);});
  $('zoom').classList.add('open'); z=1; setZ(1.6); }
function closeZoom(){ $('zoom').classList.remove('open'); }
$('bZoom').onclick=openZoom; $('zClose').onclick=closeZoom; $('zIn').onclick=()=>setZ(z+.4); $('zOut').onclick=()=>setZ(z-.4);
book.addEventListener('dblclick',openZoom);
zs.addEventListener('wheel',e=>{if(e.ctrlKey){e.preventDefault();setZ(z*(e.deltaY<0?1.1:.9));}},{passive:false});
let dr=null; zs.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')return;dr={x:e.clientX,y:e.clientY,l:zs.scrollLeft,t:zs.scrollTop};zs.classList.add('drag');});
addEventListener('pointermove',e=>{if(!dr)return;zs.scrollLeft=dr.l-(e.clientX-dr.x);zs.scrollTop=dr.t-(e.clientY-dr.y);});
addEventListener('pointerup',()=>{dr=null;zs.classList.remove('drag');});
new ResizeObserver(()=>{zi.style.marginLeft=zi.scrollWidth<zs.clientWidth?((zs.clientWidth-zi.scrollWidth)/2)+'px':'0';}).observe(zi);
})();
