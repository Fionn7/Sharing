const GITHUB_BRANCH = 'main';

const INDEX_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sharing - 课题组内部文件共享平台</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" rel="stylesheet">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        primary: '#0ea5e9',
                        secondary: '#8b5cf6',
                    },
                    fontFamily: {
                        inter: ['Inter', 'system-ui', 'sans-serif', 'Arial', 'Helvetica'],
                    },
                }
            }
        }
    </script>
</head>
<body class="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <div class="max-w-6xl mx-auto">
            <div class="text-center mb-8">
                <h1 class="text-4xl font-bold text-white mb-2">📁 课题组文件共享平台</h1>
                <p class="text-gray-300">安全、便捷的文件存储与分享</p>
            </div>

            <div class="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 mb-6">
                <div class="flex flex-wrap gap-4 items-center justify-between mb-6">
                    <div class="flex flex-wrap gap-2">
                        <button onclick="filterFiles('all')" class="filter-btn active px-4 py-2 rounded-lg bg-primary text-white font-medium transition-all hover:bg-primary/80" data-category="all">
                            📂 全部
                        </button>
                        <button onclick="filterFiles('files/images')" class="filter-btn px-4 py-2 rounded-lg bg-white/20 text-white font-medium transition-all hover:bg-white/30" data-category="files/images">
                            🖼️ 图片
                        </button>
                        <button onclick="filterFiles('files/documents')" class="filter-btn px-4 py-2 rounded-lg bg-white/20 text-white font-medium transition-all hover:bg-white/30" data-category="files/documents">
                            📄 文档
                        </button>
                        <button onclick="filterFiles('files/pdfs')" class="filter-btn px-4 py-2 rounded-lg bg-white/20 text-white font-medium transition-all hover:bg-white/30" data-category="files/pdfs">
                            📑 PDF
                        </button>
                        <button onclick="filterFiles('files/videos')" class="filter-btn px-4 py-2 rounded-lg bg-white/20 text-white font-medium transition-all hover:bg-white/30" data-category="files/videos">
                            🎬 视频
                        </button>
                        <button onclick="filterFiles('files/audio')" class="filter-btn px-4 py-2 rounded-lg bg-white/20 text-white font-medium transition-all hover:bg-white/30" data-category="files/audio">
                            🎵 音频
                        </button>
                        <button onclick="filterFiles('files/archives')" class="filter-btn px-4 py-2 rounded-lg bg-white/20 text-white font-medium transition-all hover:bg-white/30" data-category="files/archives">
                            📦 压缩包
                        </button>
                        <button onclick="filterFiles('files/others')" class="filter-btn px-4 py-2 rounded-lg bg-white/20 text-white font-medium transition-all hover:bg-white/30" data-category="files/others">
                            📁 其他
                        </button>
                    </div>
                </div>

                <div id="file-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div class="col-span-full text-center py-12 text-gray-400">
                        <i class="fa fa-spinner fa-spin text-4xl mb-4"></i>
                        <p>加载中...</p>
                    </div>
                </div>
            </div>

            <div class="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6">
                <h2 class="text-2xl font-bold text-white mb-4">📤 上传文件</h2>
                <form id="upload-form" class="space-y-4">
                    <div>
                        <label class="block text-white mb-2">选择文件</label>
                        <input type="file" id="file-input" class="w-full px-4 py-2 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:border-primary">
                    </div>
                    <div>
                        <label class="block text-white mb-2">文件名（可选）</label>
                        <input type="text" id="filename-input" placeholder="留空使用原文件名" class="w-full px-4 py-2 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:border-primary">
                    </div>
                    <button type="submit" class="w-full py-3 rounded-lg bg-gradient-to-r from-primary to-secondary text-white font-bold text-lg hover:opacity-90 transition-all">
                        <i class="fa fa-upload mr-2"></i>上传文件
                    </button>
                </form>
            </div>
        </div>
    </div>

    <div id="toast" class="fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg transform translate-y-20 opacity-0 transition-all duration-300 z-50"></div>

    <script>
        let currentCategory = 'all';

        async function loadFiles() {
            const fileList = document.getElementById('file-list');
            fileList.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400"><i class="fa fa-spinner fa-spin text-4xl mb-4"></i><p>加载中...</p></div>';

            try {
                const url = currentCategory === 'all' ? '/api/files' : '/api/files?category=' + encodeURIComponent(currentCategory);
                const response = await fetch(url);
                const data = await response.json();

                if (!data.ok) {
                    throw new Error(data.message || '加载失败');
                }

                if (data.files.length === 0) {
                    fileList.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400"><i class="fa fa-folder-open text-4xl mb-4"></i><p>暂无文件</p></div>';
                    return;
                }

                fileList.innerHTML = data.files.map(file => \`
                    <div class="bg-white/10 backdrop-blur rounded-xl p-4 hover:bg-white/20 transition-all group">
                        <div class="flex items-start justify-between mb-3">
                            <div class="flex items-center gap-3">
                                <span class="text-3xl">\${file.icon}</span>
                                <div class="flex-1 min-w-0">
                                    <h3 class="text-white font-medium truncate" title="\${file.name}">\${file.name}</h3>
                                    <p class="text-gray-400 text-sm">\${file.fileType}</p>
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between text-sm text-gray-400 mb-3">
                            <span>\${formatFileSize(file.size)}</span>
                            <span>\${formatDate(file.lastModified)}</span>
                        </div>
                        <div class="flex gap-2">
                            <a href="\${file.downloadUrl}" download="\${file.name}" class="flex-1 py-2 px-3 rounded-lg bg-primary text-white text-center hover:bg-primary/80 transition-all">
                                <i class="fa fa-download mr-1"></i>下载
                            </a>
                            <button onclick="deleteFile('\${encodeURIComponent(file.name)}', '\${encodeURIComponent(file.category)}')" class="py-2 px-3 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all">
                                <i class="fa fa-trash"></i>
                            </button>
                        </div>
                    </div>
                \`).join('');
            } catch (error) {
                console.error('加载文件失败:', error);
                fileList.innerHTML = '<div class="col-span-full text-center py-12 text-red-400"><i class="fa fa-exclamation-triangle text-4xl mb-4"></i><p>加载失败: ' + error.message + '</p></div>';
            }
        }

        function filterFiles(category) {
            currentCategory = category;
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active', 'bg-primary');
                btn.classList.add('bg-white/20');
            });
            document.querySelector('[data-category="' + category + '"]').classList.add('active', 'bg-primary');
            document.querySelector('[data-category="' + category + '"]').classList.remove('bg-white/20');
            loadFiles();
        }

        async function deleteFile(name, category) {
            if (!confirm('确定要删除这个文件吗？')) return;

            try {
                const url = '/api/files/' + name + '?category=' + category;
                const response = await fetch(url, { method: 'DELETE' });
                const data = await response.json();

                if (data.ok) {
                    showToast('删除成功', 'success');
                    loadFiles();
                } else {
                    throw new Error(data.message || '删除失败');
                }
            } catch (error) {
                console.error('删除文件失败:', error);
                showToast('删除失败: ' + error.message, 'error');
            }
        }

        document.getElementById('upload-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            const fileInput = document.getElementById('file-input');
            const filenameInput = document.getElementById('filename-input');
            const file = fileInput.files[0];

            if (!file) {
                showToast('请选择文件', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('file', file);
            if (filenameInput.value) {
                formData.append('filename', filenameInput.value);
            }

            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();

                if (data.ok) {
                    showToast('上传成功', 'success');
                    fileInput.value = '';
                    filenameInput.value = '';
                    loadFiles();
                } else {
                    throw new Error(data.message || '上传失败');
                }
            } catch (error) {
                console.error('上传失败:', error);
                showToast('上传失败: ' + error.message, 'error');
            }
        });

        function formatFileSize(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        function formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function showToast(message, type = 'info') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 z-50';

            if (type === 'success') {
                toast.classList.add('bg-green-500', 'text-white');
            } else if (type === 'error') {
                toast.classList.add('bg-red-500', 'text-white');
            } else {
                toast.classList.add('bg-blue-500', 'text-white');
            }

            toast.classList.remove('translate-y-20', 'opacity-0');

            setTimeout(() => {
                toast.classList.add('translate-y-20', 'opacity-0');
            }, 3000);
        }

        loadFiles();
    </script>
</body>
</html>`;

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

async function handleGetFiles(request, githubToken, githubOwner, githubRepo) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const category = searchParams.get('category') || 'all';
    const allFiles = [];
    let page = 1;
    
    while (true) {
      const url = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/files?page=${page}&per_page=100`;
      const response = await fetch(url, {
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
        
        if (category === 'all' || folder === `files/${category}` || fileCategory.type === category) {
          allFiles.push({
            name: filename,
            filename: filename,
            path: key,
            category: folder,
            fileType: fileCategory.type,
            icon: fileCategory.icon,
            size: file.size,
            lastModified: file.updated_at,
            downloadUrl: `/download/${key}`,
          });
        }
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

async function handleDeleteFile(request, githubToken, githubOwner, githubRepo) {
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
        message: `Delete file: ${name}`,
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
    
    return new Response(JSON.stringify({ ok: true, message: '删除成功', file: name }), {
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
    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    
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
      fileType: fileCategory.type,
      fileIcon: fileCategory.icon,
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

async function handleDownload(request, githubToken, githubOwner, githubRepo) {
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
    
    const getUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${key}`;
    const response = await fetch(getUrl, {
      headers: {
        Accept: 'application/vnd.github.raw',
        Authorization: `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    
    if (!response.ok) {
      return new Response(JSON.stringify({ ok: false, message: '文件不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const filename = key.split('/').pop();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    
    return new Response(response.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': contentLength,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, message: '下载失败', error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default {
  async fetch(request, env, ctx) {
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

    if (pathname === '/api/files' && method === 'GET') {
      return handleGetFiles(request, githubToken, githubOwner, githubRepo);
    }

    if (pathname.startsWith('/api/files/') && method === 'DELETE') {
      return handleDeleteFile(request, githubToken, githubOwner, githubRepo);
    }

    if (pathname === '/api/upload' && method === 'POST') {
      return handleUpload(request, githubToken, githubOwner, githubRepo);
    }

    if (pathname.startsWith('/download/') && method === 'GET') {
      return handleDownload(request, githubToken, githubOwner, githubRepo);
    }

    if (pathname === '/' || pathname === '/index.html') {
      return new Response(INDEX_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new Response(JSON.stringify({ ok: false, message: '路由不存在' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};