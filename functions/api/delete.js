export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    console.log('收到删除请求');
    
    const R2_BUCKET = env.FILES_BUCKET;
    if (!R2_BUCKET) {
      return new Response(JSON.stringify({ ok: false, message: '未配置 R2 存储' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, message: '请求体格式错误' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { filename, folder } = body;
    
    if (!filename) {
      return new Response(JSON.stringify({ ok: false, message: '缺少文件名参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const safeFolder = folder || 'files/others';
    const key = `${safeFolder}/${filename}`;
    
    console.log('删除文件:', key);
    
    await R2_BUCKET.delete(key);
    
    return new Response(JSON.stringify({ ok: true, message: '删除成功', file: filename }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('删除失败:', error);
    return new Response(JSON.stringify({ ok: false, message: '删除失败', error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}