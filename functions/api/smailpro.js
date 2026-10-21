import {authorize,json} from '../../lib/server/sms.mjs';
export async function onRequestPost({request,env}){
 const denied=await authorize(request,env);if(denied)return denied;
 if(!env.SMAILPRO_API_KEY)return json({error:'Smailpro belum aktif. Tambahkan Secret SMAILPRO_API_KEY di Cloudflare.'},503);
 const raw=await request.text();if(raw.length>4096)return json({error:'Permintaan terlalu besar.'},413);
 let input;try{input=JSON.parse(raw)}catch{return json({error:'Data tidak valid.'},400)}
 if(input.consent!==true)return json({error:'Smailpro memakai kredit. Persetujuan penggunaan diperlukan.'},400);
 const groups={temporary:'temp_email',gmail:'temp_gmail',outlook:'temp_outlook'},group=groups[input.kind];
 if(!group||!['create','inbox','message'].includes(input.action))return json({error:'Operasi Smailpro tidak valid.'},400);
 const action=input.action==='create'?(input.kind==='temporary'?'create':'random'):input.action;
 const url=new URL('https://app.sonjj.com/v1/'+group+'/'+action);
 if(input.action==='create'){
  if(input.kind==='temporary'){url.searchParams.set('email','random@random.com');url.searchParams.set('expiry_minutes','10')}
  else url.searchParams.set('type','alias');
 }else{
  if(typeof input.email!=='string'||input.email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))return json({error:'Alamat email tidak valid.'},400);
  url.searchParams.set('email',input.email);
  if(input.action==='inbox'&&input.kind!=='temporary'){
   if(!Number.isSafeInteger(input.timestamp)||input.timestamp<0)return json({error:'Waktu sesi tidak valid.'},400);
   url.searchParams.set('timestamp',String(input.timestamp));
  }
  if(input.action==='message'){
   if(typeof input.mid!=='string'||!input.mid||input.mid.length>512)return json({error:'ID pesan tidak valid.'},400);
   url.searchParams.set('mid',input.mid);
  }
 }
 try{
  // Paid calls are never retried automatically.
  const r=await fetch(url,{headers:{'X-Api-Key':env.SMAILPRO_API_KEY,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!r.ok)return json({error:r.status===401?'API key Smailpro ditolak.':r.status===403?'Akses Smailpro ditolak. Periksa saldo kredit dan izin API.':r.status===429?'Batas permintaan Smailpro tercapai.':'Smailpro gagal merespons ('+r.status+').'},502);
  const data=await r.json();
  if(input.action==='create'){
   if(typeof data.email!=='string'||!data.email.includes('@'))return json({error:'Smailpro tidak mengembalikan alamat yang valid.'},502);
   return json({email:data.email,timestamp:data.timestamp??Math.floor(Date.now()/1000),expired_at:data.expired_at??null});
  }
  if(input.action==='inbox'){
   if(!Array.isArray(data.messages))return json({error:'Format inbox Smailpro tidak valid.'},502);
   return json({'hydra:member':data.messages.map(m=>({id:m.mid,subject:m.textSubject||'',from:{address:m.textFrom||''},createdAt:m.textDate,intro:''}))});
  }
  return json({id:input.mid,subject:'',from:{address:'Smailpro'},text:typeof data.body==='string'?data.body:''});
 }catch{return json({error:'Tidak dapat membaca respons Smailpro. Permintaan tidak diulang untuk menghindari kredit ganda; periksa dashboard sebelum mencoba lagi.'},502)}
}
