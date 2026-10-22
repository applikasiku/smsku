import {auth} from './lib/server/auth.mjs';
import {onRequestPost as smailpro} from './functions/api/smailpro.js';
import {onRequest as mail} from './functions/api/mail/[[path]].js';
import {onRequestGet as readSms} from './functions/api/sms.js';
import {onRequestGet as checkSetup,onRequestPost as setupCloud} from './functions/api/smsgate/setup.js';
import {onRequestPost as receiveSms} from './functions/api/smsgate/webhook.js';
import {json} from './lib/server/sms.mjs';
const routes={
 '/api/smailpro':{POST:smailpro},
 '/api/sms':{GET:readSms},
 '/api/smsgate/setup':{GET:checkSetup,POST:setupCloud},
 '/api/smsgate/webhook':{POST:receiveSms}
};
export default {
 async fetch(request,env,ctx){
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/')){
   if(path.startsWith('/api/auth/')){try{return await auth(request,env)}catch{return json({error:'Login sementara tidak tersedia.'},503)}}
   if(!['GET','HEAD','OPTIONS'].includes(request.method)&&path!=='/api/smsgate/webhook'&&request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Permintaan tidak diizinkan.'},403);
   if(path.startsWith('/api/mail/'))return mail({request,env});
   const route=routes[path];if(!route)return json({error:'Endpoint API tidak ditemukan.'},404);
   const handler=route[request.method];if(!handler){const response=json({error:'Metode tidak didukung.'},405);response.headers.set('Allow',Object.keys(route).join(', '));return response}
   try{return await handler({request,env,waitUntil:p=>ctx.waitUntil(p)})}catch{return json({error:'Layanan SMS belum siap. Periksa konfigurasi Worker.'},503)}
  }
  return env.ASSETS.fetch(request);
 }
};
