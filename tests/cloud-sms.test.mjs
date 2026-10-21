// Run: node tests/cloud-sms.test.mjs (Node 24+; uses built-in SQLite).
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
import {initialize} from '../lib/server/sms.mjs';
const lib=new URL('../lib/server/sms.mjs',import.meta.url).href;
async function load(path){const source=(await readFile(new URL(path,import.meta.url),'utf8')).replace("'../../../lib/server/sms.mjs'",JSON.stringify(lib));return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))}
const webhook=await load('../functions/api/smsgate/webhook.js'),setup=await load('../functions/api/smsgate/setup.js'),inbox=await load('../functions/api/sms.js');
const sqlite=new DatabaseSync(':memory:');
const db={prepare(sql){let args=[];return {bind(...v){args=v;return this},run(){return sqlite.prepare(sql).run(...args)},all(){return {results:sqlite.prepare(sql).all(...args)}}}},batch:async statements=>statements.map(s=>s.run())};
const env={SMS_DB:db,SMSKU_ACCESS_TOKEN:'private-code',SMSGATE_SIGNING_KEY:'unit-test-signing-secret',SMSGATE_DEVICE_ID:'device-1',SMSGATE_CLOUD_USER:'cloud-user',SMSGATE_CLOUD_PASSWORD:'cloud-pass',SMSGATE_NUMBER:'+628120000000'};
await initialize(db);
const event={deviceId:'device-1',event:'sms:received',id:'event-1',payload:{message:'Kode 123456',sender:'tester',recipient:null,receivedAt:new Date().toISOString()}};
function signed(value=event,seconds=Math.floor(Date.now()/1000),signature){const raw=JSON.stringify(value);return new Request('https://sms.purbalink.web.id/api/smsgate/webhook',{method:'POST',headers:{'X-Timestamp':String(seconds),'X-Signature':signature||createHmac('sha256',env.SMSGATE_SIGNING_KEY).update(raw+seconds).digest('hex')},body:raw})}
assert.equal((await webhook.onRequestPost({request:signed(),env})).status,200);
assert.equal((await webhook.onRequestPost({request:signed(),env})).status,200);
assert.equal(sqlite.prepare('SELECT count(*) AS n FROM sms_inbox').get().n,1);
assert.equal((await webhook.onRequestPost({request:signed(event,Math.floor(Date.now()/1000)-600),env})).status,401);
assert.equal((await webhook.onRequestPost({request:signed(event,Math.floor(Date.now()/1000),'0'.repeat(64)),env})).status,401);
assert.equal((await webhook.onRequestPost({request:signed({...event,deviceId:'other'}),env})).status,403);
assert.equal((await webhook.onRequestPost({request:signed({...event,payload:{message:5}}),env})).status,400);
const privateRequest=()=>new Request('https://sms.purbalink.web.id/api/sms',{headers:{Authorization:'Bearer private-code'}});
const r=await inbox.onRequestGet({request:privateRequest(),env}),data=await r.json();assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(data.provider,'SIM sendiri / SMSGate Cloud');assert.equal(data.messages[0].body,'Kode 123456');
assert.equal((await inbox.onRequestGet({request:new Request('https://sms.purbalink.web.id/api/sms'),env})).status,401);
let registrations=0;
globalThis.fetch=async(url,options)=>{if(options.method==='POST'){registrations++;const body=JSON.parse(options.body);assert.equal(body.device_id,'device-1');assert.equal(body.url,'https://sms.purbalink.web.id/api/smsgate/webhook');return Response.json({id:'registered'})}return Response.json([])};
assert.equal((await setup.onRequestPost({request:privateRequest(),env})).status,200);assert.equal(registrations,1);
globalThis.fetch=async()=>Response.json([{event:'sms:received',device_id:'device-1',url:'https://sms.purbalink.web.id/api/smsgate/webhook'}]);assert.equal((await (await setup.onRequestPost({request:privateRequest(),env})).json()).existing,true);
assert.equal((await setup.onRequestPost({request:privateRequest(),env:{SMSKU_ACCESS_TOKEN:'private-code'}})).status,503);
console.log('PASS: signed SMS, retry deduplication, timestamp, wrong signature/device, invalid data, private inbox, webhook registration and repeat setup.');
