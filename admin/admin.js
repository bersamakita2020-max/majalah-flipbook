(function(){
'use strict';
const $=id=>document.getElementById(id);
const sb=supabase.createClient(FB.SUPA_URL,FB.SUPA_KEY,{auth:{persistSession:true,storageKey:'fb-admin-auth',autoRefreshToken:true}});
const BUCKET='flipbook';
const DEFAULT_TEXT={
 'Berorientasi Pelayanan':'Memahami dan memenuhi kebutuhan masyarakat; ramah, cekatan, solutif, dan dapat diandalkan.',
 'Akuntabel':'Melaksanakan tugas dengan jujur, bertanggung jawab, cermat, disiplin, dan berintegritas tinggi.',
 'Kompeten':'Terus belajar dan mengembangkan kapabilitas; melaksanakan tugas dengan kualitas terbaik.',
 'Harmonis':'Saling peduli dan menghargai perbedaan; membangun lingkungan kerja yang kondusif.',
 'Loyal':'Berdedikasi dan mengutamakan kepentingan bangsa dan negara; menjaga nama baik instansi.',
 'Adaptif':'Terus berinovasi dan antusias menghadapi perubahan; bertindak proaktif.',
 'Kolaboratif':'Membangun kerja sama yang sinergis; memberi kesempatan berbagai pihak untuk berkontribusi.'
};
let S={};            // settings
let P=[];            // pages (state)
let deleted=[];      // ids to delete
let cur=0;           // current index
let dirty=false, preview=false;
let sec=null;        // current editable section element
let selImg=null;     // selected image element
const uid=()=>(crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16);}));

function toast(m,err){const t=$('toast');t.textContent=m;t.className=err?'show err':'show';clearTimeout(t._h);t._h=setTimeout(()=>t.className='',err?5000:2400);}
function busy(on,txt){$('busy').classList.toggle('on',on);if(txt)$('busy').textContent=txt;}
function setDirty(v){dirty=v;const s=$('status');s.textContent=v?'Ada perubahan belum disimpan':'Tersimpan';s.classList.toggle('dirty',v);}
addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});

/* ---------- login ---------- */
$('llogos').innerHTML=FB.logosHTML({});
$('lform').addEventListener('submit',async e=>{
  e.preventDefault();$('lmsg').textContent='';$('lbtn').disabled=true;$('lbtn').textContent='Memeriksa…';
  const {error}=await sb.auth.signInWithPassword({email:$('lemail').value.trim(),password:$('lpass').value});
  $('lbtn').disabled=false;$('lbtn').textContent='Masuk';
  if(error){$('lmsg').textContent=/invalid/i.test(error.message)?'Email atau kata sandi salah.':('Gagal masuk: '+error.message);return;}
  $('lpass').value='';
  start();
});
$('bOut').onclick=async()=>{if(dirty&&!confirm('Ada perubahan yang belum disimpan. Tetap keluar?'))return;await sb.auth.signOut();setDirty(false);location.reload();};
async function start(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){$('login').style.display='';$('app').classList.remove('on');return;}
  const {data:isAdm,error}=await sb.rpc('flipbook_is_admin');
  if(error||!isAdm){$('lmsg').textContent='Akun ini tidak memiliki akses admin flipbook.';await sb.auth.signOut();return;}
  $('login').style.display='none';$('app').classList.add('on');
  await reload();
}
async function reload(){
  busy(true,'Memuat isi majalah…');
  const [pr,sr]=await Promise.all([sb.from('flipbook_pages').select('*').eq('book',FB.BOOK).order('position'),sb.from('flipbook_settings').select('key,value')]);
  busy(false);
  if(pr.error){toast('Gagal memuat: '+pr.error.message,true);return;}
  P=pr.data.map(p=>Object.assign({},p,{data:p.data||{}}));S={};(sr.data||[]).forEach(s=>S[s.key]=s.value);
  deleted=[];setDirty(false);
  cur=Math.min(cur,P.length-1);
  renderList();openPage(cur<0?0:cur);
}

/* ---------- page list ---------- */
function emptySlots(p){const t=document.createElement('template');t.innerHTML=p.html||'';return [...t.content.querySelectorAll('img')].filter(i=>!(i.getAttribute('src')||'').trim()).length;}
function willHide(p){return p.hidden||(p.data&&p.data.autoHide&&!FB.hasImage(p.html));}
const thumbRO=new ResizeObserver(es=>es.forEach(e=>{const w=e.target.clientWidth;if(w>0&&e.target.firstChild)e.target.firstChild.style.transform='scale('+(w/FB.PW)+')';}));
function thumbFor(p,i){
  const tb=document.createElement('div');tb.className='tb';const inn=document.createElement('div');inn.className='pgin';
  const s=FB.renderPage(p,i+1,S);s.classList.add('fbedit');s.querySelectorAll('img').forEach(im=>{im.loading='lazy';markEmpty(im);});
  inn.appendChild(s);tb.appendChild(inn);thumbRO.observe(tb);return tb;
}
function renderList(){
  const L=$('plist');L.innerHTML='';
  P.forEach((p,i)=>{
    const el=document.createElement('div');el.className='pi'+(i===cur?' cur':'');el.dataset.i=i;
    el.appendChild(thumbFor(p,i));
    const m=document.createElement('div');m.className='meta';
    const es=emptySlots(p);
    m.innerHTML='<div class="no">Hal. '+(i+1)+'</div><div class="nm"></div><div class="bd">'+
      (p.hidden?'<span class="bdg h">Disembunyikan</span>':'')+
      (!p.hidden&&willHide(p)?'<span class="bdg h">Belum tampil (kosong)</span>':'')+
      (es?'<span class="bdg w">'+es+' gambar akan diperbarui</span>':'')+
      ((p.data.akhlak||[]).length?'<span class="bdg a">BerAKHLAK</span>':'')+'</div>';
    m.querySelector('.nm').textContent=p.title||'(tanpa judul)';
    el.appendChild(m);
    const mv=document.createElement('div');mv.className='mv';
    mv.innerHTML='<button title="Naikkan" data-mv="-1">▲</button><button title="Turunkan" data-mv="1">▼</button>';
    el.appendChild(mv);
    el.onclick=e=>{const b=e.target.closest('[data-mv]');if(b){e.stopPropagation();move(i,+b.dataset.mv);return;}openPage(i);};
    L.appendChild(el);
  });
  const vis=FB.publicPages(P).length;
  $('pcount').textContent=P.length+' total · '+vis+' tampil';
}
function refreshThumb(i){
  const el=$('plist').children[i];if(!el)return;
  const old=el.querySelector('.tb');const nt=thumbFor(P[i],i);el.replaceChild(nt,old);
  const es=emptySlots(P[i]);const p=P[i];
  el.querySelector('.nm').textContent=p.title||'(tanpa judul)';
  el.querySelector('.bd').innerHTML=(p.hidden?'<span class="bdg h">Disembunyikan</span>':'')+(!p.hidden&&willHide(p)?'<span class="bdg h">Belum tampil (kosong)</span>':'')+(es?'<span class="bdg w">'+es+' gambar akan diperbarui</span>':'')+((p.data.akhlak||[]).length?'<span class="bdg a">BerAKHLAK</span>':'');
  $('pcount').textContent=P.length+' total · '+FB.publicPages(P).length+' tampil';
}
function move(i,d){
  const j=i+d;if(j<0||j>=P.length)return;
  syncCur();
  [P[i],P[j]]=[P[j],P[i]];
  if(cur===i)cur=j;else if(cur===j)cur=i;
  setDirty(true);renderList();openPage(cur,true);
}
/* ---------- editor ---------- */
const BLOCKS=new Set(['P','H1','H2','H3','H4','H5','H6','DIV','LI','UL','OL','SPAN','B','I','EM','STRONG','SMALL','BLOCKQUOTE','TD','TH','FIGCAPTION','A','U','SUB','SUP']);
function markEmpty(im){
  const empty=!(im.getAttribute('src')||'').trim();
  const fig=im.closest('.fig');
  if(fig){fig.classList.toggle('isempty',empty&&fig.classList.contains('slot'));}
}
function makeEditable(s){
  const skip=el=>el.closest('[data-slot],[data-auto],svg');
  const all=[...s.querySelectorAll('*')];
  for(const el of all){
    if(!BLOCKS.has(el.tagName)||skip(el))continue;
    if(el.parentElement&&el.parentElement.closest('[contenteditable=true]'))continue;
    const hasText=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
    if(!hasText)continue;
    let host=el;
    if(el.tagName==='LI'){host=el.closest('ul,ol')||el;}
    if(host.closest('[contenteditable=true]'))continue;
    host.setAttribute('contenteditable','true');host.setAttribute('spellcheck','false');
  }
  s.querySelectorAll('img').forEach(markEmpty);
}
function cleanClone(s){
  const c=s.cloneNode(true);
  c.querySelectorAll('[data-auto]').forEach(e=>e.remove());
  c.querySelectorAll('[data-slot]').forEach(e=>e.innerHTML='');
  c.querySelectorAll('[contenteditable]').forEach(e=>{e.removeAttribute('contenteditable');e.removeAttribute('spellcheck');});
  c.querySelectorAll('.selimg').forEach(e=>e.classList.remove('selimg'));
  c.querySelectorAll('.isempty,.selslot').forEach(e=>e.classList.remove('isempty','selslot'));
  c.querySelectorAll('[class=""]').forEach(e=>e.removeAttribute('class'));
  c.querySelectorAll('[style=""]').forEach(e=>e.removeAttribute('style'));
  return c.innerHTML.trim();
}
function norm(html){
  const d=document.createElement('div');d.innerHTML=html||'';
  d.querySelectorAll('[style]').forEach(e=>{const c=e.style.cssText;if(c)e.setAttribute('style',c);else e.removeAttribute('style');});
  return d.innerHTML.trim();
}
function syncCur(){
  if(!sec||preview||!P[cur])return;
  const h=norm(cleanClone(sec));
  if(h!==baseHtml){P[cur].html=h;baseHtml=h;setDirty(true);}
}
let canvasScale=1, baseHtml='';
function fitCanvas(){
  const w=$('canvasWrap');const avail=Math.max(280,w.clientWidth-48);
  canvasScale=Math.min(1.1,avail/FB.PW);
  const box=$('canvasBox');box.style.width=(FB.PW*canvasScale)+'px';box.style.height=(FB.PH*canvasScale)+'px';
  if(box.firstChild)box.firstChild.style.transform='scale('+canvasScale+')';
}
addEventListener('resize',fitCanvas);
function openPage(i,noSync){
  if(!noSync)syncCur();
  if(i<0||i>=P.length){$('canvasBox').innerHTML='';sec=null;renderPanel();return;}
  cur=i;selImg=null;
  [...$('plist').children].forEach((el,k)=>el.classList.toggle('cur',k===i));
  const box=$('canvasBox');box.innerHTML='';
  const inn=document.createElement('div');inn.className='pgin';
  const p=P[i];
  if(preview){
    const t=Object.assign({},p);
    sec=FB.renderPage(t,i+1,S);
  }else{
    sec=FB.renderPage(p,i+1,S);sec.classList.add('fbedit');makeEditable(sec);
    baseHtml=norm(cleanClone(sec));
  }
  inn.appendChild(sec);box.appendChild(inn);fitCanvas();
  const el=$('plist').children[i];el&&el.scrollIntoView({block:'nearest'});
  renderPanel();checkOverflow();
}
function checkOverflow(){
  if(!sec)return;
  let msg='';
  sec.querySelectorAll('.pad').forEach(pad=>{
    const pr=pad.getBoundingClientRect();
    [...pad.children].forEach(c=>{const cr=c.getBoundingClientRect();if(cr.bottom>pr.bottom+2)msg='⚠ Isi halaman ini melebihi batas bawah. Perpendek teks, perkecil huruf (A−), atau kecilkan tinggi gambar.';});
  });
  $('warn').textContent=msg;$('warn').classList.toggle('on',!!msg);
}
let inputT=null;
document.addEventListener('input',e=>{
  if(!sec||!sec.contains(e.target))return;
  setDirty(true);clearTimeout(inputT);inputT=setTimeout(()=>{syncCur();refreshThumb(cur);checkOverflow();},700);
});
/* toolbar */
function curHost(){const s=getSelection();if(!s.rangeCount)return null;let n=s.anchorNode;if(n&&n.nodeType===3)n=n.parentElement;return n&&sec&&sec.contains(n)?n.closest('[contenteditable=true]'):null;}
$('tools').addEventListener('mousedown',e=>{if(e.target.closest('.tb'))e.preventDefault();});
$('tools').addEventListener('click',e=>{
  const b=e.target.closest('.tb');if(!b||preview)return;
  const host=curHost();
  if(b.dataset.cmd){
    if(!host&&!/undo|redo/.test(b.dataset.cmd)){toast('Klik dulu teks yang ingin diubah.');return;}
    document.execCommand(b.dataset.cmd,false,null);
  }else if(b.dataset.block){
    if(!host){toast('Klik dulu teks yang ingin diubah.');return;}
    const tag=b.dataset.block;
    if(/^(P|H\d)$/.test(host.tagName)&&host.parentElement){
      // ganti tag elemen host
      const n=document.createElement(tag);[...host.attributes].forEach(a=>n.setAttribute(a.name,a.value));
      if(tag==='p'){n.classList.remove('title');}
      n.innerHTML=host.innerHTML;host.replaceWith(n);
    }else document.execCommand('formatBlock',false,tag);
  }else if(b.dataset.size){
    if(!host){toast('Klik dulu teks yang ingin diubah.');return;}
    const fs=parseFloat(getComputedStyle(host).fontSize);const pt=fs*0.75;
    const np=Math.max(5,Math.round((pt+(+b.dataset.size)*0.6)*10)/10);host.style.fontSize=np+'pt';
  }
  setDirty(true);setTimeout(()=>{syncCur();refreshThumb(cur);checkOverflow();},50);
});
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save();}
});
// tempel teks tanpa format (supaya gaya majalah tetap rapi)
document.addEventListener('paste',e=>{
  if(!sec||!sec.contains(e.target))return;
  const t=(e.clipboardData||window.clipboardData).getData('text/plain');
  if(t!=null){e.preventDefault();document.execCommand('insertText',false,t);}
});
$('bPrev').onclick=()=>{syncCur();preview=!preview;$('bPrev').classList.toggle('sun',preview);$('bPrev').innerHTML=preview?'✎ <em>Kembali Edit</em>':'👁 <em>Pratinjau</em>';openPage(cur,true);};
/* image click */
$('canvasBox').addEventListener('click',e=>{
  if(preview||!sec)return;
  const ak=e.target.closest('[data-slot=akhlak]');
  if(ak){const s=$('secAkh');s&&s.scrollIntoView({behavior:'smooth'});return;}
  let im=e.target.closest('img');
  if(!im){const f=e.target.closest('.fig');if(f)im=f.querySelector('img');}
  if(!im||!sec.contains(im)||im.closest('[data-auto],[data-slot]'))return;
  e.preventDefault();selectImg(im);
});
function selectImg(im){
  sec.querySelectorAll('.selimg,.selslot').forEach(x=>x.classList.remove('selimg','selslot'));
  selImg=im;im.classList.add('selimg');const f=im.closest('.fig.slot');f&&f.classList.add('selslot');
  renderPanel();const s=$('secImg');s&&s.scrollIntoView({behavior:'smooth',block:'start'});
}
/* ---------- right panel ---------- */
const esc=FB.esc;
function renderPanel(){
  const pn=$('panel');pn.innerHTML='';
  const p=P[cur];if(!p)return;
  // image section
  if(selImg&&sec&&sec.contains(selImg)){
    const src=selImg.getAttribute('src')||'';
    const fig=selImg.closest('.fig');const gal=selImg.closest('[data-gallery]');
    const s=document.createElement('div');s.className='sec';s.id='secImg';
    const pos=selImg.style.objectPosition||'';const fit=selImg.style.objectFit||'';
    s.innerHTML='<h3>Gambar terpilih</h3><div class="imgprev" style="'+(src?'background-image:url(\''+esc(src)+'\')':'')+'">'+(src?'':'Gambar akan diperbarui')+'</div>'+
     '<div class="row"><button class="btn pri" data-a="rep">'+(src?'Ganti gambar':'Unggah gambar')+'</button>'+(src?'<button class="btn dan" data-a="del">Hapus gambar</button>':'')+'</div>'+
     (fig?'<label>Posisi gambar</label><select data-a="pos"><option value="">Tengah</option><option value="top">Atas</option><option value="bottom">Bawah</option><option value="left">Kiri</option><option value="right">Kanan</option></select>'+
      '<label>Tampilan</label><select data-a="fit"><option value="">Bawaan</option><option value="cover">Penuhi kotak (dipotong)</option><option value="contain">Utuh (tidak dipotong)</option></select>'+
      '<label>Tinggi kotak gambar</label><div class="row" style="margin-top:0"><button class="btn sm" data-a="h-">− 5 mm</button><button class="btn sm" data-a="h+">+ 5 mm</button><span class="muted" data-hv></span></div>':'')+
     (gal?'<label>Kotak gambar di galeri ini</label><div class="row" style="margin-top:0"><button class="btn sm" data-a="addslot">＋ Tambah kotak</button><button class="btn sm dan" data-a="rmslot">Hapus kotak ini</button></div>':'')+
     '<p class="muted" style="margin-top:10px">Format JPG/PNG/WebP. Foto otomatis diperkecil (maks. 2000 px) sebelum diunggah. Foto HEIC dari iPhone: ubah dulu ke JPG.</p>';
    pn.appendChild(s);
    const sp=s.querySelector('[data-a=pos]');if(sp)sp.value=pos.split(' ')[0]==='center'?'':pos;
    const sf=s.querySelector('[data-a=fit]');if(sf)sf.value=fit;
    const hv=s.querySelector('[data-hv]');if(hv&&fig)hv.textContent=fig.style.height||'';
    s.addEventListener('click',e=>{const a=e.target.closest('button')&&e.target.closest('button').dataset.a;if(!a)return;
      if(a==='rep')pickFile(f=>replaceImage(selImg,f));
      if(a==='del')removeImage(selImg);
      if(a==='h-'||a==='h+')resizeFig(fig,a==='h+'?5:-5);
      if(a==='addslot')addSlot(gal,selImg.closest('.figwrap')||fig.parentElement);
      if(a==='rmslot')removeSlot(selImg.closest('.figwrap')||fig.parentElement);
    });
    s.addEventListener('change',e=>{const a=e.target.dataset.a;
      if(a==='pos'){selImg.style.objectPosition=e.target.value;}
      if(a==='fit'){selImg.style.objectFit=e.target.value;}
      changed();});
  }
  // page settings
  const s2=document.createElement('div');s2.className='sec';
  s2.innerHTML='<h3>Pengaturan halaman '+(cur+1)+'</h3><label>Judul (untuk daftar halaman)</label><input type="text" data-k="title">'+
    '<label class="chk"><input type="checkbox" data-k="hidden"> Sembunyikan dari majalah</label>'+
    '<label class="chk"><input type="checkbox" data-k="autoHide"> Sembunyikan otomatis bila semua gambar masih kosong</label>'+
    '<div class="row"><button class="btn sm" data-a="up">▲ Naikkan</button><button class="btn sm" data-a="down">▼ Turunkan</button><button class="btn sm" data-a="dup">⧉ Duplikat</button><button class="btn sm dan" data-a="rm">🗑 Hapus halaman</button></div>';
  pn.appendChild(s2);
  s2.querySelector('[data-k=title]').value=p.title||'';
  s2.querySelector('[data-k=hidden]').checked=!!p.hidden;
  s2.querySelector('[data-k=autoHide]').checked=!!(p.data&&p.data.autoHide);
  s2.addEventListener('input',e=>{const k=e.target.dataset.k;if(!k)return;
    if(k==='title')p.title=e.target.value;if(k==='hidden')p.hidden=e.target.checked;
    if(k==='autoHide'){p.data=Object.assign({},p.data,{autoHide:e.target.checked});if(!e.target.checked)delete p.data.autoHide;}
    setDirty(true);refreshThumb(cur);});
  s2.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset.a;
    if(a==='up')move(cur,-1);if(a==='down')move(cur,1);
    if(a==='rm')deletePage(cur);if(a==='dup')duplicatePage(cur);});
  // BerAKHLAK
  const hasSlot=/data-slot="akhlak"/.test(p.html);
  const s3=document.createElement('div');s3.className='sec';s3.id='secAkh';
  if(hasSlot){
    const items=p.data.akhlak||[];const map={};items.forEach(it=>map[it.v]=it.t);
    s3.innerHTML='<h3>Nilai BerAKHLAK</h3><p class="muted" style="margin:0">Centang nilai yang diterapkan pada kegiatan ini dan tulis penjelasan singkatnya.</p>'+
      '<label>Nomor kegiatan (lencana)</label><input type="text" data-kno value="'+esc(p.data.kno||'')+'" placeholder="mis. 1">'+
      FB.NAMES.map(n=>{const on=n in map;const c=FB.AKH[n].c;return '<div class="akv'+(on?'':' off')+'" data-v="'+esc(n)+'"><label class="chk hd" style="margin:0"><input type="checkbox"'+(on?' checked':'')+'><span class="dot" style="background:'+c+'"></span>'+esc(n)+'</label><textarea rows="3">'+esc(on?map[n]:DEFAULT_TEXT[n])+'</textarea></div>';}).join('')+
      '<div class="row"><button class="btn sm dan" data-a="rmakh">Hapus blok BerAKHLAK dari halaman</button></div>';
    const upd=()=>{
      const arr=[];s3.querySelectorAll('.akv').forEach(d=>{const cb=d.querySelector('input');d.classList.toggle('off',!cb.checked);if(cb.checked)arr.push({v:d.dataset.v,t:d.querySelector('textarea').value.trim()});});
      p.data=Object.assign({},p.data,{akhlak:arr});
      const k=s3.querySelector('[data-kno]').value.trim();if(k)p.data.kno=k;else delete p.data.kno;
      if(arr.length&&p.type==='custom')p.type='kegiatan';
      if(sec)FB.fillSlots(sec,p,S);setDirty(true);refreshThumb(cur);checkOverflow();
    };
    s3.addEventListener('input',upd);s3.addEventListener('change',upd);
    s3.querySelector('[data-a=rmakh]').onclick=()=>{if(!confirm('Hapus blok BerAKHLAK dari halaman ini?'))return;syncCur();
      p.html=p.html.replace(/<div data-slot="akhlak"><\/div>/g,'');p.data=Object.assign({},p.data);delete p.data.akhlak;setDirty(true);openPage(cur,true);refreshThumb(cur);};
  }else{
    s3.innerHTML='<h3>Nilai BerAKHLAK</h3><p class="muted" style="margin:0 0 8px">Halaman ini belum memiliki blok BerAKHLAK.</p><button class="btn sm" data-a="addakh">＋ Tambahkan blok BerAKHLAK</button>';
    s3.querySelector('[data-a=addakh]').onclick=()=>{syncCur();
      const t=document.createElement('template');t.innerHTML=p.html;const pad=t.content.querySelector('.pad');
      const d=document.createElement('div');d.setAttribute('data-slot','akhlak');(pad||t.content).appendChild(d);
      p.html=t.innerHTML;p.data=Object.assign({},p.data,{akhlak:[]});setDirty(true);openPage(cur,true);refreshThumb(cur);};
  }
  pn.appendChild(s3);
  const s4=document.createElement('div');s4.className='sec';
  s4.innerHTML='<h3>Cara cepat</h3><ul class="muted" style="padding-left:18px;margin:0"><li>Klik teks di halaman untuk langsung mengetik.</li><li>Klik gambar / kotak “Gambar akan diperbarui” untuk mengunggah.</li><li>Tekan <b>Simpan &amp; Terbitkan</b> agar perubahan tampil di majalah.</li></ul>';
  pn.appendChild(s4);
}
function changed(){setDirty(true);syncCur();refreshThumb(cur);checkOverflow();}
function resizeFig(fig,d){
  const mm=parseFloat(fig.style.height)||Math.round(fig.getBoundingClientRect().height/canvasScale/3.7795);
  fig.style.height=Math.max(15,mm+d)+'mm';changed();renderPanel();
}
function addSlot(gal,ref){
  const n=gal.querySelectorAll('.fig').length+1;
  const h=(ref&&ref.querySelector('.fig')&&ref.querySelector('.fig').style.height)||'90mm';
  const w=document.createElement('div');w.className='figwrap empty';
  w.innerHTML='<div class="fig doc slot" data-label="Gambar '+n+'" style="height:'+h+'"><img src="" alt=""></div><div class="cap">Keterangan gambar '+n+'</div>';
  gal.appendChild(w);makeEditable(w);changed();selectImg(w.querySelector('img'));
}
function removeSlot(w){if(!w||!confirm('Hapus kotak gambar ini beserta keterangannya?'))return;w.remove();selImg=null;changed();renderPanel();}
function removeImage(im){
  if(!confirm('Hapus gambar ini? Kotaknya akan menjadi “Gambar akan diperbarui” dan tidak tampil di majalah sampai diisi lagi.'))return;
  im.setAttribute('src','');
  const fig=im.closest('.fig');
  if(fig){fig.classList.add('slot');const w=fig.parentElement;
    const isWrap=w&&!w.classList.contains('pad')&&[...w.children].every(c=>c===fig||c.classList.contains('cap'));
    (isWrap?w:fig).classList.add('figwrap','empty');}
  markEmpty(im);changed();renderPanel();
}
/* ---------- image upload ---------- */
let fileCb=null;
function pickFile(cb){fileCb=cb;const fi=$('fileIn');fi.value='';fi.click();}
$('fileIn').addEventListener('change',e=>{const f=e.target.files[0];if(f&&fileCb)fileCb(f);});
async function compress(file,maxSide){
  maxSide=maxSide||2000;
  const isHeic=/heic|heif/i.test(file.type)||/\.(heic|heif)$/i.test(file.name);
  let bmp;
  try{bmp=await createImageBitmap(file);}catch(err){
    throw new Error(isHeic?'Format HEIC (foto iPhone) belum didukung browser ini. Ubah dulu ke JPG — misalnya kirim fotonya lewat WhatsApp lalu simpan, atau di iPhone: Pengaturan › Kamera › Format › “Paling Kompatibel”.':'File ini bukan gambar yang bisa dibaca. Gunakan JPG, PNG, atau WebP.');
  }
  if(file.type==='image/svg+xml')return {blob:file,ext:'svg',type:'image/svg+xml'};
  const k=Math.min(1,maxSide/Math.max(bmp.width,bmp.height));
  const w=Math.round(bmp.width*k),h=Math.round(bmp.height*k);
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
  const keepAlpha=/png|webp|gif/i.test(file.type);
  if(!keepAlpha){x.fillStyle='#fff';x.fillRect(0,0,w,h);}
  x.drawImage(bmp,0,0,w,h);
  let type=keepAlpha?'image/png':'image/jpeg';
  if(keepAlpha){ // cek apakah ada piksel transparan; kalau tidak, pakai JPEG agar lebih kecil
    const d=x.getImageData(0,0,w,h).data;let alpha=false;for(let i=3;i<d.length;i+=16){if(d[i]<250){alpha=true;break;}}
    if(!alpha){type='image/jpeg';const c2=document.createElement('canvas');c2.width=w;c2.height=h;const x2=c2.getContext('2d');x2.fillStyle='#fff';x2.fillRect(0,0,w,h);x2.drawImage(c,0,0);return blobOf(c2,type);}
  }
  return blobOf(c,type);
}
function blobOf(c,type){return new Promise((res,rej)=>c.toBlob(b=>b?res({blob:b,ext:type==='image/png'?'png':'jpg',type}):rej(new Error('Gagal memproses gambar')),type,0.85));}
async function upload(file,folder,maxSide){
  const {blob,ext,type}=await compress(file,maxSide);
  if(blob.size>10*1024*1024)throw new Error('Ukuran gambar masih di atas 10 MB setelah dikompres.');
  const path=(folder||'pages')+'/'+new Date().toISOString().slice(0,10)+'-'+uid().slice(0,8)+'.'+ext;
  const {error}=await sb.storage.from(BUCKET).upload(path,blob,{contentType:type,cacheControl:'31536000',upsert:false});
  if(error)throw new Error('Gagal mengunggah: '+error.message);
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
async function replaceImage(im,file){
  busy(true,'Mengunggah gambar…');
  try{
    const url=await upload(file,'pages');
    await new Promise(r=>{const t=new Image();t.onload=t.onerror=r;t.src=url;});
    im.setAttribute('src',url);
    const fig=im.closest('.fig');
    if(fig){const w=fig.closest('.figwrap');w&&w.classList.remove('empty');fig.classList.remove('empty');}
    markEmpty(im);changed();renderPanel();toast('Gambar diperbarui. Jangan lupa Simpan & Terbitkan.');
  }catch(err){toast(err.message,true);}
  busy(false);
}
/* ---------- add / delete pages ---------- */
const TPL={
 notulen:{title:'Notulen Kegiatan',type:'notulen',data:{autoHide:true},html:'<div class="pad">\n<div class="kicker">Dokumentasi</div>\n<h1 class="title">Notulen <em>Kegiatan</em></h1>\n<p class="lead" style="margin-bottom:5mm">Notulen dan dokumentasi pertemuan selama pelaksanaan kegiatan aktualisasi.</p>\n<div class="grid gallery" data-gallery style="grid-template-columns:1fr 1fr;gap:5mm">'+[1,2,3,4].map(n=>'<div class="figwrap empty"><div class="fig doc slot" data-label="Notulen '+n+'" style="height:100mm"><img src="" alt=""></div><div class="cap">Notulen '+n+'</div></div>').join('')+'</div></div>'},
 textimg:{title:'Halaman Baru',type:'custom',data:{},html:'<div class="pad">\n<div class="kicker">Rubrik</div>\n<h1 class="title">Judul <em>Halaman</em></h1>\n<p class="lead" style="margin-bottom:5mm">Tulis pengantar singkat halaman ini.</p>\n<div class="grid" style="grid-template-columns:1fr 1fr;gap:6mm;align-items:start">\n<div><p>Tulis isi paragraf di sini. Klik teks ini untuk mengubahnya.</p>\n<h3 style="font-size:14pt;margin:4mm 0 2mm">Subjudul</h3>\n<ul class="clean"><li>Poin pertama</li><li>Poin kedua</li></ul></div>\n<div class="figwrap empty"><div class="fig slot" data-label="Gambar" style="height:110mm"><img src="" alt=""></div><div class="cap">Keterangan gambar</div></div>\n</div></div>'},
 text:{title:'Halaman Teks',type:'custom',data:{},html:'<div class="pad">\n<div class="kicker">Rubrik</div>\n<h1 class="title">Judul <em>Halaman</em></h1>\n<p class="lead" style="margin-bottom:5mm">Tulis pengantar singkat halaman ini.</p>\n<p>Tulis isi paragraf di sini.</p>\n<p>Paragraf berikutnya.</p></div>'}
};
$('bAdd').onclick=()=>$('mAdd').classList.add('on');
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-close]'))m.classList.remove('on');}));
document.querySelectorAll('[data-tpl]').forEach(b=>b.onclick=()=>{
  syncCur();const t=TPL[b.dataset.tpl];
  const rec={id:uid(),book:FB.BOOK,position:0,type:t.type,title:t.title,cls:'',html:t.html,data:JSON.parse(JSON.stringify(t.data)),hidden:false,_new:true};
  let at=$('addAfter').checked?cur+1:P.length-1; // default: sebelum sampul belakang
  if(at>=P.length)at=P.length-1;
  P.splice(at,0,rec);$('mAdd').classList.remove('on');setDirty(true);renderList();openPage(at,true);toast('Halaman ditambahkan. Klik kotak gambar untuk mengunggah.');
});
function deletePage(i){
  if(!confirm('Hapus halaman '+(i+1)+' “'+(P[i].title||'')+'”? Tindakan ini berlaku setelah Simpan & Terbitkan.'))return;
  const [r]=P.splice(i,1);if(r.id&&!r._new)deleted.push(r.id);
  setDirty(true);renderList();openPage(Math.min(i,P.length-1),true);
}
function duplicatePage(i){
  syncCur();const r=JSON.parse(JSON.stringify(P[i]));r.id=uid();r._new=true;r.title=(r.title||'')+' (salinan)';
  P.splice(i+1,0,r);setDirty(true);renderList();openPage(i+1,true);
}
/* ---------- logos ---------- */
let LG=[];
function curLogos(){return JSON.parse(JSON.stringify((S.logos&&S.logos.items)||FB.DEFAULT_LOGOS));}
function renderLogos(){
  const L=$('lgList');L.innerHTML='';
  LG.forEach((l,i)=>{
    const r=document.createElement('div');r.className='lgrow';
    r.innerHTML='<div class="lgprev"><div class="w"><img src="'+esc(l.src)+'" alt=""></div><div class="d"><img src="'+esc(l.src)+'" alt=""></div></div>'+
      '<div><label style="font-size:12px;font-weight:700">Nama logo</label><input type="text" value="'+esc(l.alt||'')+'">'+
      '<div class="row" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button class="btn sm pri" data-a="rep">Ganti file</button><button class="btn sm" data-a="up">▲</button><button class="btn sm" data-a="down">▼</button>'+
      '<label class="chk" style="font-size:12px"><input type="checkbox"'+(l.show===false?'':' checked')+'> Tampilkan</label></div></div>';
    r.querySelector('input[type=text]').oninput=e=>{l.alt=e.target.value;};
    r.querySelector('input[type=checkbox]').onchange=e=>{l.show=e.target.checked;};
    r.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset.a;
      if(a==='up'&&i>0){[LG[i-1],LG[i]]=[LG[i],LG[i-1]];renderLogos();}
      if(a==='down'&&i<LG.length-1){[LG[i+1],LG[i]]=[LG[i],LG[i+1]];renderLogos();}
      if(a==='rep')pickFile(async f=>{busy(true,'Mengunggah logo…');try{l.src=await upload(f,'logos',800);renderLogos();toast('Logo diunggah. Klik Simpan Logo.');}catch(err){toast(err.message,true);}busy(false);});
    });
    L.appendChild(r);
  });
}
$('bLogos').onclick=()=>{LG=curLogos();renderLogos();$('mLogos').classList.add('on');};
$('lgReset').onclick=()=>{if(confirm('Kembalikan ke 4 logo bawaan?')){LG=JSON.parse(JSON.stringify(FB.DEFAULT_LOGOS));renderLogos();}};
$('lgSave').onclick=async()=>{
  busy(true,'Menyimpan logo…');
  const val={items:LG};
  const {error}=await sb.from('flipbook_settings').upsert({key:'logos',value:val,updated_at:new Date().toISOString()});
  busy(false);
  if(error){toast('Gagal menyimpan logo: '+error.message,true);return;}
  S.logos=val;$('mLogos').classList.remove('on');syncCur();renderList();openPage(cur,true);toast('Logo header disimpan & langsung tampil di majalah.');
};
/* ---------- save ---------- */
async function save(){
  syncCur();
  busy(true,'Menyimpan & menerbitkan…');
  try{
    const now=new Date().toISOString();
    const rows=P.map((p,i)=>({id:p.id,book:FB.BOOK,position:i+1,type:p.type||'custom',title:p.title||'',cls:p.cls||'',html:p.html||'',data:p.data||{},hidden:!!p.hidden,updated_at:now}));
    const {error}=await sb.from('flipbook_pages').upsert(rows);
    if(error)throw error;
    if(deleted.length){const {error:e2}=await sb.from('flipbook_pages').delete().in('id',deleted);if(e2)throw e2;}
    P.forEach(p=>delete p._new);deleted=[];setDirty(false);
    toast('Tersimpan ✓ Perubahan sudah tampil di majalah.');
  }catch(err){toast('Gagal menyimpan: '+(err.message||err),true);if(/JWT|session/i.test(err.message||''))setTimeout(()=>location.reload(),2500);}
  busy(false);
}
$('bSave').onclick=save;
window.__fbAdmin={state:()=>P,save,openPage,selectImg:i=>selectImg(i),get sec(){return sec;}};
start();
})();
