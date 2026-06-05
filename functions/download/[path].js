export async function onRequestGet(context) {
  const { request, env, params } = context;
  
  try {
    const { path } = params;
    const key = `files/${path}`;
    
    if (key.includes('..') || !key.startsWith('files/')) {
      return new Response(JSON.stringify({ ok: false, message: '非法路径' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log('下载文件:', key);
    
    const R2_BUCKET = env.FILES_BUCKET;
    if (!R2_BUCKET) {
      return new Response(JSON.stringify({ ok: false, message: '未配置 R2 存储' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const object = await R2_BUCKET.get(key);
    
    if (!object) {
      return new Response(JSON.stringify({ ok: false, message: '文件不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const filename = key.split('/').pop();
    const contentType = object.httpMetadata.contentType || 'application/octet-stream';
    
    return new Response(object.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': object.size,
      },
    });
  } catch (error) {
    console.error('下载文件失败:', error);
    return new Response(JSON.stringify({ ok: false, message: '下载失败', error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}