import {authorize,json} from '../../../lib/server/sms.mjs';
// Fixed Mail.gw adapter for the owner's private inbox. Never proxies Mail.tm or arbitrary URLs.
export async function onRequest({request,env}){
 const denied=await authorize(request,env);if(denied)return denied;
 const path=new URL(request.url).pathname.slice('/api/mail'.length),method=request.method;
 const allowed=(method==='GET'&&(/^\/domains$/.test(path)||/^\/messages(?:\/[a-zA-Z0-9_-]+)?$/.test(path)))||(method==='POST'&&['/accounts','/token'].includes(path))||(method==='DELETE'&&/^\/messages\/[a-zA-Z0-9_-]+$/.test(path));
 if(!allowed)return json({error:'Operasi email tidak didukung.'},405);
 const target=new URL('https://api.mail.gw'+path),headers={Accept:'application/ld+json'};
 if(method==='GET'){const page=new URL(request.url).searchParams.get('page')||'1';if(!/^\d{1,4}$/.test(page))return json({error:'Halaman tidak valid.'},400);target.searchParams.set('page',page)}
 if(path.startsWith('/messages')){const token=request.headers.get('X-Mail-Token');if(!token||token.length>4096)return json({error:'Sesi inbox belum tersedia.'},401);headers.Authorization='Bearer '+token}
 let body;
 if(method==='POST'){
  const raw=await request.text();if(raw.length>2048)return json({error:'Data terlalu panjang.'},413);
  let value;try{value=JSON.parse(raw)}catch{return json({error:'Data email tidak valid.'},400)}
  if(typeof value.address!=='string'||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.address)||value.address.length>254||typeof value.password!=='string'||value.password.length<8||value.password.length>256)return json({error:'Format akun email tidak valid.'},400);
  body=JSON.stringify({address:value.address,password:value.password});headers['Content-Type']='application/json';
 }
 try{
 const response=await fetch(target,{method,headers,body,redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(!response.ok)return json({error:response.status===429?'Mail.gw membatasi permintaan. Tunggu sebentar.':'Penyedia Mail.gw gagal merespons ('+response.status+').',upstream_status:response.status},response.status===429?429:502);
 if(response.status===204)return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
 const data=await response.json();return json(data,response.status);
 }catch{return json({error:'Worker belum dapat menghubungi Mail.gw. Coba lagi nanti atau pilih Mail.tm.'},502)}
}
