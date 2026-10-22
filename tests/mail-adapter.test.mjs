import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const lib=new URL('../lib/server/sms.mjs',import.meta.url).href;const source=(await readFile(new URL('../functions/api/mail/[[path]].js',import.meta.url),'utf8')).replace("'../../../lib/server/sms.mjs'",JSON.stringify(lib));
const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const env={SMSKU_ACCESS_TOKEN:'owner'};let received;
globalThis.fetch=async(url,opts)=>{assert.equal(opts.redirect,'manual');received={url:String(url),opts};return Response.json({'hydra:member':[]})};
const req=(path,method='GET',headers={})=>new Request('https://sms.example.com/api/mail'+path,{method,headers:{Authorization:'Bearer owner',...headers}});
assert.equal((await onRequest({request:new Request('https://sms.example.com/api/mail/domains'),env})).status,401);
assert.equal((await onRequest({request:req('/https://evil.example'),env})).status,405);
let response=await onRequest({request:req('/domains'),env});assert.equal(response.status,200);assert.equal(received.url,'https://api.mail.gw/domains?page=1');assert.equal(received.opts.headers.Authorization,undefined);
assert.equal((await onRequest({request:req('/messages'),env})).status,401);
response=await onRequest({request:req('/messages','GET',{'X-Mail-Token':'mailtoken'}),env});assert.equal(response.status,200);assert.equal(received.opts.headers.Authorization,'Bearer mailtoken');assert(!JSON.stringify(received).includes('Bearer owner'));assert.equal(response.headers.get('cache-control'),'no-store');
console.log('PASS: owner authorization, fixed upstream, operation allowlist, token separation and no-store');

globalThis.fetch=async()=>new Response(null,{status:302,headers:{Location:'https://evil.example'}});assert.equal((await onRequest({request:req('/domains'),env})).status,502);
