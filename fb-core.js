/* Inti flipbook: memuat isi dari Supabase dan merender halaman majalah */
(function(){
const SUPA_URL='https://oupzxkqqndkzcduoabba.supabase.co';
const SUPA_KEY='sb_publishable_Z59D-HUZC-HaTqjl8e-4sA_AgoeZJJR';
const BOOK='gercep';
const PW=793.7, PH=1122.5; // A4 @96dpi (px)
const NAMES=['Berorientasi Pelayanan','Akuntabel','Kompeten','Harmonis','Loyal','Adaptif','Kolaboratif'];
const sv=p=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>';
const AKH={
 'Berorientasi Pelayanan':{c:'#e11d48',i:sv('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>')},
 'Akuntabel':{c:'#0e7c6b',i:sv('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>')},
 'Kompeten':{c:'#f59e0b',i:sv('<circle cx="12" cy="8" r="6"/><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11"/>')},
 'Harmonis':{c:'#3aa7d8',i:sv('<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>')},
 'Loyal':{c:'#c0392b',i:sv('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>')},
 'Adaptif':{c:'#8b5cf6',i:sv('<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>')},
 'Kolaboratif':{c:'#0ea5e9',i:sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>')}
};
const DEFAULT_LOGOS=[
 {id:'kalbar',alt:'Provinsi Kalimantan Barat',src:'assets/logos/kalbar.svg'},
 {id:'sintang',alt:'Kabupaten Sintang',src:'assets/logos/sintang.png'},
 {id:'lanri',alt:'Lembaga Administrasi Negara RI',src:'assets/logos/lan-ri.png'},
 {id:'berakhlak',alt:'BerAKHLAK',src:'assets/logos/berakhlak.svg'},
 {id:'bangga',alt:'Bangga Melayani Bangsa',src:'assets/logos/bangga-melayani-bangsa.svg'}
];
const FOOT_TXT='GERCEP MENSIKU · Laporan Aktualisasi Latsar CPNS 2026';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

async function rest(path,token){
  const r=await fetch(SUPA_URL+'/rest/v1/'+path,{headers:{apikey:SUPA_KEY,Authorization:'Bearer '+(token||SUPA_KEY)},cache:'no-store'});
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}
async function load(opts){
  opts=opts||{};
  try{
    if(/[?&]local\b/.test(location.search)) throw new Error('mode lokal');
    const [pages,sets]=await Promise.all([
      rest('flipbook_pages?book=eq.'+BOOK+'&select=*&order=position.asc',opts.token),
      rest('flipbook_settings?select=key,value',opts.token)]);
    if(!pages.length) throw new Error('kosong');
    const settings={}; sets.forEach(s=>settings[s.key]=s.value);
    return {pages,settings,source:'db'};
  }catch(e){
    console.warn('Gagal memuat dari database, memakai cadangan content.json',e);
    const pages=await (await fetch('content.json',{cache:'no-store'})).json();
    return {pages:pages.map(p=>Object.assign({hidden:false},p)),settings:{},source:'json'};
  }
}
function logos(settings){
  const l=settings&&settings.logos&&Array.isArray(settings.logos.items)?settings.logos.items:DEFAULT_LOGOS;
  return l.filter(x=>x&&x.src&&x.show!==false);
}
function logosHTML(settings){
  return '<div class="logos">'+logos(settings).map(x=>'<img src="'+esc(x.src)+'" alt="'+esc(x.alt||'')+'" title="'+esc(x.alt||'')+'" draggable="false">').join('')+'</div>';
}
function akhLogo(settings){
  const l=(settings&&settings.logos&&settings.logos.items)||DEFAULT_LOGOS;
  const b=l.find(x=>x.id==='berakhlak')||DEFAULT_LOGOS[2];
  return b.src;
}
function kno(rec){const m=(rec.title||'').match(/Kegiatan\s*(\d+)/i);return rec.data&&rec.data.kno?rec.data.kno:(m?m[1]:'');}
function akhHTML(rec,settings){
  const items=(rec.data&&rec.data.akhlak)||[];
  if(!items.length) return '';
  const k=kno(rec);
  const cards=items.map(it=>{const m=AKH[it.v]||{c:'#0e7c6b',i:''};
    return '<div class="ac" style="--c:'+m.c+'"><div class="hd"><span class="ai">'+m.i+'</span><b>'+esc(it.v)+'</b></div><p>'+esc(it.t)+'</p></div>';}).join('');
  const cls=(items.length+1)%3===0&&items.length+1<=6?' c3':'';
  return '<div class="akh"><div class="ag'+cls+'"><div class="ah"><div class="lg"><img src="'+esc(akhLogo(settings))+'" alt="BerAKHLAK"></div><b>Nilai BerAKHLAK yang Diterapkan</b>'+(k?'<span>Kegiatan '+String(k).padStart(2,'0')+'</span>':'')+'</div>'+cards+'</div></div>';
}
/* Render satu halaman. n = nomor halaman (1-based) untuk genap/ganjil & footer */
function renderPage(rec,n,settings,opt){
  opt=opt||{};
  const d=rec.data||{};
  const s=document.createElement('section');
  s.className=('page '+(n%2===0?'even':'odd')+' '+(rec.cls||'')).trim();
  s.innerHTML=rec.html||'';
  fillSlots(s,rec,settings);
  if(!d.noHeader){const h=document.createElement('div');h.className='runhead chip';h.setAttribute('data-auto','1');h.innerHTML=logosHTML(settings);s.appendChild(h);}
  if(!d.noFoot){const f=document.createElement('div');f.className='foot'+(d.dark?' dk':'');f.setAttribute('data-auto','1');f.innerHTML='<span>'+FOOT_TXT+'</span><b>'+n+'</b>';s.appendChild(f);}
  if(opt.lazy){s.querySelectorAll('img').forEach(im=>{const v=im.getAttribute('src');if(v){im.dataset.src=v;im.removeAttribute('src');}});}
  return s;
}
function fillSlots(s,rec,settings){
  s.querySelectorAll('[data-slot="akhlak"]').forEach(el=>{el.innerHTML=akhHTML(rec,settings);});
  s.querySelectorAll('[data-slot="logos"]').forEach(el=>{el.innerHTML=logosHTML(settings);});
}
function hasImage(html){
  const t=document.createElement('template');t.innerHTML=html||'';
  return [...t.content.querySelectorAll('img')].some(i=>(i.getAttribute('src')||'').trim()!=='');
}
/* Daftar halaman publik: buang yang disembunyikan & placeholder kosong, genapkan jumlah halaman */
function publicPages(pages){
  let out=pages.filter(p=>!p.hidden && !(p.data&&p.data.autoHide&&!hasImage(p.html)));
  if(out.length%2===1){
    const blank={type:'blank',title:'',cls:'blank',html:'',data:{noFoot:true,noHeader:true}};
    out=out.slice(0,-1).concat([blank,out[out.length-1]]);
  }
  return out;
}
window.FB={SUPA_URL,SUPA_KEY,BOOK,PW,PH,NAMES,AKH,DEFAULT_LOGOS,esc,load,rest,renderPage,fillSlots,publicPages,logos,logosHTML,akhHTML,hasImage};
})();
