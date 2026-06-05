import { getFileCategory, sanitizeFilename } from '../utils';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    console.log('收到上传请求');
    
    const R2_BUCKET = env.FILES_BUCKET;
    if (!R2_BUCKET) {
      return new Response(JSON.stringify({ ok: false, message: '未配置 R2 存储' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({ ok: false, message: '请使用 multipart/form-data 格式上传文件' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return new Response(JSON.stringify({ ok: false, message: '请上传文件' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const filename = formData.get('filename') || file.name;
    const safeFilename = sanitizeFilename(filename);
    const fileSize = file.size;
    
    if (fileSize > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ 
        ok: false, 
        message: `文件大小超过限制（最大 ${MAX_FILE_SIZE / 1024 / 1024}MB）` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const ext = safeFilename.split('.').pop()?.toLowerCase() || '';
    const fileCategory = getFileCategory(ext);
    const folder = fileCategory.folder;
    const fileType = fileCategory.type;
    
    const key = `${folder}/${safeFilename}`;
    
    console.log(`上传文件: ${safeFilename}, 类型: ${fileType}, 大小: ${(fileSize / 1024 / 1024).toFixed(2)}MB, 分类: ${folder}`);
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    await R2_BUCKET.put(key, buffer, {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
    });
    
    return new Response(JSON.stringify({
      ok: true,
      message: '上传成功',
      file: safeFilename,
      size: fileSize,
      category: folder,
      fileType: fileType,
      fileIcon: fileCategory.icon,
      downloadUrl: `/download/${key}`,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('上传失败:', error);
    return new Response(JSON.stringify({ ok: false, message: '服务器异常', error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}