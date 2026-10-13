import { corsHeaders, json, methodNotAllowed, requireAdmin, unauthorized } from '../http.js';
import {
  deleteAgentErrors,
  getAgentErrorDownload,
  listAgentErrors,
  readAgentErrorConfig,
  saveAgentErrorConfig,
} from '../services/agentErrorStore.js';
import { isValidProjectName, normalizeText } from '../utils.js';

// Agent 失败诊断上报已永久关闭：不再接收任何诊断包，旧版本客户端的 preflight 与直发一律拒收，
// 且不读取请求正文。管理端的列表、下载与删除历史数据能力保留，便于清理已收到的存量报告。
export async function handleAgentErrorIngest(request) {
  if (request.method !== 'GET' && request.method !== 'POST') return methodNotAllowed();
  return json({ code: 0, accepted: false, reason: 'disabled' }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function handleAdminAgentErrorConfig(request, env, url) {
  if (!requireAdmin(request, env)) return unauthorized();
  if (request.method === 'GET') {
    const projectName = normalizeText(url.searchParams.get('projectName'), 80);
    if (!isValidProjectName(projectName)) return json({ code: 400, message: 'invalid projectName' }, { status: 400 });
    return json({ code: 0, config: await readAgentErrorConfig(env, projectName) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ code: 400, message: 'invalid json body' }, { status: 400 }); }
    try {
      return json({ code: 0, config: await saveAgentErrorConfig(env, body) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return json({ code: 400, message: error?.message || 'save failed' }, { status: 400 });
    }
  }
  return methodNotAllowed();
}

export async function handleAdminAgentErrors(request, env, url) {
  if (!requireAdmin(request, env)) return unauthorized();
  const projectName = normalizeText(url.searchParams.get('projectName'), 80);
  if (!isValidProjectName(projectName)) return json({ code: 400, message: 'invalid projectName' }, { status: 400 });
  if (request.method === 'GET') {
    return json({
      code: 0,
      ...(await listAgentErrors(env, projectName, url.searchParams.get('page'), url.searchParams.get('pageSize'))),
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (request.method === 'DELETE') {
    let body;
    try { body = await request.json(); } catch { body = {}; }
    return json({ code: 0, ...(await deleteAgentErrors(env, projectName, body.ids || [])) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return methodNotAllowed();
}

export async function handleAdminAgentErrorDownload(request, env, url) {
  if (!requireAdmin(request, env)) return unauthorized();
  if (request.method !== 'GET') return methodNotAllowed();
  const projectName = normalizeText(url.searchParams.get('projectName'), 80);
  const reportId = normalizeText(url.searchParams.get('id'), 80);
  if (!isValidProjectName(projectName) || !reportId) return json({ code: 400, message: 'invalid params' }, { status: 400 });
  const download = await getAgentErrorDownload(env, projectName, reportId);
  if (!download) return json({ code: 404, message: 'log not found' }, { status: 404 });
  return new Response(download.object.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="agent-error-${download.row.id}.json.gz"`,
      'Cache-Control': 'no-store',
    },
  });
}
