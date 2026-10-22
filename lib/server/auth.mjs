const enc=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
export async function hash(s){return hex(await crypto.subtle.digest('SHA-256',enc.encode(s)))}
async function sign(s,env){const k=await crypto.subtle.importKey('raw',enc.encode(env.SMSKU_ACCESS_TOKEN),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,enc.encode(s)))}
export async function session(request,env){
 if(!env.SMSKU_ACCESS_TOKEN)return false;
 const token=request.headers.get('Cookie')?.match(/(?:^|;\s*)smsku_session=([^;]+)/)?.[1];if(!token)return false;
 const [exp,nonce,sig]=token.split('.');if(!/^\d+$/.test(exp)||Number(exp)<Date.now()||!nonce||!sig)return false;
 return sig===await sign(exp+'.'+nonce,env);
}
export async function auth(request,env){
 const reply=(data,status=200,cookie)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
 const path=new URL(request.url).pathname;
 if(request.method==='GET')return reply({authenticated:await session(request,env)});
 if(request.method!=='POST')return reply({error:'Metode tidak didukung.'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return reply({error:'Permintaan tidak diizinkan.'},403);
 if(path==='/api/auth/logout')return reply({ok:true},200,'smsku_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
 if(!env.SMSKU_PIN||!env.SMSKU_ACCESS_TOKEN||!env.SMS_DB)return reply({error:'Login belum dikonfigurasi.'},503);
 if(!request.headers.get('Content-Type')?.includes('application/json'))return reply({error:'Format tidak valid.'},415);
 const raw=await request.text();if(raw.length>100)return reply({error:'Data terlalu panjang.'},413);
 let pin;try{pin=JSON.parse(raw).pin}catch{return reply({error:'PIN tidak valid.'},400)}
 const db=env.SMS_DB,now=Date.now(),ip=await hash(request.headers.get('CF-Connecting-IP')||'local');
 await db.prepare('CREATE TABLE IF NOT EXISTS pin_attempts (id TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window INTEGER NOT NULL)').run();
 await db.prepare('INSERT INTO pin_attempts(id,attempts,window) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN window<? THEN 1 ELSE attempts+1 END, window=CASE WHEN window<? THEN excluded.window ELSE window END').bind(ip,now,now-900000,now-900000).run();
 const row=await db.prepare('SELECT attempts FROM pin_attempts WHERE id=?').bind(ip).first();
 if(row.attempts>8)return reply({error:'Terlalu banyak percobaan. Coba lagi dalam 15 menit.'},429);
 if(typeof pin!=='string'||await hash(pin)!==await hash(env.SMSKU_PIN))return reply({error:'PIN salah.'},401);
 await db.prepare('DELETE FROM pin_attempts WHERE id=? OR window<?').bind(ip,now-900000).run();
 const value=(now+43200000)+'.'+crypto.randomUUID();return reply({authenticated:true},200,`smsku_session=${value}.${await sign(value,env)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`);
}
