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
    <style type="text/tailwindcss">
        @layer utilities {
            .content-auto {
                content-visibility: auto;
            }
            .glass {
                background: rgba(255, 255, 255, 0.15);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            .glass-light {
                background: rgba(255, 255, 255, 0.25);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                border: 1px solid rgba(255, 255, 255, 0.3);
            }
            .gradient-text {
            background: linear-gradient(90deg, #f8fafc);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            }
            .gradient-bg {
                background: linear-gradient(135deg, #00643e27);
            }
            .scroll-reveal {
                opacity: 0;
                transform: translateY(20px);
                transition: all 0.6s ease-out;
            }
            .scroll-reveal.active {
            opacity: 1;
            transform: translateY(0);
            }
        }
        .category-btn {
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .category-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            color: white;
        }
        .category-btn.active {
            background: rgba(14, 165, 233, 0.3);
            color: white;
            border-color: rgba(14, 165, 233, 0.5);
        }
    </style>
</head>
<body class="font-inter text-white overflow-x-hidden">
    <div class="fixed inset-0 -z-10">
        <img src="https://www.nnu.edu.cn/__local/8/34/A4/3A386A880E332A4E876F05144E0_A2A61260_73305.jpg" alt="南京师范大学四季风景" class="w-full h-full object-cover">
        <div class="absolute inset-0 bg-slate-900/50"></div>
    </div>

    <nav id="navbar" class="fixed w-full z-50 transition-all duration-300 py-4">
        <div class="container mx-auto px-6">
            <div class="glass rounded-full px-6 py-3 flex justify-between items-center">
                <div class="flex items-center space-x-2">

                    <span class="text-2xl font-bold gradient-text">Sharing</span>
                </div>
                
                <div class="hidden md:flex items-center space-x-8">
                    <a href="#files" class="text-white/80 hover:text-white transition-colors text-sm">文件库</a>
                    <a href="#upload" class="text-white/80 hover:text-white transition-colors text-sm">上传</a>
                </div>
                

            </div>
        </div>
    </nav>

    <section id="upload" class="min-h-screen flex items-center pt-24">
        <div class="container mx-auto px-6">
            <div class="max-w-3xl mx-auto text-center">
                <div class="glass rounded-3xl p-10 md:p-16 scroll-reveal">
                    <div class="w-20 h-20 mx-auto mb-8 bg-white/10 rounded-full flex items-center justify-center">
                        <i class="fa fa-cloud-upload text-3xl text-white/70"></i>
                    </div>
                    <h1 class="text-[clamp(2rem,4vw,3rem)] font-bold mb-4">
                        拖拽文件到这里上传
                    </h1>
                    <p class="text-white/70 text-lg mb-6">
                        文件将自动分类存储到共享库
                    </p>
                    <div id="upload-area" class="glass-light rounded-2xl p-12 hover:bg-white/30 transition-colors cursor-pointer group">
                        <div class="w-16 h-16 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                            <i class="fa fa-cloud-upload text-3xl text-white/70 group-hover:text-primary transition-colors"></i>
                        </div>
                        <p class="text-white/80">释放文件以上传</p>
                    </div>
                    <input type="file" id="file-input" class="hidden" multiple>
                    
                    <div id="upload-list" class="mt-8 space-y-3 hidden">
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section id="files" class="py-20">
        <div class="container mx-auto px-6">
            <div class="text-center mb-12 scroll-reveal">
                <div class="glass inline-block rounded-full px-6 py-2 text-sm">
                    <h2 class="text-xl font-bold">文件库</h2>
                </div>
            </div>
            
            <div class="max-w-4xl mx-auto scroll-reveal">
                <div class="glass rounded-2xl overflow-hidden">
                    <div class="p-6">
                        <!-- 分类过滤器 -->
                        <div class="flex flex-wrap gap-2 mb-6" id="categoryFilters">
                            <button class="category-btn active px-4 py-2 rounded-lg text-sm transition-colors" data-category="all">
                                全部
                            </button>
                            <button class="category-btn px-4 py-2 rounded-lg text-sm transition-colors" data-category="PDF文档">
                                📄 PDF
                            </button>
                            <button class="category-btn px-4 py-2 rounded-lg text-sm transition-colors" data-category="Word文档">
                                📝 Word
                            </button>
                            <button class="category-btn px-4 py-2 rounded-lg text-sm transition-colors" data-category="Excel表格">
                                📊 Excel
                            </button>
                            <button class="category-btn px-4 py-2 rounded-lg text-sm transition-colors" data-category="PPT演示">
                                📽️ PPT
                            </button>
                            <button class="category-btn px-4 py-2 rounded-lg text-sm transition-colors" data-category="图片">
                                🖼️ 图片
                            </button>
                            <button class="category-btn px-4 py-2 rounded-lg text-sm transition-colors" data-category="视频">
                                🎬 视频
                            </button>
                            <button class="category-btn px-4 py-2 rounded-lg text-sm transition-colors" data-category="音频">
                                🎵 音频
                            </button>
                            <button class="category-btn px-4 py-2 rounded-lg text-sm transition-colors" data-category="压缩包">
                                📦 压缩包
                            </button>
                            <button class="category-btn px-4 py-2 rounded-lg text-sm transition-colors" data-category="代码">
                                💻 代码
                            </button>
                            <button class="category-btn px-4 py-2 rounded-lg text-sm transition-colors" data-category="其他文件">
                                📁 其他
                            </button>
                        </div>
                        
                        <div class="space-y-2" id="fileList">
                            <div class="flex items-center p-3 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
                                <div class="w-10 h-10 bg-red-100/10 rounded-lg flex items-center justify-center mr-4">
                                    <i class="fa fa-file-pdf-o text-red-400"></i>
                                </div>
                                <div class="flex-1">
                                    <div class="text-sm">加载中...</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <footer class="py-12">
        <div class="container mx-auto px-6">
            <div class="glass rounded-2xl p-8">
                <div class="flex flex-col md:flex-row justify-between items-center">
                    <div class="flex items-center space-x-2 mb-4 md:mb-0">

                        <span class="text-2xl font-bold gradient-text">Sharing</span>
                    </div>
                    
                    <div class="text-white/70 text-sm text-center md:text-right">
                        <p>© 2026 Sharing. 仅供内部使用</p>
                    </div>
                </div>
            </div>
        </div>
    </footer>

    <script>
        window.addEventListener('scroll', function() {
            const navbar = document.getElementById('navbar');
            if (window.scrollY > 50) {
                navbar.classList.add('py-2');
                navbar.classList.remove('py-4');
            } else {
                navbar.classList.add('py-4');
                navbar.classList.remove('py-2');
            }
        });

        const scrollRevealElements = document.querySelectorAll('.scroll-reveal');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                }
            });
        }, { threshold: 0.1 });

        scrollRevealElements.forEach(el => observer.observe(el));

        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        const uploadList = document.getElementById('upload-list');
        const fileList = document.getElementById('fileList');

        uploadArea.addEventListener('click', () => fileInput.click());

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('border-primary');
            uploadArea.classList.add('bg-primary/10');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('border-primary');
            uploadArea.classList.remove('bg-primary/10');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('border-primary');
            uploadArea.classList.remove('bg-primary/10');
            if (e.dataTransfer.files.length > 0) {
                handleFiles(e.dataTransfer.files);
            }
        });

        fileInput.addEventListener('change', () => {
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
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        function getFileIconClass(filename) {
            const ext = filename.split('.').pop().toLowerCase();
            if (['pdf'].includes(ext)) return 'text-red-400';
            if (['doc', 'docx'].includes(ext)) return 'text-blue-400';
            if (['xls', 'xlsx'].includes(ext)) return 'text-green-400';
            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'text-purple-400';
            if (['mp4', 'avi', 'mov', 'wmv'].includes(ext)) return 'text-yellow-400';
            if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'text-orange-400';
            if (['mp3', 'wav', 'flac'].includes(ext)) return 'text-pink-400';
            return 'text-gray-400';
        }

        function getFileIcon(filename) {
            const ext = filename.split('.').pop().toLowerCase();
            if (['pdf'].includes(ext)) return 'fa-file-pdf-o';
            if (['doc', 'docx'].includes(ext)) return 'fa-file-word-o';
            if (['xls', 'xlsx'].includes(ext)) return 'fa-file-excel-o';
            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'fa-file-image-o';
            if (['mp4', 'avi', 'mov', 'wmv'].includes(ext)) return 'fa-file-video-o';
            if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'fa-file-archive-o';
            if (['mp3', 'wav', 'flac'].includes(ext)) return 'fa-file-audio-o';
            return 'fa-file-o';
        }

        async function loadFiles() {
            try {
                const response = await fetch('/api/files');
                const data = await response.json();
                if (data.ok && data.files) {
                    displayFiles(data.files);
                } else {
                    const errorMsg = data.message || '无法获取文件列表';
                    fileList.innerHTML = ``<div class="flex items-center p-3 rounded-lg"><div class="flex-1 text-center text-sm text-white/70">`${errorMsg}</div></div>``;
                    console.log('API响应:', data);
                }
            } catch (error) {
                console.error('加载文件失败:', error);
                fileList.innerHTML = '<div class="flex items-center p-3 rounded-lg"><div class="flex-1 text-center text-sm text-white/70">加载失败，请检查网络连接或后端服务</div></div>';
            }
        }

        let currentCategory = 'all';
        let allFilesData = [];

        function displayFiles(files) {
            allFilesData = files;
            filterFilesByCategory();
        }

        function filterFilesByCategory() {
            const filteredFiles = currentCategory === 'all' 
                ? allFilesData 
                : allFilesData.filter(file => file.type === currentCategory);
            
            if (filteredFiles.length === 0) {
                fileList.innerHTML = '<div class="flex items-center p-3 rounded-lg"><div class="flex-1 text-center text-sm text-white/70">暂无文件</div></div>';
                return;
            }

            fileList.innerHTML = filteredFiles.map(file => {
                const iconClass = getFileIconClass(file.name);
                const icon = getFileIcon(file.name);
                return ``
                    <div class="flex items-center p-3 rounded-lg hover:bg-white/10 transition-colors cursor-pointer group" onclick="downloadFile('`${escapeHTML(file.name)}', '`${escapeHTML(file.folder)}')">
                        <div class="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center mr-4">
                            <i class="fa `${icon} `${iconClass}"></i>
                        </div>
                        <div class="flex-1">
                            <div class="text-sm">`${escapeHTML(file.name)}</div>
                        </div>
                        <div class="text-xs text-white/50">`${formatFileSize(file.size)}</div>
                        <div class="text-xs text-white/50 ml-4">`${file.last_modified ? new Date(file.last_modified).toLocaleDateString('zh-CN') : '--'}</div>
                        <button class="ml-4 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 p-2" onclick="event.stopPropagation(); deleteFile('`${escapeHTML(file.name)}', '`${escapeHTML(file.folder)}')">
                            <i class="fa fa-trash"></i>
                        </button>
                    </div>
                ``;
            }).join('');
        }

        // 分类过滤器事件监听
        document.getElementById('categoryFilters').addEventListener('click', function(e) {
            const btn = e.target.closest('.category-btn');
            if (btn) {
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCategory = btn.dataset.category;
                filterFilesByCategory();
            }
        });

        function downloadFile(filename, folder) {
            const url = ``https://raw.githubusercontent.com/Fionn7/Sharing/main/`${folder}/`${encodeURIComponent(filename)}``;
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast(``开始下载: `${filename}``, 'success');
        }

        async function deleteFile(filename, folder) {
            if (!confirm(``确定要删除文件 "`${filename}" 吗？``)) {
                return;
            }

            try {
                const response = await fetch(``/api/files/`${encodeURIComponent(filename)}?category=`${encodeURIComponent(folder)}``, {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                
                if (data.ok) {
                    showToast(``删除成功: `${filename}``, 'success');
                    loadFiles();
                } else {
                    showToast(``删除失败: `${data.message}``, 'error');
                }
            } catch (error) {
                console.error('删除文件失败:', error);
                showToast('删除失败，请稍后重试', 'error');
            }
        }

        function handleFiles(files) {
            uploadList.classList.remove('hidden');
            
            Array.from(files).forEach(file => {
                const uploadItem = document.createElement('div');
                uploadItem.className = 'glass flex items-center p-4 rounded-lg';
                uploadItem.innerHTML = ``
                    <div class="w-10 h-10 bg-blue-100/20 rounded-lg flex items-center justify-center mr-4">
                        <i class="fa `${getFileIcon(file.name)} `${getFileIconClass(file.name)}"></i>
                    </div>
                    <div class="flex-1">
                        <div class="font-medium text-sm">`${escapeHTML(file.name)}</div>
                        <div class="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-2">
                            <div class="progress-bar h-full gradient-bg w-0 transition-all duration-300"></div>
                        </div>
                    </div>
                    <div class="text-sm text-white/70 ml-4 progress-text">0%</div>
                ``;
                uploadList.appendChild(uploadItem);
                
                const progressBar = uploadItem.querySelector('.progress-bar');
                const progressText = uploadItem.querySelector('.progress-text');
                let progress = 0;
                
                const interval = setInterval(() => {
                    progress += Math.random() * 15;
                    if (progress >= 100) {
                        progress = 100;
                        clearInterval(interval);
                        progressText.textContent = '上传中...';
                        uploadFile(file, progressBar, progressText);
                    } else {
                        progressText.textContent = Math.round(progress) + '%';
                    }
                    progressBar.style.width = progress + '%';
                }, 200);
            });
        }

        async function uploadFile(file, progressBar, progressText) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('filename', file.name);
                
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.ok) {
                    progressText.textContent = '完成';
                    showToast(``上传成功: `${file.name}``, 'success');
                    loadFiles();
                } else {
                    progressText.textContent = '失败';
                    progressBar.classList.remove('gradient-bg');
                    progressBar.classList.add('bg-red-500');
                    showToast(``上传失败: `${data.message}``, 'error');
                }
            } catch (error) {
                progressText.textContent = '失败';
                progressBar.classList.remove('gradient-bg');
                progressBar.classList.add('bg-red-500');
                showToast('上传失败，请稍后重试', 'error');
            }
        }

        function showToast(message, type = 'info') {
            const toast = document.createElement('div');
            toast.className = ``fixed top-20 right-6 px-4 py-3 rounded-lg shadow-lg z-50 `${
                type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'
            }``;
            toast.textContent = message;
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.3s';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelector(this.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
            });
        });

        document.addEventListener('DOMContentLoaded', loadFiles);
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
