interface Env {
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
    const githubOwner = env.GITHUB_OWNER || 'Fionn7';
    const githubRepo = env.GITHUB_REPO || 'Sharing';

    if (pathname === '/') {
      return handleHome();
    }

    if (pathname === '/api/files' && method === 'GET') {
      return handleGetFiles(githubToken, githubOwner, githubRepo);
    }

    if (pathname === '/api/upload' && method === 'POST') {
      return handleUpload(request, githubToken, githubOwner, githubRepo);
    }

    if (pathname.startsWith('/download/')) {
      const path = pathname.replace('/download/', '');
      return handleDownload(path, githubToken, githubOwner, githubRepo);
    }

    if (pathname === '/api/debug') {
      return new Response(JSON.stringify({
        ok: true,
        tokenConfigured: !!githubToken,
        owner: githubOwner,
        repo: githubRepo
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('404 Not Found', { status: 404 });
  }
};

function handleHome(): Response {
  const html = getHtmlContent();
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

function getHtmlContent(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sharing - 文件共享平台</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); min-height: 100vh; color: white; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    header { text-align: center; margin-bottom: 40px; padding-top: 40px; }
    h1 { font-size: 2.5rem; margin-bottom: 10px; }
    .upload-area { border: 2px dashed #4a90d9; border-radius: 16px; padding: 40px; text-align: center; cursor: pointer; transition: all 0.3s; margin-bottom: 30px; }
    .upload-area:hover { border-color: #6ab0ff; background: rgba(74, 144, 217, 0.1); }
    .upload-area.dragover { border-color: #28a745; background: rgba(40, 167, 69, 0.1); }
    #file-input { display: none; }
    .file-list { background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; }
    .file-item { display: flex; align-items: center; padding: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
    .file-item:last-child { border-bottom: none; }
    .file-icon { font-size: 24px; margin-right: 12px; }
    .file-info { flex: 1; }
    .file-name { font-weight: 500; }
    .file-size { font-size: 12px; color: #9ca3af; }
    .file-actions { display: flex; gap: 8px; }
    .btn { padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px; }
    .btn-download { background: #4a90d9; color: white; }
    .btn-delete { background: #dc3545; color: white; }
    .btn-download:hover { background: #3d7bc6; }
    .btn-delete:hover { background: #c82333; }
    .loading { text-align: center; padding: 20px; color: #9ca3af; }
    .error { background: rgba(220, 53, 69, 0.2); border: 1px solid #dc3545; border-radius: 8px; padding: 12px; margin-bottom: 20px; color: #f87171; }
    .category-tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
    .category-tab { padding: 6px 12px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); background: transparent; color: white; cursor: pointer; transition: all 0.3s; }
    .category-tab.active { background: #4a90d9; border-color: #4a90d9; }
    .upload-progress { margin-top: 20px; }
    .progress-item { display: flex; align-items: center; margin-bottom: 10px; }
    .progress-bar { flex: 1; height: 8px; background: rgba(255, 255, 255, 0.2); border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; background: #4a90d9; transition: width 0.3s; }
    .upload-status { margin-left: 12px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📁 Sharing</h1>
      <p>课题组内部文件共享平台</p>
    </header>

    <div id="upload-area" class="upload-area">
      <div style="font-size: 48px; margin-bottom: 16px;">📤</div>
      <p style="font-size: 1.2rem; margin-bottom: 8px;">拖拽文件到这里上传</p>
      <p style="color: #9ca3af;">或点击选择文件</p>
      <input type="file" id="file-input" multiple>
    </div>

    <div id="upload-progress" class="upload-progress" style="display: none;"></div>

    <div class="category-tabs" id="category-tabs">
      <button class="category-tab active" data-category="all">全部</button>
      <button class="category-tab" data-category="PDF文档">📄 PDF</button>
      <button class="category-tab" data-category="Word文档">📝 Word</button>
      <button class="category-tab" data-category="图片">🖼️ 图片</button>
      <button class="category-tab" data-category="视频">🎬 视频</button>
      <button class="category-tab" data-category="其他">📁 其他</button>
    </div>

    <div class="file-list" id="file-list">
      <div class="loading">加载文件列表中...</div>
    </div>
  </div>

  <script>
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    const categoryTabs = document.getElementById('category-tabs');
    const uploadProgress = document.getElementById('upload-progress');

    let allFiles = [];
    let currentCategory = 'all';

    uploadArea.addEventListener('click', function() { fileInput.click(); });

    uploadArea.addEventListener('dragover', function(e) {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', function() {
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', function(e) {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        uploadFiles(e.dataTransfer.files);
      }
    });

    fileInput.addEventListener('change', function() {
      if (fileInput.files.length > 0) {
        uploadFiles(fileInput.files);
      }
    });

    categoryTabs.addEventListener('click', function(e) {
      const tab = e.target.closest('.category-tab');
      if (tab) {
        document.querySelectorAll('.category-tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        currentCategory = tab.dataset.category;
        renderFiles();
      }
    });

    async function loadFiles() {
      try {
        const response = await fetch('/api/files');
        const data = await response.json();
        if (data.ok && data.files) {
          allFiles = data.files;
          renderFiles();
        } else {
          fileList.innerHTML = '<div class="error">' + (data.message || '无法加载文件列表') + '</div>';
        }
      } catch (error) {
        fileList.innerHTML = '<div class="error">加载失败: ' + error.message + '</div>';
      }
    }

    function renderFiles() {
      const filtered = currentCategory === 'all' ? allFiles : allFiles.filter(function(f) { return f.type === currentCategory; });
      
      if (filtered.length === 0) {
        fileList.innerHTML = '<div style="text-align: center; color: #9ca3af; padding: 20px;">暂无文件</div>';
        return;
      }

      fileList.innerHTML = filtered.map(function(file) {
        return '<div class="file-item">' +
          '<div class="file-icon">' + (file.icon || '📄') + '</div>' +
          '<div class="file-info">' +
            '<div class="file-name">' + escapeHtml(file.name) + '</div>' +
            '<div class="file-size">' + formatSize(file.size) + ' · ' + file.type + '</div>' +
          '</div>' +
          '<div class="file-actions">' +
            '<button class="btn btn-download" onclick="downloadFile(\'' + escapeHtml(file.name) + '\', \'' + escapeHtml(file.folder) + '\')">下载</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatSize(bytes) {
      if (!bytes) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function downloadFile(filename, folder) {
      const url = '/download/' + folder + '/' + encodeURIComponent(filename);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    async function uploadFiles(files) {
      uploadProgress.style.display = 'block';
      uploadProgress.innerHTML = '';

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progressId = 'progress-' + Date.now() + '-' + Math.random();
        uploadProgress.innerHTML += '<div class="progress-item">' +
          '<span>' + escapeHtml(file.name) + '</span>' +
          '<div class="progress-bar"><div class="progress-fill" id="' + progressId + '"></div></div>' +
          '<span class="upload-status" id="status-' + progressId + '">0%</span>' +
        '</div>';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('filename', file.name);

        try {
          const response = await fetch('/api/upload', { method: 'POST', body: formData });
          const data = await response.json();
          
          if (data.ok) {
            document.getElementById(progressId).style.width = '100%';
            document.getElementById('status-' + progressId).textContent = '✓ 完成';
            document.getElementById('status-' + progressId).style.color = '#22c55e';
            await loadFiles();
          } else {
            document.getElementById('status-' + progressId).textContent = '✗ 失败';
            document.getElementById('status-' + progressId).style.color = '#dc3545';
          }
        } catch (error) {
          document.getElementById('status-' + progressId).textContent = '✗ ' + error.message;
          document.getElementById('status-' + progressId).style.color = '#dc3545';
        }
      }
    }

    loadFiles();
  </script>
</body>
</html>`;
}

async function handleGetFiles(token: string, owner: string, repo: string): Promise<Response> {
  if (!token) {
    return new Response(JSON.stringify({ ok: false, message: '请配置 GITHUB_TOKEN' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const files = await fetchGitHubFiles(token, owner, repo);
    return new Response(JSON.stringify({ ok: true, files, count: files.length }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function fetchGitHubFiles(token: string, owner: string, repo: string): Promise<any[]> {
  const files: any[] = [];
  
  async function traverse(path: string): Promise<void> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      }
    });
    
    if (!response.ok) return;
    
    const items = await response.json();
    if (!Array.isArray(items)) return;
    
    for (const item of items) {
      if (item.type === 'dir') {
        await traverse(item.path);
      } else if (item.type === 'file') {
        const ext = item.name.split('.').pop()?.toLowerCase() || '';
        const category = getCategory(ext);
        files.push({
          name: item.name,
          path: item.path,
          folder: item.path.split('/').slice(0, -1).join('/'),
          size: item.size,
          type: category.name,
          icon: category.icon,
          last_modified: item.updated_at
        });
      }
    }
  }
  
  await traverse('files');
  return files;
}

function getCategory(ext: string): { name: string; icon: string } {
  const categories: Record<string, { name: string; icon: string }> = {
    pdf: { name: 'PDF文档', icon: '📄' },
    doc: { name: 'Word文档', icon: '📝' },
    docx: { name: 'Word文档', icon: '📝' },
    xls: { name: 'Excel表格', icon: '📊' },
    xlsx: { name: 'Excel表格', icon: '📊' },
    jpg: { name: '图片', icon: '🖼️' },
    jpeg: { name: '图片', icon: '🖼️' },
    png: { name: '图片', icon: '🖼️' },
    gif: { name: '图片', icon: '🖼️' },
    mp4: { name: '视频', icon: '🎬' },
    mov: { name: '视频', icon: '🎬' },
    mp3: { name: '音频', icon: '🎵' },
    zip: { name: '压缩包', icon: '📦' },
    rar: { name: '压缩包', icon: '📦' },
  };
  return categories[ext] || { name: '其他', icon: '📁' };
}

async function handleUpload(request: Request, token: string, owner: string, repo: string): Promise<Response> {
  if (!token) {
    return new Response(JSON.stringify({ ok: false, message: '请配置 GITHUB_TOKEN' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const filename = formData.get('filename') || (file as File).name;
    
    if (!file) {
      return new Response(JSON.stringify({ ok: false, message: '请选择文件' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const ext = filename.toString().split('.').pop()?.toLowerCase() || '';
    const folder = getFolder(ext);
    const path = `${folder}/${filename}`;

    const arrayBuffer = await (file as File).arrayBuffer();
    const content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Upload: ${filename}`,
        content,
        branch: 'main'
      })
    });

    if (!response.ok) {
      const data = await response.json();
      return new Response(JSON.stringify({ ok: false, message: data.message || '上传失败' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true, message: '上传成功', filename, folder }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function getFolder(ext: string): string {
  const folders: Record<string, string> = {
    pdf: 'files/pdfs',
    doc: 'files/documents',
    docx: 'files/documents',
    xls: 'files/documents',
    xlsx: 'files/documents',
    ppt: 'files/documents',
    pptx: 'files/documents',
    jpg: 'files/images',
    jpeg: 'files/images',
    png: 'files/images',
    gif: 'files/images',
    svg: 'files/images',
    mp4: 'files/videos',
    mov: 'files/videos',
    avi: 'files/videos',
    mp3: 'files/audio',
    wav: 'files/audio',
    zip: 'files/archives',
    rar: 'files/archives',
    '7z': 'files/archives',
    js: 'files/codes',
    html: 'files/codes',
    css: 'files/codes',
    json: 'files/codes',
  };
  return folders[ext] || 'files/others';
}

async function handleDownload(path: string, token: string, owner: string, repo: string): Promise<Response> {
  if (!token) {
    return new Response(JSON.stringify({ ok: false, message: '请配置 GITHUB_TOKEN' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const fullPath = `files/${path}`;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${fullPath}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.raw'
      }
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ ok: false, message: '文件不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const filename = fullPath.split('/').pop() || 'download';
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return new Response(response.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}