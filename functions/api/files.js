import { getFileCategory } from '../utils';

export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    const searchParams = new URL(request.url).searchParams;
    const category = searchParams.get('category') || 'all';
    
    console.log('获取文件列表请求，分类:', category);
    
    const R2_BUCKET = env.FILES_BUCKET;
    if (!R2_BUCKET) {
      return new Response(JSON.stringify({ ok: false, message: '未配置 R2 存储' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const allFiles = [];
    let cursor = null;
    
    do {
      const list = await R2_BUCKET.list({ prefix: 'files/', after: cursor });
      
      for (const obj of list.objects) {
        const key = obj.key;
        if (key.endsWith('/')) continue;
        
        const parts = key.split('/');
        const filename = parts[parts.length - 1];
        const folder = parts.slice(0, -1).join('/');
        
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const fileCategory = getFileCategory(ext);
        
        if (category === 'all' || folder === `files/${category}` || fileCategory.type === category) {
          allFiles.push({
            name: filename,
            filename: filename,
            path: key,
            category: folder,
            fileType: fileCategory.type,
            icon: fileCategory.icon,
            size: obj.size,
            lastModified: obj.uploaded?.toISOString() || '',
            downloadUrl: `/download/${key}`,
          });
        }
      }
      
      cursor = list.cursor;
    } while (cursor);
    
    return new Response(JSON.stringify({ ok: true, files: allFiles }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('获取文件列表失败:', error);
    return new Response(JSON.stringify({ ok: false, message: '获取文件列表失败', error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}