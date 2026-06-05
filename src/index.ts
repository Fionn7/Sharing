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

    if (pathname.startsWith('/api/files/') && method === 'DELETE') {
      const filename = decodeURIComponent(pathname.replace('/api/files/', ''));
      const category = url.searchParams.get('category') || 'files/others';
      return handleDelete(filename, category, githubToken, githubOwner, githubRepo);
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
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #0f172a;
            color: #ffffff;
            min-height: 100vh;
            overflow-x: hidden;
        }

        .bg-backdrop {
            background-color: #0f172a;
            background-image: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
        }

        .glass {
            background-color: rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .glass-light {
            background-color: rgba(255, 255, 255, 0.12);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .gradient-text {
            background: linear-gradient(135deg, #ffffff 0%, #93c5fd 50%, #a78bfa 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .category-btn {
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .category-btn:hover {
            background: rgba(255, 255, 255, 0.18);
            color: #ffffff;
        }

        .category-btn.active {
            background: rgba(14, 165, 233, 0.25);
            color: #ffffff;
            border-color: rgba(14, 165, 233, 0.6);
        }

        .hidden-el {
            display: none;
        }
    </style>
</head>
<body class="bg-backdrop">
    <div class="fixed inset-0 -z-10">
        <div class="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>
    </div>

    <nav id="navbar" class="fixed top-0 left-0 right-0 z-50 py-4 px-6">
        <div class="max-w-5xl mx-auto">
            <div class="glass rounded-full px-6 py-3 flex justify-between items-center">
                <span class="text-2xl font-bold gradient-text">Sharing</span>
                <div class="flex items-center space-x-8">
                    <a href="#upload" class="text-white/80 hover:text-white transition-colors text-sm">上传</a>
                    <a href="#files" class="text-white/80 hover:text-white transition-colors text-sm">文件库</a>
                </div>
            </div>
        </div>
    </nav>

    <section id="upload" class="pt-28 pb-12">
        <div class="max-w-3xl mx-auto px-6 text-center">
            <div class="glass rounded-3xl p-8 md:p-12">
                <div class="w-20 h-20 mx-auto mb-6 bg-white/10 rounded-full flex items-center justify-center">
                    <i class="fa fa-cloud-upload text-3xl text-sky-400"></i>
                </div>
                <h1 class="text-3xl md:text-4xl font-bold mb-3 text-white">拖拽文件到这里上传</h1>
                <p class="text-white/70 text-lg mb-6">文件将自动分类存储到共享库</p>
                <div id="upload-area" class="glass-light rounded-2xl p-8 md:p-10 hover:bg-white/20 transition-colors cursor-pointer border-2 border-dashed border-white/30">
                    <div class="w-14 h-14 mx-auto mb-3 bg-white/10 rounded-full flex items-center justify-center">
                        <i class="fa fa-cloud-upload text-2xl text-sky-300"></i>
                    </div>
                    <p class="text-white/90">点击或拖拽文件到此处</p>
                </div>
                <input type="file" id="file-input" class="hidden-el" multiple>
                <div id="upload-list" class="mt-6 space-y-2 hidden-el"></div>
            </div>
        </div>
    </section>

    <section id="files" class="py-8 pb-20">
        <div class="max-w-4xl mx-auto px-6">
            <div class="text-center mb-8">
                <h2 class="text-2xl font-bold text-white">文件库</h2>
            </div>
            <div class="glass rounded-2xl overflow-hidden">
                <div class="p-5">
                    <div class="flex flex-wrap gap-2 mb-5" id="categoryFilters">
                        <button class="category-btn active px-3 py-1.5 rounded-lg text-sm transition-colors" data-category="all">全部</button>
                        <button class="category-btn px-3 py-1.5 rounded-lg text-sm transition-colors" data-category="PDF文档">📄 PDF</button>
                        <button class="category-btn px-3 py-1.5 rounded-lg text-sm transition-colors" data-category="Word文档">📝 Word</button>
                        <button class="category-btn px-3 py-1.5 rounded-lg text-sm transition-colors" data-category="Excel表格">📊 Excel</button>
                        <button class="category-btn px-3 py-1.5 rounded-lg text-sm transition-colors" data-category="PPT演示">📽️ PPT</button>
                        <button class="category-btn px-3 py-1.5 rounded-lg text-sm transition-colors" data-category="图片">🖼️ 图片</button>
                        <button class="category-btn px-3 py-1.5 rounded-lg text-sm transition-colors" data-category="视频">🎬 视频</button>
                        <button class="category-btn px-3 py-1.5 rounded-lg text-sm transition-colors" data-category="音频">🎵 音频</button>
                        <button class="category-btn px-3 py-1.5 rounded-lg text-sm transition-colors" data-category="压缩包">📦 压缩包</button>
                        <button class="category-btn px-3 py-1.5 rounded-lg text-sm transition-colors" data-category="代码">💻 代码</button>
                        <button class="category-btn px-3 py-1.5 rounded-lg text-sm transition-colors" data-category="其他文件">📁 其他</button>
                    </div>
                    <div class="space-y-2" id="fileList">
                        <div class="text-center py-6 text-white/50 text-sm">加载中...</div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <footer class="py-8">
        <div class="max-w-4xl mx-auto px-6">
            <div class="glass rounded-2xl p-6 text-center">
                <span class="text-lg font-bold gradient-text">Sharing</span>
                <p class="text-white/60 text-sm mt-2">© 2026 Sharing. 仅供内部使用</p>
            </div>
        </div>
    </footer>

    <div id="toast-container" class="fixed top-20 right-6 z-50 space-y-2"></div>

    <script>
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        const uploadList = document.getElementById('upload-list');
        const fileList = document.getElementById('fileList');
        const toastContainer = document.getElementById('toast-container');

        uploadArea.addEventListener('click', function() { fileInput.click(); });

        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            uploadArea.style.backgroundColor = 'rgba(14, 165, 233, 0.15)';
            uploadArea.style.borderColor = 'rgba(14, 165, 233, 0.5)';
        });

        uploadArea.addEventListener('dragleave', function() {
            uploadArea.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
            uploadArea.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        });

        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            uploadArea.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
            uploadArea.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            if (e.dataTransfer.files.length > 0) {
                handleFiles(e.dataTransfer.files);
            }
        });

        fileInput.addEventListener('change', function() {
            if (fileInput.files.length > 0) {
                handleFiles(fileInput.files);
            }
        });

        function escapeHTML(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        function formatFileSize(bytes) {
            if (bytes === 0 || !bytes) return '--';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        function getFileIconClass(filename) {
            const ext = filename.split('.').pop().toLowerCase();
            if (['pdf'].includes(ext)) return 'text-red-400';
            if (['doc', 'docx'].includes(ext)) return 'text-blue-400';
            if (['xls', 'xlsx'].includes(ext)) return 'text-green-400';
            if (['ppt', 'pptx'].includes(ext)) return 'text-orange-400';
            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'text-purple-400';
            if (['mp4', 'avi', 'mov', 'wmv'].includes(ext)) return 'text-yellow-400';
            if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'text-amber-400';
            if (['mp3', 'wav', 'flac'].includes(ext)) return 'text-pink-400';
            if (['js', 'html', 'css', 'json', 'ts', 'py'].includes(ext)) return 'text-cyan-400';
            return 'text-gray-400';
        }

        function getFileIcon(filename) {
            const ext = filename.split('.').pop().toLowerCase();
            if (['pdf'].includes(ext)) return 'fa-file-pdf-o';
            if (['doc', 'docx'].includes(ext)) return 'fa-file-word-o';
            if (['xls', 'xlsx'].includes(ext)) return 'fa-file-excel-o';
            if (['ppt', 'pptx'].includes(ext)) return 'fa-file-powerpoint-o';
            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'fa-file-image-o';
            if (['mp4', 'avi', 'mov', 'wmv'].includes(ext)) return 'fa-file-video-o';
            if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'fa-file-archive-o';
            if (['mp3', 'wav', 'flac'].includes(ext)) return 'fa-file-audio-o';
            if (['js', 'html', 'css', 'json', 'ts', 'py'].includes(ext)) return 'fa-file-code-o';
            return 'fa-file-o';
        }

        async function loadFiles() {
            try {
                const response = await fetch('/api/files');
                const data = await response.json();
                if (data.ok && data.files) {
                    displayFiles(data.files);
                } else {
                    const errorMsg = data.message || '无法获取文件列表，请配置 GITHUB_TOKEN';
                    fileList.innerHTML = '<div class="text-center py-6 text-red-400 text-sm">' + errorMsg + '</div>';
                }
            } catch (error) {
                fileList.innerHTML = '<div class="text-center py-6 text-red-400 text-sm">加载失败: ' + error.message + '</div>';
            }
        }

        let currentCategory = 'all';
        let allFilesData = [];

        function displayFiles(files) {
            allFilesData = files;
            filterFilesByCategory();
        }

        function filterFilesByCategory() {
            const filteredFiles = currentCategory === 'all' ? allFilesData : allFilesData.filter(function(f) { return f.type === currentCategory; });

            if (filteredFiles.length === 0) {
                fileList.innerHTML = '<div class="text-center py-6 text-white/50 text-sm">暂无文件</div>';
                return;
            }

            let html = '';
            filteredFiles.forEach(function(file) {
                const iconClass = getFileIconClass(file.name);
                const icon = getFileIcon(file.name);
                html += '<div class="flex items-center p-3 rounded-lg hover:bg-white/10 transition-colors cursor-pointer" data-name="' + escapeHTML(file.name) + '" data-folder="' + escapeHTML(file.folder) + '">' +
                    '<div class="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center mr-4">' +
                    '<i class="fa ' + icon + ' ' + iconClass + '"></i></div>' +
                    '<div class="flex-1 min-w-0"><div class="text-sm truncate">' + escapeHTML(file.name) + '</div></div>' +
                    '<div class="text-xs text-white/50 hidden md:block">' + formatFileSize(file.size) + '</div>' +
                    '<button class="ml-4 text-red-400 hover:text-red-300 px-2 py-1 text-xs delete-btn" data-name="' + escapeHTML(file.name) + '" data-folder="' + escapeHTML(file.folder) + '">' +
                    '<i class="fa fa-trash"></i></button>' +
                    '</div>';
            });
            fileList.innerHTML = html;

            fileList.querySelectorAll('[data-name]').forEach(function(el) {
                el.addEventListener('click', function(e) {
                    if (e.target.closest('.delete-btn')) {
                        const btn = e.target.closest('.delete-btn');
                        deleteFile(btn.dataset.name, btn.dataset.folder);
                    } else {
                        downloadFile(el.dataset.name, el.dataset.folder);
                    }
                });
            });
        }

        document.getElementById('categoryFilters').addEventListener('click', function(e) {
            const btn = e.target.closest('.category-btn');
            if (btn) {
                document.querySelectorAll('.category-btn').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                currentCategory = btn.dataset.category;
                filterFilesByCategory();
            }
        });

        function downloadFile(filename, folder) {
            const url = '/download/' + folder + '/' + encodeURIComponent(filename);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('开始下载: ' + filename, 'success');
        }

        async function deleteFile(filename, folder) {
            if (!confirm('确定要删除文件 "' + filename + '" 吗？')) return;
            try {
                const response = await fetch('/api/files/' + encodeURIComponent(filename) + '?category=' + encodeURIComponent(folder), { method: 'DELETE' });
                const data = await response.json();
                if (data.ok) {
                    showToast('删除成功', 'success');
                    loadFiles();
                } else {
                    showToast('删除失败: ' + (data.message || '未知错误'), 'error');
                }
            } catch (error) {
                showToast('删除失败，请稍后重试', 'error');
            }
        }

        function handleFiles(files) {
            uploadList.classList.remove('hidden-el');
            uploadList.style.display = 'block';
            Array.from(files).forEach(function(file) {
                const uploadItem = document.createElement('div');
                uploadItem.className = 'glass rounded-lg p-3 flex items-center';
                uploadItem.innerHTML = '<div class="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center mr-4">' +
                    '<i class="fa ' + getFileIcon(file.name) + ' ' + getFileIconClass(file.name) + '"></i></div>' +
                    '<div class="flex-1"><div class="text-sm">' + escapeHTML(file.name) + '</div>' +
                    '<div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">' +
                    '<div class="progress-bar h-full bg-sky-400 w-0 transition-all duration-300"></div></div></div>' +
                    '<div class="text-sm text-white/70 ml-4 progress-text">0%</div>';
                uploadList.appendChild(uploadItem);

                const progressBar = uploadItem.querySelector('.progress-bar');
                const progressText = uploadItem.querySelector('.progress-text');
                let progress = 0;

                const interval = setInterval(function() {
                    progress += Math.random() * 20;
                    if (progress >= 100) {
                        progress = 100;
                        clearInterval(interval);
                        progressText.textContent = '上传中...';
                        uploadFile(file, progressBar, progressText);
                    } else {
                        progressText.textContent = Math.round(progress) + '%';
                    }
                    progressBar.style.width = progress + '%';
                }, 150);
            });
        }

        async function uploadFile(file, progressBar, progressText) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('filename', file.name);

                const response = await fetch('/api/upload', { method: 'POST', body: formData });
                const data = await response.json();

                if (data.ok) {
                    progressText.textContent = '完成';
                    showToast('上传成功: ' + file.name, 'success');
                    loadFiles();
                } else {
                    progressText.textContent = '失败';
                    progressBar.classList.remove('bg-sky-400');
                    progressBar.classList.add('bg-red-500');
                    showToast('上传失败: ' + (data.message || '未知错误'), 'error');
                }
            } catch (error) {
                progressText.textContent = '失败';
                progressBar.classList.remove('bg-sky-400');
                progressBar.classList.add('bg-red-500');
                showToast('上传失败: ' + error.message, 'error');
            }
        }

        function showToast(message, type) {
            const toast = document.createElement('div');
            toast.className = 'px-4 py-3 rounded-lg shadow-lg text-sm text-white ' +
                (type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600');
            toast.textContent = message;
            toastContainer.appendChild(toast);

            setTimeout(function() {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.3s';
                setTimeout(function() { toast.remove(); }, 300);
            }, 3000);
        }

        document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

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
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json'
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
    ppt: { name: 'PPT演示', icon: '📽️' },
    pptx: { name: 'PPT演示', icon: '📽️' },
    txt: { name: '其他文件', icon: '📃' },
    jpg: { name: '图片', icon: '🖼️' },
    jpeg: { name: '图片', icon: '🖼️' },
    png: { name: '图片', icon: '🖼️' },
    gif: { name: '图片', icon: '🖼️' },
    bmp: { name: '图片', icon: '🖼️' },
    svg: { name: '图片', icon: '🖼️' },
    mp4: { name: '视频', icon: '🎬' },
    avi: { name: '视频', icon: '🎬' },
    mov: { name: '视频', icon: '🎬' },
    mp3: { name: '音频', icon: '🎵' },
    wav: { name: '音频', icon: '🎵' },
    zip: { name: '压缩包', icon: '📦' },
    rar: { name: '压缩包', icon: '📦' },
    '7z': { name: '压缩包', icon: '📦' },
    js: { name: '代码', icon: '💻' },
    html: { name: '代码', icon: '💻' },
    css: { name: '代码', icon: '💻' },
    json: { name: '代码', icon: '💻' },
  };
  return categories[ext] || { name: '其他文件', icon: '📁' };
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
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
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

async function handleDelete(filename: string, folder: string, token: string, owner: string, repo: string): Promise<Response> {
  if (!token) {
    return new Response(JSON.stringify({ ok: false, message: '请配置 GITHUB_TOKEN' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const path = `${folder}/${filename}`;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    const getResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!getResponse.ok) {
      return new Response(JSON.stringify({ ok: false, message: '文件不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const fileInfo = await getResponse.json();
    const sha = fileInfo.sha;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Delete: ${filename}`,
        sha,
        branch: 'main'
      })
    });

    if (!response.ok) {
      const data = await response.json();
      return new Response(JSON.stringify({ ok: false, message: data.message || '删除失败' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true, message: '删除成功' }), {
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
    txt: 'files/documents',
    jpg: 'files/images',
    jpeg: 'files/images',
    png: 'files/images',
    gif: 'files/images',
    bmp: 'files/images',
    svg: 'files/images',
    mp4: 'files/videos',
    avi: 'files/videos',
    mov: 'files/videos',
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
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.raw'
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
