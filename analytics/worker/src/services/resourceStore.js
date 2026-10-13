import { normalizeText } from '../utils.js';

// 资源点击埋点的统计键，必须与客户端上报 resource_click 时使用的键保持一致。
export function createResourceAnalyticsKey(id) {
  const text = normalizeText(id, 120);
  if (!text) {
    return '';
  }

  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `r_${hash.toString(36)}`;
}

// 资源下载功能已移除；仅保留点击统计 rollup 所需的最小读取（id 与统计键）。
export async function listAdminResources(env) {
  const db = requireResourceDb(env);
  const result = await db.prepare(
    `SELECT id, sort_order, updated_at
     FROM resources
     ORDER BY sort_order ASC, updated_at DESC
     LIMIT 500`,
  ).all();

  return (result.results || [])
    .map((row) => {
      const id = normalizeText(row.id, 120);
      return { id, analyticsKey: createResourceAnalyticsKey(id) };
    })
    .filter((item) => Boolean(item.id));
}

function requireResourceDb(env) {
  if (!env.RESOURCE_DB) {
    throw new Error('RESOURCE_DB is not configured');
  }
  return env.RESOURCE_DB;
}
