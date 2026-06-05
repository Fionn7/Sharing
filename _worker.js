import { getFileCategory, sanitizeFilename } from './functions/utils';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    console.log(`请求: ${method} ${pathname}`);

    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
        }
      });
    }

    const R2_BUCKET = env.FILES_BUCKET;
    if (!R2_BUCKET) {
      return new Response(JSON.stringify({ ok: false, message: '未配置 R2 存储' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (pathname === '/api/files' && method === 'GET') {
      return handleGetFiles(request, R2_BUCKET);
    }

    if (pathname.startsWith('/api/files/') && method === 'DELETE') {
      return handleDeleteFile(request, R2_BUCKET);
    }

    if (pathname === '/api/upload' && method === 'POST') {
      return handleUpload(request, R2_BUCKET);
    }

    if (pathname.startsWith('/download/') && method === 'GET') {
      return handleDownload(request, R2_BUCKET);
    }

    if (pathname === '/' || pathname === '/index.html') {
      const html = await env.ASSETS.fetch('http://localhost/index.html');
      return new Response(html.body, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    return new Response(JSON.stringify({ ok: false, message: '路由不存在' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function handleGetFiles(request, R2_BUCKET) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const category = searchParams.get('category') || 'all';
    
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
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('获取文件列表失败:', error);
    return new Response(JSON.stringify({ ok: false, message: '获取文件列表失败', error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleDeleteFile(request, R2_BUCKET) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const name = decodeURIComponent(pathname.replace('/api/files/', ''));
    const folder = url.searchParams.get('category');
    
    if (!name) {
      return new Response(JSON.stringify({ ok: false, message: '缺少文件名参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const safeFolder = (folder || 'others').replace(/\.\./g, '').replace(/^\//, '');
    const key = `files/${safeFolder}/${name}`;
    
    if (key.includes('..') || !key.startsWith('files/')) {
      return new Response(JSON.stringify({ ok: false, message: '非法路径' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    await R2_BUCKET.delete(key);
    
    return new Response(JSON.stringify({ ok: true, message: '删除成功', file: name }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('删除失败:', error);
    return new Response(JSON.stringify({ ok: false, message: '删除失败', error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleUpload(request, R2_BUCKET) {
  try {
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
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    
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
    
    const key = `${folder}/${safeFilename}`;
    
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
      fileType: fileCategory.type,
      fileIcon: fileCategory.icon,
      downloadUrl: `/download/${key}`,
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('上传失败:', error);
    return new Response(JSON.stringify({ ok: false, message: '服务器异常', error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleDownload(request, R2_BUCKET) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace('/download/', '');
    const key = `files/${path}`;
    
    if (key.includes('..') || !key.startsWith('files/')) {
      return new Response(JSON.stringify({ ok: false, message: '非法路径' }), {
        status: 400,
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
        'Access-Control-Allow-Origin': '*'
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