import {json,authorize,missing,initialize} from '../../../lib/server/sms.mjs';
const ENDPOINT='https://api.sms-gate.app/3rdparty/v1/webhooks';
export async function onRequestGet({request,env}){const denied=await authorize(request,env);if(denied)return denied;const absent=missing(env);return json({configured:!absent.length,missing:absent})}
export async function onRequestPost({request,env}){
 const denied=await authorize(request,env);if(denied)return denied;
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Origin ditolak.'},403);
 const absent=missing(env);if(absent.length)return json({error:'Konfigurasi belum lengkap.',missing:absent},503);
 try{
 const site=new URL(env.SMSKU_PUBLIC_URL||'https://sms.purbalink.web.id');if(site.protocol!=='https:'||site.username||site.password)throw Error('URL tidak valid');
 const url=new URL('/api/smsgate/webhook',site).href;
 await initialize(env.SMS_DB);
 const headers={Authorization:'Basic '+btoa(env.SMSGATE_CLOUD_USER+':'+env.SMSGATE_CLOUD_PASSWORD),'Content-Type':'application/json'};
 const list=await fetch(ENDPOINT,{headers,redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!list.ok)return json({error:'Tidak dapat memeriksa akun Cloud SMSGate ('+list.status+').'},502);
 const existing=await list.json();if(!Array.isArray(existing))return json({error:'Format daftar webhook tidak valid.'},502);
 if(existing.some(w=>w.url===url&&w.event==='sms:received'&&(w.device_id===env.SMSGATE_DEVICE_ID||w.deviceId===env.SMSGATE_DEVICE_ID)))return json({registered:true,existing:true,message:'Webhook sudah terdaftar. Kirim SMS percobaan ke SIM Anda.'});
 const registered=await fetch(ENDPOINT,{method:'POST',headers,body:JSON.stringify({url,event:'sms:received',device_id:env.SMSGATE_DEVICE_ID}),redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!registered.ok)return json({error:'Registrasi Cloud SMSGate gagal ('+registered.status+').'},502);
 return json({registered:true,message:'Webhook terdaftar. Tunggu sinkronisasi HP, lalu kirim SMS percobaan ke SIM Anda.'});
 }catch{return json({error:'Koneksi Cloud SMSGate atau database gagal. Periksa konfigurasi Cloudflare.'},502)}
}
