import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.112.4';

const PUBLIC_SPKI_B64='MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/suDKmZG7B52xCVkCooS5MZfvVu+GjYTIfeOvlfi9tz29TQNN4uea318Nn2xf5uf/cm0bpaCADPwkqWSZV2MIA==';
const LEGACY_VERSION='2.4.21';
const SUPPORTED_PROTOCOLS=new Set(['ld-runtime-bus/1']);
const TRUST_TTL_SECONDS=600;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,x-license-key,x-device-id,authorization','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const enc=new TextEncoder();
function b64url(bytes:Uint8Array){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}
function unb64url(v:string){const s=v.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(v.length/4)*4,'=');return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
async function sha(v:string){const d=await crypto.subtle.digest('SHA-256',enc.encode(v));return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function publicKey(){const der=Uint8Array.from(atob(PUBLIC_SPKI_B64),c=>c.charCodeAt(0));return crypto.subtle.importKey('spki',der,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);}
async function verifyLicense(token:string){const [p,pp,sp]=token.trim().split('.');if(p!=='LD2'||!pp||!sp)throw new Error('KEY_INVALID_FORMAT');if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},await publicKey(),unb64url(sp),enc.encode(pp)))throw new Error('KEY_INVALID_SIGNATURE');const payload=JSON.parse(new TextDecoder().decode(unb64url(pp)));const now=Math.floor(Date.now()/1000);if(payload?.aud!=='lovable-decrypter'||Number(payload?.v)!==1||!payload?.license_id)throw new Error('KEY_INVALID_PAYLOAD');if(payload.nbf&&now<Number(payload.nbf))throw new Error('KEY_NOT_ACTIVE');if(payload.exp&&now>=Number(payload.exp))throw new Error('KEY_EXPIRED');return payload;}
async function getSecret(sb:any,name:string){const env=Deno.env.get(name)||'';if(env)return env;const {data,error}=await sb.rpc('ld_backend_secret',{p_name:name});if(error)throw new Error('SECRET_LOOKUP_FAILED');return String(data||'');}
async function signTrust(sb:any,payload:any){const raw=await getSecret(sb,'LD_LICENSE_PRIVATE_JWK');if(!raw)throw new Error('SIGNING_SECRET_NOT_CONFIGURED');const key=await crypto.subtle.importKey('jwk',JSON.parse(raw),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);const pp=b64url(enc.encode(JSON.stringify(payload)));const sig=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(pp)));return `LDT1.${pp}.${b64url(sig)}`;}
function entitlement(license:any){const timeActive=Boolean(license.expires_at&&Date.parse(license.expires_at)>Date.now());const credits=Number(license.credit_balance||0);const debt=Number(license.credit_debt||0);return timeActive||(credits>0&&debt===0);}
function compatibility(version:string,protocol:string){
  if(!protocol){if(version!==LEGACY_VERSION)throw new Error('TRUST_CLIENT_PROTOCOL_REQUIRED');return {protocol:'legacy-version-pin/1',legacy:true};}
  if(!SUPPORTED_PROTOCOLS.has(protocol))throw new Error('TRUST_CLIENT_PROTOCOL_UNSUPPORTED');
  if(!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version))throw new Error('TRUST_CLIENT_VERSION_INVALID');
  return {protocol,legacy:false};
}
function capabilities(body:any){return Array.isArray(body?.capabilities)?[...new Set(body.capabilities.map((item:any)=>String(item||'').trim()).filter((item:string)=>/^[a-z0-9._-]{2,80}$/i.test(item)))].slice(0,64):[];}
async function event(sb:any,row:any){try{await sb.from('ld_trust_events').insert(row);}catch(_){}}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
  let sb:any=null;let licenseId:string|null=null;let deviceHash:string|null=null;let version='';let fingerprint='';let clientProtocol='';
  try{
    const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!service)return json({ok:false,code:'BACKEND_NOT_CONFIGURED'},503);
    sb=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const body=await req.json().catch(()=>({}));
    const bearer=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
    const token=String(req.headers.get('x-license-key')||body.license_key||bearer||'').trim();
    const deviceId=String(req.headers.get('x-device-id')||body.device_id||'').trim();
    version=String(body.client_version||'').trim();
    clientProtocol=String(body.client_protocol||'').trim();
    fingerprint=String(body.client_fingerprint||'').trim().toLowerCase();
    const nonce=String(body.nonce||'').trim();
    if(!token)throw new Error('KEY_REQUIRED');
    if(!deviceId)throw new Error('DEVICE_REQUIRED');
    const compat=compatibility(version,clientProtocol);
    if(!/^[a-f0-9]{64}$/.test(fingerprint))throw new Error('TRUST_FINGERPRINT_INVALID');
    if(!/^[A-Za-z0-9_-]{24,256}$/.test(nonce))throw new Error('TRUST_NONCE_INVALID');
    const caps=capabilities(body);
    const signed=await verifyLicense(token);licenseId=String(signed.license_id);deviceHash=await sha(deviceId);
    const {data:license,error:le}=await sb.from('ld_license_keys').select('id,status,expires_at,credit_balance,credit_debt').eq('id',licenseId).eq('key_hash',await sha(token)).maybeSingle();
    if(le)throw new Error('DB_ERROR');if(!license)throw new Error('KEY_NOT_REGISTERED');if(license.status!=='active')throw new Error('KEY_'+String(license.status).toUpperCase());if(!entitlement(license))throw new Error('ENTITLEMENT_EXHAUSTED');
    const {data:device,error:de}=await sb.from('ld_license_devices').select('id,revoked_at').eq('license_id',license.id).eq('device_hash',deviceHash).maybeSingle();
    if(de)throw new Error('DB_ERROR');if(!device)throw new Error('DEVICE_NOT_BOUND');if(device.revoked_at)throw new Error('DEVICE_REVOKED');
    const nonceHash=await sha(nonce);const now=new Date();const expires=new Date(now.getTime()+TRUST_TTL_SECONDS*1000);
    const sessionId=crypto.randomUUID();
    const integrityKind=String(body?.integrity?.kind||'client-package-sha256').slice(0,80);
    const metadata={integrity_signal:integrityKind,critical_assets:Number(body?.integrity?.critical_assets||0),client_protocol:compat.protocol,legacy_version_pin:compat.legacy,capabilities:caps};
    const {error:se}=await sb.from('ld_trust_sessions').insert({id:sessionId,license_id:license.id,device_hash:deviceHash,client_version:version,client_fingerprint:fingerprint,nonce_hash:nonceHash,issued_at:now.toISOString(),expires_at:expires.toISOString(),last_seen_at:now.toISOString(),metadata});
    if(se){if(String(se.code||'')==='23505')throw new Error('TRUST_NONCE_REPLAY');throw new Error('TRUST_SESSION_CREATE_FAILED');}
    const iat=Math.floor(now.getTime()/1000),exp=Math.floor(expires.getTime()/1000);
    const trustPayload={v:1,aud:'lovable-decrypter-trust',sid:sessionId,license_id:license.id,device_hash:deviceHash,client_version:version,client_protocol:compat.protocol,client_fingerprint:fingerprint,iat,exp};
    const trustToken=await signTrust(sb,trustPayload);
    await event(sb,{license_id:license.id,session_id:sessionId,device_hash:deviceHash,event_type:'attestation',outcome:'issued',client_version:version,client_fingerprint:fingerprint,metadata:{ttl_seconds:TRUST_TTL_SECONDS,client_protocol:compat.protocol,legacy_version_pin:compat.legacy,capability_count:caps.length}});
    return json({ok:true,schema:compat.legacy?'ld-trust-attestation/1':'ld-trust-attestation/2',client_protocol:compat.protocol,trust_token:trustToken,expires_at:expires.toISOString(),policy:{server_authoritative:true,ttl_seconds:TRUST_TTL_SECONDS,compatibility:'protocol',client_integrity_signal:'risk-signal-not-proof'}});
  }catch(e){const code=String((e as Error)?.message||'INTERNAL_ERROR');if(sb)await event(sb,{license_id:licenseId,device_hash:deviceHash,event_type:'attestation',outcome:'denied',client_version:version||null,client_fingerprint:fingerprint||null,metadata:{code,client_protocol:clientProtocol||null}});const denied=/^(KEY_|DEVICE_|ENTITLEMENT_|TRUST_)/.test(code);console.error('ld-trust-attest',code);return json({ok:false,code},denied?403:500);}
});
