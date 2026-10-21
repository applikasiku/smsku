import {json,authorize,missing,initialize} from '../../../lib/server/sms.mjs';
const ENDPOINT='https://api.sms-gate.app/3rdparty/v1/webhooks';
// Follow only redirects within the same provider origin. Never forward credentials elsewhere.
async function providerRequest(url,options){
 for(let redirects=0;redirects<=2;redirects++){
  const response=await fetch(url,{...options,redirect:'manual',signal:AbortSignal.timeout(10000)});
  if(![301,302,303,307,308].includes(response.status))return response;
  const location=response.headers.get('Location');if(!location)throw Error('PROVIDER_REDIRECT');
  const target=new URL(location,url);if(target.origin!==new URL(ENDPOINT).origin)throw Error('PROVIDER_REDIRECT');
  if(options.method==='POST'&&![307,308].includes(response.status))throw Error('PROVIDER_REDIRECT');
  url=target.href;
 }
 throw Error('PROVIDER_REDIRECT');
}
export async function onRequestGet({request,env}){const denied=await authorize(request,env);if(denied)return denied;const absent=missing(env);return json({configured:!absent.length,missing:absent})}
export async function onRequestPost({request,env}){
 const denied=await authorize(request,env);if(denied)return denied;
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Origin ditolak.'},403);
 const absent=missing(env);if(absent.length)return json({error:'Konfigurasi belum lengkap.',missing:absent},503);
 let stage='url';
 try{
 const site=new URL(env.SMSKU_PUBLIC_URL||'https://sms.purbalink.web.id');if(site.protocol!=='https:'||site.username||site.password)throw Error('INVALID_URL');
 const url=new URL('/api/smsgate/webhook',site).href;
 stage='database';await initialize(env.SMS_DB);
 stage='credentials';const bytes=new TextEncoder().encode(env.SMSGATE_CLOUD_USER+':'+env.SMSGATE_CLOUD_PASSWORD);const headers={Authorization:'Basic '+btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')),'Content-Type':'application/json'};
 stage='list';const list=await providerRequest(ENDPOINT,{headers});
 if(!list.ok)return json({stage,error:[401,403].includes(list.status)?'Akun Cloud SMSGate ditolak. Periksa username dan password bagian Cloud Server ('+list.status+').':'Cloud SMSGate gagal merespons daftar webhook ('+list.status+').'},502);
 stage='list_format';const data=await list.json();const existing=data===null?[]:data;
 if(!Array.isArray(existing))return json({stage,error:'Respons daftar webhook Cloud SMSGate tidak sesuai format.'},502);
 if(existing.some(w=>w.url===url&&w.event==='sms:received'&&(w.device_id===env.SMSGATE_DEVICE_ID||w.deviceId===env.SMSGATE_DEVICE_ID)))return json({registered:true,existing:true,message:'Webhook sudah terdaftar. Kirim SMS percobaan ke SIM Anda.'});
 stage='register';const registered=await providerRequest(ENDPOINT,{method:'POST',headers,body:JSON.stringify({url,event:'sms:received',device_id:env.SMSGATE_DEVICE_ID})});
 if(!registered.ok)return json({stage,error:[400,404,422].includes(registered.status)?'Registrasi ditolak. Periksa Device ID bagian Cloud Server dan URL website ('+registered.status+').':'Registrasi Cloud SMSGate gagal ('+registered.status+').'},502);
 return json({registered:true,message:'Webhook terdaftar. Tunggu sinkronisasi HP, lalu kirim SMS percobaan ke SIM Anda.'});
 }catch(error){
 const timeout=['TimeoutError','AbortError'].includes(error.name);
 const messages={url:'SMSKU_PUBLIC_URL tidak valid. Isi https://sms.purbalink.web.id tanpa tanda kutip.',database:'Database D1 tidak dapat disiapkan. Periksa binding SMS_DB.',credentials:'Format kredensial Cloud Server tidak valid.',list:timeout?'Cloud SMSGate terlalu lama merespons saat memeriksa akun. Coba lagi.':'Tidak dapat menghubungi Cloud SMSGate untuk memeriksa akun.',list_format:'Respons Cloud SMSGate tidak dapat dibaca sebagai JSON.',register:timeout?'Pendaftaran webhook melewati batas waktu. Coba lagi; periksa Registered webhooks di aplikasi untuk memastikan hasil sebelumnya.':'Tidak dapat menghubungi Cloud SMSGate untuk mendaftarkan webhook.'};
 return json({stage,error:messages[stage]||'Konfigurasi Cloud SMSGate belum siap.'},502);
 }
}
