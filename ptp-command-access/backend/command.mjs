import {createHash} from 'node:crypto';

export const SITE_ID = '11bfcf84-d1f4-4604-bfcf-82c08b20f0d4';
export const ORIGIN = 'https://headless-imjmmxsthlj-pedrousinae-140b.wix-site-host.com';
export const OWNER_ID = '1a825376-fa27-48c6-9e81-3b7bd0ad8bed';
export const OWNER_EMAIL = 'parquetecnologicopiracicaba@gmail.com';
export const COLLECTIONS = Object.freeze(['PTPEnviosEcossistema','PTPPerfisUsuarios','PTPVitrinesPublicas','PTPProjetosComunidade','PTPDesafiosComunidade','PTPOportunidadesComunidade','PTPInteracoesPublicas','PTPRegistrosMembros','PTPOrganizacoes','PTPPerfis','PTPProjetos','PTPDesafios','PTPVagas','PTPMentoresPublicos','PTPMentorias','PTPConexoes','PTPSolicitacoesPublicas','PTPPrivateMessages','PTPNotificationSubscribers','PTPNotificationDeliveries','PTPAuditoria']);
const allowed = new Set(COLLECTIONS);
const failure = (status, code) => Object.assign(new Error(code), {status, code});
const isOwner = member => member?.id === OWNER_ID && String(member.loginEmail || '').trim().toLowerCase() === OWNER_EMAIL && member.loginEmailVerified === true && member.status === 'APPROVED';

// The caller supplies only its Wix member access token. Identity is resolved
// at Wix on EVERY request; neither decoded JWT claims nor client email is trusted.
export function createCommandHandler({fetchImpl = fetch, apiKey = () => process.env.WIX_API_KEY || '', now = Date.now} = {}) {
  const buckets = new Map();
  async function wix(path, token, body) {
    let response;
    try {
      response = await fetchImpl('https://www.wixapis.com' + path, {
        method: body ? 'POST' : 'GET', redirect: 'error',
        headers: {'Content-Type':'application/json', Authorization:token, 'wix-site-id':SITE_ID},
        ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(12000)
      });
    } catch { throw failure(503, 'upstream_unavailable'); }
    if (!response.ok) throw failure(response.status === 401 || response.status === 403 ? response.status : 503, 'upstream_denied');
    try { return await response.json(); } catch { throw failure(502, 'invalid_upstream_response'); }
  }
  async function owner(token) {
    const result = await wix('/members/v1/members/my?fieldsets=FULL', token);
    if (!isOwner(result.member)) throw failure(403, 'owner_required');
    return result.member;
  }
  async function query(collection, limit, offset) {
    const key = apiKey();
    if (!key) throw failure(503, 'service_not_configured');
    let result;
    try {
      result = await wix('/data/v2/items/query', key, {
        dataCollectionId:collection, query:{paging:{limit, offset}}, returnTotalCount:true
      });
    } catch (error) {
      if (error.status === 401 || error.status === 403) throw failure(503, 'service_permission_denied');
      throw error;
    }
    if (!Array.isArray(result.dataItems)) throw failure(502, 'invalid_upstream_response');
    return {dataItems:result.dataItems, pagingMetadata:result.pagingMetadata || {}};
  }
  function send(res, status, value, origin) {
    const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    if (origin === ORIGIN) Object.assign(headers, {'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'});
    res.writeHead(status, headers);
    res.end(status === 204 ? undefined : JSON.stringify(value));
  }
  return async function handleCommand(req, res) {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (!path.startsWith('/api/command/')) return false;
    const origin = req.headers.origin;
    const reply = (status, data) => send(res, status, data, origin);
    try {
      if (origin !== ORIGIN) throw failure(403, 'origin_denied');
      if (!['/api/command/status','/api/command/query'].includes(path)) throw failure(404, 'not_found');
      if (req.method === 'OPTIONS') { reply(204, {}); return true; }
      if (req.method !== 'POST') throw failure(405, 'method_not_allowed');
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw failure(415, 'json_required');
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (!token || token.length > 16384 || /\s/.test(token)) throw failure(401, 'session_required');
      // Store only a digest, never the bearer token. Bound the map under abuse.
      const bucketKey = createHash('sha256').update(token).digest('hex');
      const time = now();
      for (const [key, value] of buckets) if (time - value.start >= 60000) buckets.delete(key);
      if (!buckets.has(bucketKey) && buckets.size >= 1000) throw failure(429, 'rate_limited');
      const bucket = buckets.get(bucketKey) || {start:time, count:0};
      buckets.set(bucketKey, bucket);
      if (++bucket.count > 360) throw failure(429, 'rate_limited');
      let size = 0; const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 2048) throw failure(413, 'payload_too_large');
        chunks.push(chunk);
      }
      let input;
      try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw failure(400, 'invalid_json'); }
      if (!input || Array.isArray(input) || typeof input !== 'object') throw failure(400, 'invalid_request');
      const fields = path.endsWith('/status') ? [] : ['collection','limit','offset'];
      if (Object.keys(input).some(key => !fields.includes(key))) throw failure(400, 'unexpected_field');
      const {collection, limit = 100, offset = 0} = input;
      if (path.endsWith('/query') && (!allowed.has(collection) || !Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset >= 20000)) throw failure(400, 'invalid_query');
      const member = await owner(token);
      if (path.endsWith('/status')) {
        // Success proves actual server credential access, even on an empty CMS.
        await query('PTPRegistrosMembros', 1, 0);
        reply(200, {authorized:true, memberId:member.id, version:'command-1'});
      } else reply(200, await query(collection, limit, offset));
    } catch (error) {
      const known = Number.isInteger(error.status) && typeof error.code === 'string';
      if (!res.writableEnded) reply(known ? error.status : 503, {error:known ? error.code : 'service_unavailable'});
    }
    return true;
  };
}
