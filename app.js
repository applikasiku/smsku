const $ = id => document.getElementById(id);
const API = 'https://api.mail.tm';
const MAIL_PROVIDERS=[{name:'Mail.tm',api:API},{name:'Mail.gw (Worker privat)',api:'/api/mail'}];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<img class="ui-icon" src="/icons/${['mail','inbox'].includes(name)?'app-192':name}.png" width="24" height="24" alt="">`;
const storage = {get(k){try{return sessionStorage.getItem(k)}catch{return null}},set(k,v){try{sessionStorage.setItem(k,v)}catch{}},remove(k){try{sessionStorage.removeItem(k)}catch{}}};
let mailbox=null, messages=[], otps=[], page=1, hasMore=false, busy=false, generation=0, installPrompt=null, timer;
try { const saved=JSON.parse(storage.get('smsku_mail')); if(saved?.address&&saved?.token&&(!saved.api||MAIL_PROVIDERS.some(p=>p.api===saved.api))) mailbox=saved; } catch{}
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>$('toast').classList.remove('show'),4000)}
async function api(path, opts={}, session=mailbox, base=session?.api||API){
 if(!MAIL_PROVIDERS.some(p=>p.api===base))throw Error('Penyedia email tidak valid.');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),base==='/api/mail'?20000:12000);
 try{
  const backend=base==='/api/mail';
  const access=$('mailAccess').value||$('smsAccess').value;
  if(backend&&!access)throw Error('Isi kode akses pribadi pada kolom email untuk menggunakan cadangan Mail.gw.');
  const auth=backend?{Authorization:'Bearer '+access,...(session?.token?{'X-Mail-Token':session.token}:{})}:(session?.token?{Authorization:`Bearer ${session.token}`} : {});
  const response=await fetch(base+path,{...opts,signal:controller.signal,credentials:'omit',redirect:'error',headers:{Accept:'application/ld+json',...(opts.body?{'Content-Type':'application/json'}:{}),...auth,...opts.headers}});
  if(!response.ok){let detail;try{detail=await response.json()}catch{}const error=new Error(detail?.error||(response.status===429?'Penyedia email membatasi permintaan. Tunggu sebentar sebelum mencoba lagi.':response.status===401?'Sesi email kedaluwarsa. Buat email baru.':`Layanan email gagal (${response.status})`));error.status=response.status;throw error;}
  if(response.status===204)return null;
  try{return await response.json()}catch{throw Error('Respons penyedia email tidak valid. Coba penyedia lain.')}
 }catch(error){
  if(controller.signal.aborted){const e=new Error('Penyedia email tidak merespons dalam batas waktu koneksi.');e.network=true;throw e}
  if(error instanceof TypeError){const e=new Error('Browser tidak dapat menjangkau penyedia email. Periksa koneksi atau pilih penyedia lain.');e.network=true;throw e}
  throw error;
 }finally{clearTimeout(timeout)}
}

function nav(id){document.querySelectorAll('.nav').forEach(n=>{n.classList.toggle('active',n.dataset.tab===id);n.setAttribute('aria-current',n.dataset.tab===id?'page':'false')});document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.id===id));window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>nav(b.dataset.tab));document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>nav(b.dataset.goto));
let dark=false;try{dark=localStorage.getItem('smsku_theme')==='dark'}catch{}
function applyTheme(){document.body.classList.toggle('dark',dark);$('theme').innerHTML=icon(dark?'sun':'bright-moon');$('theme').setAttribute('aria-pressed',String(dark))}
function theme(){dark=!dark;try{localStorage.setItem('smsku_theme',dark?'dark':'light')}catch{}applyTheme()}
applyTheme();$('theme').onclick=theme;$('themeSettings').onclick=theme;
async function copy(value){try{await navigator.clipboard.writeText(value);toast('Berhasil disalin')}catch{toast('Salin otomatis tidak tersedia. Pilih dan salin teks secara manual.')}}
function update(){for(const id of ['messageCount','inboxCount'])$(id).textContent=messages.length;$('mailCount').textContent=mailbox?1:0;$('address').textContent=mailbox?.address||'Belum ada alamat email';for(const id of ['copyAddress','refreshMail','clearMail'])$(id).disabled=!mailbox;$('mailStatus').textContent=mailbox?'Aktif':'Belum dibuat';$('loadMore').hidden=!hasMore;$('mailInfo').textContent=mailbox?'Refresh otomatis setiap 20 detik saat halaman terbuka. Sesi dipulihkan saat reload di tab ini; menutup tab dapat menghapus akses.':'';}
function detect(m,text){for(const code of new Set((text||'').match(/\b\d{4,8}\b/g)||[])){if(!otps.some(o=>o.id===m.id&&o.code===code))otps.push({code,id:m.id,from:m.from?.address||'Email'})}renderOtps()}
function renderOtps(){const el=$('otpList');el.className=otps.length?'':'empty';el.innerHTML=otps.length?otps.map((o,i)=>`<div class="message"><b>${esc(o.code)}</b><small>${esc(o.from)}</small><button class="small-btn" data-copy="${i}">Salin kode</button></div>`).join(''):`<span>${icon('lock')}</span><b>Belum ada kode</b><p>Kode angka dari subjek dan pratinjau dideteksi otomatis. Buka pesan untuk memeriksa isi lengkap. Hasil deteksi bisa memuat angka selain OTP.</p>`;el.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>copy(otps[Number(b.dataset.copy)].code))}
function renderMessages(){const el=$('mailMessages');el.className=messages.length?'':'empty';if(!messages.length){el.innerHTML=`<span>${icon('mail')}</span><b>Inbox kosong</b><p>Pesan baru diperiksa otomatis saat halaman terbuka.</p>`;return;}
 const open=new Set([...el.querySelectorAll('details[open]')].map(d=>d.dataset.id));
 const bodies=new Map([...el.querySelectorAll('details[data-loaded="1"]')].map(d=>[d.dataset.id,d.querySelector('.body').textContent]));
 el.innerHTML=messages.map(m=>`<details class="message" data-id="${esc(m.id)}" ${open.has(m.id)?'open':''}><summary>${esc(m.subject||'(Tanpa subjek)')}</summary><small>Dari: ${esc(m.from?.address)} · ${esc(new Date(m.createdAt).toLocaleString('id-ID'))}</small><p>${esc(m.intro||'Buka untuk membaca pesan.')}</p><pre class="body"></pre><button class="small-btn danger" data-delete>Hapus pesan</button></details>`).join('');
 el.querySelectorAll('details').forEach(d=>{
 if(bodies.has(d.dataset.id)){d.dataset.loaded='1';d.querySelector('.body').textContent=bodies.get(d.dataset.id)}
 d.addEventListener('toggle',async()=>{if(!d.open||d.dataset.loaded)return;d.dataset.loaded='loading';const session=mailbox,stamp=generation;try{const m=await api('/messages/'+encodeURIComponent(d.dataset.id),{},session);if(stamp!==generation)return;const body=m.text||'Pesan ini hanya memiliki konten HTML. Tampilan HTML dinonaktifkan untuk keamanan.';d.querySelector('.body').textContent=body;d.dataset.loaded='1';detect(m,(m.subject||'')+' '+body)}catch(e){delete d.dataset.loaded;toast(e.message)}});
 d.querySelector('[data-delete]').onclick=async b=>{if(!confirm('Hapus pesan ini dari inbox penyedia?'))return;b.target.disabled=true;const stamp=generation;try{await api('/messages/'+encodeURIComponent(d.dataset.id),{method:'DELETE'});if(stamp!==generation)return;messages=messages.filter(m=>m.id!==d.dataset.id);otps=otps.filter(o=>o.id!==d.dataset.id);renderMessages();renderOtps();update();toast('Pesan dihapus')}catch(e){b.target.disabled=false;toast(e.message)}};
 });
}
async function refresh(quiet=false,more=false){if(!mailbox||busy)return;busy=true;const stamp=generation,session=mailbox;const target=more?page+1:1;$('refreshMail').disabled=true;$('loadMore').disabled=true;try{const data=await api('/messages?page='+target,{},session);if(stamp!==generation)return;const items=data['hydra:member']||[];messages=more?[...messages,...items.filter(m=>!messages.some(x=>x.id===m.id))]:items;page=target;hasMore=!!data['hydra:view']?.['hydra:next'];items.forEach(m=>detect(m,(m.subject||'')+' '+(m.intro||'')));renderMessages();update();if(!quiet)toast('Inbox diperbarui')}catch(e){if(stamp===generation){$('mailInfo').textContent=e.message;if(!quiet)toast(e.message);if(e.status===401){storage.remove('smsku_mail');mailbox=null;update();$('mailInfo').textContent=e.message}}}finally{busy=false;$('refreshMail').disabled=!mailbox;$('loadMore').disabled=false}}
$('createMail').onclick=async()=>{
 if(mailbox&&!confirm('Ganti alamat email? Akses inbox sebelumnya di tab ini akan dilepas.'))return;
 const btn=$('createMail');btn.disabled=true;btn.textContent='Mencari penyedia...';
 let stage='Memilih penyedia',chosen=null;
 try{
  const selection=$('mailProvider').value;
  const candidates=selection==='auto'?MAIL_PROVIDERS:MAIL_PROVIDERS.filter(p=>p.api===selection);
  let domain,lastError;
  // Only read-only domain discovery falls back automatically. Never replay account writes.
  for(const provider of candidates){
   $('mailInfo').textContent='Memeriksa '+provider.name+'...';
   try{const domains=await api('/domains?page=1',{},null,provider.api);domain=domains['hydra:member']?.find(d=>d.isActive&&!d.isPrivate)?.domain;if(!domain)throw Error('Domain aktif tidak tersedia.');chosen=provider;break}
   catch(e){lastError=e;if(e.status===429)throw e}
  }
  if(!chosen)throw lastError||Error('Penyedia email belum tersedia.');
  stage='Membuat alamat di '+chosen.name;btn.textContent='Membuat email...';
  const address=crypto.randomUUID().replaceAll('-','').slice(0,15)+'@'+domain,password=crypto.randomUUID()+crypto.randomUUID();
  const account=await api('/accounts',{method:'POST',body:JSON.stringify({address,password})},null,chosen.api);
  stage='Mengaktifkan inbox di '+chosen.name;
  const token=await api('/token',{method:'POST',body:JSON.stringify({address,password})},null,chosen.api);
  if(!account?.id||!token?.token)throw Error('Data aktivasi email tidak lengkap.');
  generation++;mailbox={id:account.id,address,token:token.token,api:chosen.api,provider:chosen.name};storage.set('smsku_mail',JSON.stringify(mailbox));messages=[];otps=[];page=1;hasMore=false;renderMessages();renderOtps();update();$('mailInfo').textContent='Email aktif melalui '+chosen.name+'. Refresh otomatis setiap 20 detik saat halaman terbuka. Sesi tersimpan di tab ini.';toast('Email sementara berhasil dibuat');
 }catch(e){const message=stage+': '+e.message;$('mailInfo').textContent=message+' Coba buka melalui Chrome dan pilih penyedia lainnya jika tetap gagal.';toast(message)}finally{btn.disabled=false;btn.textContent='Buat email gratis'}
};
$('copyAddress').onclick=()=>mailbox&&copy(mailbox.address);
$('clearMail').onclick=()=>{generation++;mailbox=null;messages=[];otps=[];hasMore=false;storage.remove('smsku_mail');renderMessages();renderOtps();update();toast('Sesi lokal dilepas. Akun di penyedia tidak dihapus.')};
$('refreshMail').onclick=()=>refresh();$('loadMore').onclick=()=>refresh(false,true);
$('generateSms').onclick=async()=>{
 const btn=$('generateSms'),key=$('smsAccess').value,paid=$('tier').value==='premium';
 if(!key){toast('Isi kode akses SMS pribadi terlebih dahulu');return;}
 if($('country').value!=='ID'){toast('Negara mengikuti SIM atau nomor yang dikonfigurasi, bukan pilihan generator.');return;}
 if(paid&&!confirm('Izinkan cadangan berbayar jika gateway gratis tidak tersedia? Biaya nomor dan penerimaan mengikuti provider. Tidak ada pembelian nomor otomatis.'))return;
 btn.disabled=true;btn.textContent='Memeriksa jalur gratis...';
 try{const r=await fetch('/api/sms?paid='+(paid?'yes':'no'),{headers:{Authorization:'Bearer '+key},cache:'no-store',signal:AbortSignal.timeout(35000)});let data;try{data=await r.json()}catch{throw Error('Backend SMS belum aktif. Pastikan Cloudflare Pages Functions telah terdeploy.')}if(!r.ok)throw Error(data.error||'Gagal memuat SMS');
 $('numCount').textContent='1';$('smsResult').className='';
 $('smsResult').innerHTML=`<div class="message"><b>${esc(data.number)}</b><small>${esc(data.provider)} · ${data.tier==='free'?'SIM sendiri':'Cadangan berbayar'}</small>${data.previewOnly?'<p>Gateway menampilkan pratinjau SMS; pesan panjang dapat terpotong.</p>':''}<button class="small-btn" id="copySmsNumber">Salin nomor</button></div>`+(data.messages.length?data.messages.map(m=>`<div class="message"><small>${esc(m.from)} · ${esc(m.date)}</small><pre>${esc(m.body)}</pre></div>`).join(''):'<div class="empty"><b>Belum ada SMS masuk</b><p>Klik Hubungkan & baca SMS untuk memeriksa kembali.</p></div>');
 $('copySmsNumber').onclick=()=>copy(data.number);data.messages.forEach(m=>detect({...m,id:'sms:'+data.tier+':'+m.id,from:{address:m.from}},m.body));toast('SMS dimuat melalui '+data.provider);
 }catch(e){$('smsResult').className='empty';$('smsResult').innerHTML='<b>Belum tersambung</b><p>'+esc(e.message)+'</p>';toast(e.message)}finally{btn.disabled=false;btn.textContent='Hubungkan & baca SMS'}
};
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('installApp').textContent='Pasang aplikasi'});
$('installApp').onclick=async()=>{if(!installPrompt){toast('Buka menu browser → Instal aplikasi / Tambahkan ke layar utama.');return;}await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null};
window.addEventListener('appinstalled',()=>{$('installApp').textContent='Terpasang';toast('SMSKU terpasang')});
setInterval(()=>{if(!document.hidden&&navigator.onLine)refresh(true)},20000);
window.addEventListener('online',()=>refresh(true));document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true)});
update();renderMessages();renderOtps();if(mailbox)refresh(true);
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>toast('Mode offline belum tersedia di browser ini.'));

const initialTab=location.hash.slice(1);if(["home","sms","mail","otp","settings"].includes(initialTab))nav(initialTab);

$('connectCloudSms').onclick=async()=>{
 const key=$('smsAccess').value;if(!key){toast('Isi kode akses SMS pribadi terlebih dahulu');return;}
 const btn=$('connectCloudSms');btn.disabled=true;btn.textContent='Menghubungkan...';
 try{const response=await fetch('/api/smsgate/setup',{method:'POST',headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(30000)});let data;try{data=await response.json()}catch{throw Error('Pages Functions belum terdeploy. Periksa Cloudflare.')}
 if(!response.ok)throw Error((data.error||'Koneksi gagal')+(data.missing?.length?' Isi: '+data.missing.join(', '):''));
 $('cloudSmsInfo').textContent=data.message;toast('Cloud SMS terhubung. Uji dengan SMS percobaan.');
 }catch(e){$('cloudSmsInfo').textContent=e.message;toast(e.message)}finally{btn.disabled=false;btn.textContent='Hubungkan Cloud SMS'}
};
