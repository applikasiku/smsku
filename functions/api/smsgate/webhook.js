import {json} from '../../../lib/server/sms.mjs';
export async function onRequestPost({request,env}){
 if(!env.SMS_DB||!env.SMSGATE_SIGNING_KEY||!env.SMSGATE_DEVICE_ID)return json({error:'Webhook belum dikonfigurasi.'},503);
 const timestamp=request.headers.get('X-Timestamp')||'',signature=(request.headers.get('X-Signature')||'').trim();
 if(!/^\d{10}$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300||! /^[a-f\d]{64}$/i.test(signature))return json({error:'Tanda tangan atau waktu tidak valid.'},401);
 let raw;try{const reader=request.body?.getReader();if(!reader)return json({error:'Body kosong.'},400);const chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();return json({error:'Payload terlalu besar.'},413)}chunks.push(value)}const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length}raw=new TextDecoder('utf-8',{fatal:true}).decode(all)}catch{return json({error:'Payload tidak valid.'},400)}
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SMSGATE_SIGNING_KEY),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const bytes=Uint8Array.from(signature.match(/../g),x=>parseInt(x,16));
 if(!await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(raw+timestamp)))return json({error:'Tanda tangan tidak valid.'},401);
 let event;try{event=JSON.parse(raw)}catch{return json({error:'JSON tidak valid.'},400)}
 if(event.deviceId!==env.SMSGATE_DEVICE_ID)return json({error:'Perangkat tidak cocok.'},403);
 if(event.event!=='sms:received')return json({ignored:true});
 const p=event.payload;
 if(typeof event.id!=='string'||!event.id||event.id.length>256||!p||typeof p.message!=='string'||p.message.length>20000||typeof p.receivedAt!=='string'||!Number.isFinite(Date.parse(p.receivedAt))||[p.sender,p.recipient].some(v=>v!=null&&(typeof v!=='string'||v.length>128)))return json({error:'Format SMS tidak valid.'},400);
 try{const now=Math.floor(Date.now()/1000);await env.SMS_DB.batch([
 env.SMS_DB.prepare('INSERT OR IGNORE INTO sms_inbox (device_id,event_id,sender,recipient,body,received_at,stored_at) VALUES (?,?,?,?,?,?,?)').bind(event.deviceId,event.id,p.sender??null,p.recipient??null,p.message,p.receivedAt,now),
 env.SMS_DB.prepare('DELETE FROM sms_inbox WHERE stored_at < ?').bind(now-7*86400)
 ]);return json({received:true})}catch{return json({error:'Penyimpanan SMS belum siap. Jalankan Hubungkan Cloud SMS terlebih dahulu.'},503)}
}
