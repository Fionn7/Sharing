const GITHUB_BRANCH = 'main';

function getFileCategory(ext) {
  const categories = {
    pdf: { folder: 'files/pdfs', type: 'PDF文档', icon: '📄' },
    doc: { folder: 'files/documents', type: 'Word文档', icon: '📝' },
    docx: { folder: 'files/documents', type: 'Word文档', icon: '📝' },
    xls: { folder: 'files/documents', type: 'Excel表格', icon: '📊' },
    xlsx: { folder: 'files/documents', type: 'Excel表格', icon: '📊' },
    ppt: { folder: 'files/documents', type: 'PPT演示', icon: '📽️' },
    pptx: { folder: 'files/documents', type: 'PPT演示', icon: '📽️' },
    txt: { folder: 'files/documents', type: '文本文件', icon: '📃' },
    jpg: { folder: 'files/images', type: '图片', icon: '🖼️' },
    jpeg: { folder: 'files/images', type: '图片', icon: '🖼️' },
    png: { folder: 'files/images', type: '图片', icon: '🖼️' },
    gif: { folder: 'files/images', type: '图片', icon: '🖼️' },
    bmp: { folder: 'files/images', type: '图片', icon: '🖼️' },
    svg: { folder: 'files/images', type: '图片', icon: '🖼️' },
    mp4: { folder: 'files/videos', type: '视频', icon: '🎬' },
    avi: { folder: 'files/videos', type: '视频', icon: '🎬' },
    mov: { folder: 'files/videos', type: '视频', icon: '🎬' },
    mp3: { folder: 'files/audio', type: '音频', icon: '🎵' },
    wav: { folder: 'files/audio', type: '音频', icon: '🎵' },
    zip: { folder: 'files/archives', type: '压缩包', icon: '📦' },
    rar: { folder: 'files/archives', type: '压缩包', icon: '📦' },
    '7z': { folder: 'files/archives', type: '压缩包', icon: '📦' },
    js: { folder: 'files/codes', type: '代码', icon: '💻' },
    html: { folder: 'files/codes', type: '代码', icon: '💻' },
    css: { folder: 'files/codes', type: '代码', icon: '💻' },
    json: { folder: 'files/codes', type: '代码', icon: '💻' },
  };
  return categories[ext] || { folder: 'files/others', type: '其他文件', icon: '📁' };
}

function sanitizeFilename(filename) {
  return filename.replace(/[/\\:*?"<>|]/g, '_');
}

export async function onRequest({ request, env, params }) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
      }
    });
  }

  const githubToken = env.GITHUB_TOKEN;
  const githubOwner = env.GITHUB_OWNER;
  const githubRepo = env.GITHUB_REPO;

  if (!githubToken || !githubOwner || !githubRepo) {
    return new Response(JSON.stringify({ ok: false, message: '未配置 GitHub 凭据' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // GET /api/files - List all files
  if (pathname === '/api/files' && method === 'GET') {
    return handleGetFiles(githubToken, githubOwner, githubRepo);
  }

  // DELETE /api/files/:filename?category=xxx - Delete a file
  if (pathname.startsWith('/api/files/') && method === 'DELETE') {
    const filename = decodeURIComponent(pathname.replace('/api/files/', ''));
    const category = url.searchParams.get('category');
    return handleDeleteFile(filename, category, githubToken, githubOwner, githubRepo);
  }

  // POST /api/upload - Upload a file
  if (pathname === '/api/upload' && method === 'POST') {
    return handleUpload(request, githubToken, githubOwner, githubRepo);
  }

  return new Response(JSON.stringify({ ok: false, message: '路由不存在' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleGetFiles(githubToken, githubOwner, githubRepo) {
  try {
    const allFiles = [];
    let page = 1;
    
    while (true) {
      const apiUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/files?page=${page}&per_page=100`;
      const response = await fetch(apiUrl, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${githubToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      
      if (!response.ok) break;
      const files = await response.json();
      if (!files || files.length === 0) break;
      
      for (const file of files) {
        if (file.type !== 'file') continue;
        
        const key = file.path;
        const parts = key.split('/');
        const filename = parts[parts.length - 1];
        const folder = parts.slice(0, -1).join('/');
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const fileCategory = getFileCategory(ext);
        
        allFiles.push({
          name: filename,
          filename: filename,
          path: key,
          folder: folder,
          type: fileCategory.type,
          icon: fileCategory.icon,
          size: file.size,
          last_modified: file.updated_at,
          downloadUrl: `/download/${key}`,
        });
      }
      page++;
    }
    
    return new Response(JSON.stringify({ ok: true, files: allFiles }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, message: '获取文件列表失败', error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleDeleteFile(filename, category, githubToken, githubOwner, githubRepo) {
  try {
    if (!filename) {
      return new Response(JSON.stringify({ ok: false, message: '缺少文件名参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const safeFolder = (category || 'others').replace(/\.\./g, '').replace(/^\//, '');
    const key = `files/${safeFolder}/${filename}`;
    
    if (key.includes('..') || !key.startsWith('files/')) {
      return new Response(JSON.stringify({ ok: false, message: '非法路径' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const getUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${key}`;
    const getResponse = await fetch(getUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    
    if (!getResponse.ok) {
      return new Response(JSON.stringify({ ok: false, message: '文件不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const fileData = await getResponse.json();
    const sha = fileData.sha;
    
    const deleteUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${key}`;
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Delete file: ${filename}`,
        sha: sha,
        branch: GITHUB_BRANCH,
      }),
    });
    
    if (!deleteResponse.ok) {
      const errorData = await deleteResponse.json();
      return new Response(JSON.stringify({ ok: false, message: errorData.message || '删除失败' }), {
        status: deleteResponse.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ ok: true, message: '删除成功', file: filename }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, message: '删除失败', error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleUpload(request, githubToken, githubOwner, githubRepo) {
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
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    
    if (fileSize > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ ok: false, message: `文件大小超过限制（最大 ${MAX_FILE_SIZE / 1024 / 1024}MB）` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const ext = safeFilename.split('.').pop()?.toLowerCase() || '';
    const fileCategory = getFileCategory(ext);
    const folder = fileCategory.folder;
    const key = `${folder}/${safeFilename}`;
    
    const arrayBuffer = await file.arrayBuffer();
    const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    const url = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${key}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Upload file: ${safeFilename}`,
        content: base64Content,
        branch: GITHUB_BRANCH,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return new Response(JSON.stringify({ ok: false, message: errorData.message || '上传失败' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      ok: true,
      message: '上传成功',
      file: safeFilename,
      size: fileSize,
      category: folder,
      type: fileCategory.type,
      icon: fileCategory.icon,
      downloadUrl: `/download/${key}`,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, message: '服务器异常', error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
