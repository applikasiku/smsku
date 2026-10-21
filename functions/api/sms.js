// Cloudflare Pages Function. Provider credentials remain server-side.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function equal(a,b){const hash=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [x,y]=await Promise.all([hash(a),hash(b)]);let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0;}
async function upstream(url,authorization){const r=await fetch(url,{headers:{Authorization:authorization},signal:AbortSignal.timeout(15000),redirect:'error'});if(!r.ok)throw Error('Provider tidak dapat diakses ('+r.status+')');return r.json();}
export async function onRequestGet({request,env}){
 if(!env.SMSKU_ACCESS_TOKEN)return json({error:'Backend belum dikonfigurasi. Isi SMSKU_ACCESS_TOKEN di Cloudflare.'},503);
 const token=request.headers.get('Authorization')||'';if(!await equal(token,'Bearer '+env.SMSKU_ACCESS_TOKEN))return json({error:'Kode akses salah atau belum diisi.'},401);
 const params=new URL(request.url).searchParams,paid=params.get('paid')==='yes';
 const freeReady=!!(env.SMSGATE_URL&&env.SMSGATE_USER&&env.SMSGATE_PASSWORD&&env.SMSGATE_NUMBER);
 const paidReady=!!(env.TWILIO_ACCOUNT_SID&&env.TWILIO_AUTH_TOKEN&&env.TWILIO_NUMBER);
 try{
  // Always try the owned SIM first. An empty inbox is a success, not a fallback trigger.
  if(freeReady){try{
   const base=new URL(env.SMSGATE_URL);if(base.protocol!=='https:')throw Error('Gateway memerlukan HTTPS');
   const url=new URL(base.toString().replace(/\/$/,'')+'/inbox');url.search='type=SMS&limit=50';
   const data=await upstream(url,'Basic '+btoa(env.SMSGATE_USER+':'+env.SMSGATE_PASSWORD));if(!Array.isArray(data))throw Error('Respons gateway tidak valid');
   return json({provider:'SIM sendiri / SMSGate',tier:'free',number:env.SMSGATE_NUMBER,previewOnly:true,messages:data.filter(m=>m.type==='SMS').map(m=>({id:String(m.id),from:m.sender,body:m.contentPreview||'',date:m.createdAt}))});
  }catch(error){if(!paid)return json({error:'Gateway gratis belum dapat dihubungi. Periksa perangkat dan tunnel.',paidAvailable:paidReady},502)}}
  if(!paid)return json({error:'Jalur gratis memerlukan HP Android dengan SIM aktif dan gateway HTTPS. Jalur berbayar hanya dipakai setelah diizinkan.',paidAvailable:paidReady},503);
  if(!paidReady)return json({error:'Cadangan berbayar belum dikonfigurasi.'},503);
  if(!/^AC[a-f0-9]{32}$/i.test(env.TWILIO_ACCOUNT_SID))return json({error:'Konfigurasi akun Twilio tidak valid.'},503);
  const url=new URL(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`);url.searchParams.set('To',env.TWILIO_NUMBER);url.searchParams.set('PageSize','50');
  const data=await upstream(url,'Basic '+btoa(env.TWILIO_ACCOUNT_SID+':'+env.TWILIO_AUTH_TOKEN));
  return json({provider:'Twilio',tier:'paid',number:env.TWILIO_NUMBER,messages:(data.messages||[]).filter(m=>m.direction==='inbound').map(m=>({id:m.sid,from:m.from,body:m.body||'',date:m.date_created}))});
 }catch{return json({error:'Provider tidak dapat diakses. Periksa konfigurasi server.'},502)}
}
