import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowedOrigin = Deno.env.get('SITE_ORIGIN') ?? 'https://nero-evolve.github.io';

function response(body: unknown, status = 200, origin = allowedOrigin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
      'vary': 'Origin',
    },
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') ?? '';
  if (origin && origin !== allowedOrigin) return response({ error: 'origin not allowed' }, 403);
  if (request.method === 'OPTIONS') return response({}, 200, origin || allowedOrigin);
  if (request.method !== 'POST') return response({ error: 'method not allowed' }, 405);

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return response({ error: '請先登入管理者帳號。' }, 401);

  try {
    const token = authorization.slice('Bearer '.length);
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser(token);
    if (authError || !caller) return response({ error: '登入狀態已失效，請重新登入。' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: adminRecord, error: adminError } = await admin
      .from('site_admins').select('user_id').eq('user_id', caller.id).maybeSingle();
    if (adminError) throw adminError;
    if (!adminRecord) return response({ error: '只有網站管理員可以刪除教師帳號。' }, 403);

    const body = await request.json().catch(() => ({}));
    const targetId = String(body.user_id ?? '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) {
      return response({ error: '教師帳號識別碼格式錯誤。' }, 400);
    }
    if (targetId === caller.id) return response({ error: '不能刪除目前登入的管理員帳號。' }, 400);

    const { data: protectedAdmin, error: protectedAdminError } = await admin
      .from('site_admins').select('user_id').eq('user_id', targetId).maybeSingle();
    if (protectedAdminError) throw protectedAdminError;
    if (protectedAdmin) return response({ error: '管理員帳號不能從教師管理清單刪除。' }, 400);

    const { data: profile, error: profileError } = await admin
      .from('profiles').select('id,role').eq('id', targetId).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== 'teacher') return response({ error: '找不到可刪除的教師帳號。' }, 404);

    const countRows = async (table: string, column: string) => {
      const { count, error } = await admin.from(table).select(column, { count: 'exact', head: true }).eq(column, targetId);
      if (error) throw error;
      return count ?? 0;
    };
    const [classes, materials, comments] = await Promise.all([
      countRows('classes', 'teacher_id'),
      countRows('teaching_materials', 'created_by'),
      countRows('teacher_comments', 'teacher_id'),
    ]);
    if (classes || materials || comments) {
      return response({
        error: `此教師仍有 ${classes} 個班級、${materials} 份教材、${comments} 則評語。請先移轉或處理這些資料，再刪除帳號。`,
        counts: { classes, materials, comments },
      }, 409);
    }

    // Clean up orphaned uploads in the teacher's UID folder before removing the auth user.
    for (const bucket of ['learning-materials', 'teacher-materials']) {
      let offset = 0;
      const pageSize = 100;
      while (true) {
        const { data: objects, error } = await admin.storage.from(bucket).list(targetId, { limit: pageSize, offset });
        if (error) throw error;
        const paths = (objects ?? []).filter((item) => item.id).map((item) => `${targetId}/${item.name}`);
        if (paths.length) {
          const { error: removeError } = await admin.storage.from(bucket).remove(paths);
          if (removeError) throw removeError;
        }
        if (!objects || objects.length < pageSize) break;
        offset += pageSize;
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
    if (deleteError) throw deleteError;
    return response({ ok: true });
  } catch (error) {
    console.error('delete-teacher failed', error);
    return response({ error: error instanceof Error ? error.message : '刪除教師帳號失敗。' }, 500);
  }
});
