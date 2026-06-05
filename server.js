const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// 加载 .env 文件（不依赖 dotenv 包）
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
  }
}

loadEnv();

const app = express();
const PORT = Number(process.env.PORT) || 3100;

// 文件大小限制 - 50MB（Render 免费版内存和超时限制）
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// GitHub API 分块上传的块大小（最大 25MB）
const CHUNK_SIZE = 25 * 1024 * 1024;

// 使用磁盘存储替代内存存储，减少内存占用
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      cb(null, tempDir);
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname);
    }
  }),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'Fionn7';
const GITHUB_REPO = process.env.GITHUB_REPO || 'Sharing';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

// 计算文件的 SHA256
async function calculateSHA256(filePath) {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  
  return new Promise((resolve, reject) => {
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// 文件类型分类函数
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
    wmv: { folder: 'files/videos', type: '视频', icon: '🎬' },
    mp3: { folder: 'files/audio', type: '音频', icon: '🎵' },
    wav: { folder: 'files/audio', type: '音频', icon: '🎵' },
    flac: { folder: 'files/audio', type: '音频', icon: '🎵' },
    zip: { folder: 'files/archives', type: '压缩包', icon: '📦' },
    rar: { folder: 'files/archives', type: '压缩包', icon: '📦' },
    '7z': { folder: 'files/archives', type: '压缩包', icon: '📦' },
    tar: { folder: 'files/archives', type: '压缩包', icon: '📦' },
    gz: { folder: 'files/archives', type: '压缩包', icon: '📦' },
    js: { folder: 'files/codes', type: '代码', icon: '💻' },
    html: { folder: 'files/codes', type: '代码', icon: '💻' },
    css: { folder: 'files/codes', type: '代码', icon: '💻' },
    json: { folder: 'files/codes', type: '代码', icon: '💻' },
    py: { folder: 'files/codes', type: '代码', icon: '💻' },
    java: { folder: 'files/codes', type: '代码', icon: '💻' },
    cpp: { folder: 'files/codes', type: '代码', icon: '💻' },
    c: { folder: 'files/codes', type: '代码', icon: '💻' },
    xml: { folder: 'files/codes', type: '代码', icon: '💻' },
  };
  
  return categories[ext] || { folder: 'files/others', type: '其他文件', icon: '📁' };
}

// 请求超时设置（60秒）
app.use((req, res, next) => {
  res.setTimeout(120000, () => {
    console.log('Request timeout');
    if (!res.headersSent) {
      res.status(408).json({ ok: false, message: '请求超时，请使用更小的文件或重试' });
    }
  });
  next();
});

// 增加请求体大小限制
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.static(path.join(__dirname)));

app.get('/health', (req, res) => {
  console.log('收到健康检查请求');
  res.json({ ok: true, message: 'backend-ready' });
});

// 测试端点
app.get('/api/test', (req, res) => {
  console.log('收到测试请求');
  res.json({ ok: true, message: '测试成功', timestamp: Date.now() });
});

app.get('/api/files', async (req, res) => {
  try {
    console.log('收到文件列表请求');
    // 支持的文件夹列表
    const folders = ['files/pdfs', 'files/documents', 'files/images', 'files/videos', 'files/audio', 'files/archives', 'files/codes', 'files/others'];
    const allFiles = [];
    
    // 先尝试本地文件系统
    const hasLocalFiles = await checkLocalFiles(folders);
    
    if (hasLocalFiles) {
      // 使用本地文件系统
      console.log('使用本地文件系统');
      for (const folder of folders) {
        const folderPath = path.join(__dirname, folder);
        if (fs.existsSync(folderPath)) {
          try {
            const files = fs.readdirSync(folderPath);
            files.forEach(file => {
              if (!file.startsWith('.')) {
                const filePath = path.join(folderPath, file);
                const stat = fs.statSync(filePath);
                allFiles.push({
                  name: file,
                  path: `${folder}/${file}`,
                  sha: file,
                  size: stat.size,
                  last_modified: stat.mtime,
                  folder: folder,
                  type: getFileCategory(path.extname(file).toLowerCase().slice(1)).type,
                });
              }
            });
          } catch (error) {
            console.log(`读取本地文件夹 ${folder} 失败:`, error.message);
          }
        }
      }
    } else {
      // 使用GitHub API
      const headers = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'sharing-file-backend',
      };

      if (GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
        console.log('使用 GITHUB_TOKEN 认证');
      } else {
        console.log('未配置 GITHUB_TOKEN，使用匿名访问');
      }

      // 获取所有文件夹的文件
      for (const folder of folders) {
        try {
          const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${folder}`;
          console.log(`正在获取文件夹: ${folder}`);
          const response = await fetch(url, { headers });
          
          if (response.ok) {
            const data = await response.json().catch(() => []);
            if (Array.isArray(data)) {
              console.log(`文件夹 ${folder} 包含 ${data.length} 个文件`);
              // 为每个文件添加文件夹信息
              data.forEach(file => {
                if (!file.name.startsWith('.')) { // 忽略隐藏文件
                  allFiles.push({
                    ...file,
                    folder: folder
                  });
                }
              });
            }
          } else {
            console.log(`获取文件夹 ${folder} 失败，状态码: ${response.status}`);
          }
        } catch (error) {
          console.log(`获取 ${folder} 文件夹失败:`, error.message);
        }
      }
    }

    console.log(`共获取到 ${allFiles.length} 个文件`);
    return res.json({ ok: true, files: allFiles });
  } catch (error) {
    console.error('获取文件列表出错:', error);
    return res.status(500).json({ ok: false, message: '获取文件列表失败', error: error.message });
  }
});

// 检查是否存在本地文件
async function checkLocalFiles(folders) {
  for (const folder of folders) {
    const folderPath = path.join(__dirname, folder);
    if (fs.existsSync(folderPath)) {
      const files = fs.readdirSync(folderPath);
      if (files.length > 0 && !files.every(f => f.startsWith('.'))) {
        return true;
      }
    }
  }
  return false;
}

app.delete('/api/files/:name', async (req, res) => {
  try {
    if (!GITHUB_TOKEN) {
      return res.status(500).json({ ok: false, message: '未配置 GITHUB_TOKEN' });
    }

    const rawName = decodeURIComponent(req.params.name || '');
    const safeFilename = rawName.replace(/\\/g, '_').replace(/\/+/, '_');
    // 从查询参数获取文件夹，如果没有则默认为 files/others
    const folder = decodeURIComponent(req.query.category || 'files/others');
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${folder}/${safeFilename}`;

    const shaRes = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'sharing-file-backend',
      },
    });

    const shaData = await shaRes.json().catch(() => ({}));
    if (!shaRes.ok || !shaData?.sha) {
      return res.status(shaRes.status || 404).json({
        ok: false,
        message: shaData.message || '文件不存在',
      });
    }

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'sharing-file-backend',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Delete file: ${safeFilename}`,
        sha: shaData.sha,
        branch: GITHUB_BRANCH,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        message: data.message || '删除失败',
        details: data,
      });
    }

    return res.json({ ok: true, message: '删除成功', file: safeFilename });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: '删除失败', error: error.message });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('收到上传请求');
    
    if (!req.file) {
      return res.status(400).json({ ok: false, message: '请上传文件' });
    }

    if (!GITHUB_TOKEN) {
      return res.status(500).json({ ok: false, message: '未配置 GITHUB_TOKEN' });
    }

    const filename = req.body.filename || req.file.originalname;
    const safeFilename = filename.replace(/\/+/, '_').replace(/\\/g, '_');
    const fileSize = req.file.size;
    
    // 获取文件扩展名（去掉点）
    const ext = path.extname(safeFilename).toLowerCase().slice(1);
    
    // 根据文件类型确定存储文件夹
    let folder = 'files/others'; // 默认分类
    const fileCategory = getFileCategory(ext);
    folder = fileCategory.folder;
    const fileType = fileCategory.type;
    
    console.log(`上传文件: ${safeFilename}, 类型: ${fileType}, 大小: ${(fileSize / 1024 / 1024).toFixed(2)}MB, 分类: ${folder}`);

    // 检查文件大小
    if (fileSize > MAX_FILE_SIZE) {
      // 清理临时文件
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        ok: false, 
        message: `文件大小超过限制（最大 ${MAX_FILE_SIZE / 1024 / 1024}MB）` 
      });
    }

    let uploadResult;
    
    // 根据文件大小选择上传方式
    if (fileSize > 20 * 1024 * 1024) {
      // 大文件使用流式分块上传
      console.log('使用流式分块上传...');
      uploadResult = await uploadFileInChunks(req.file.path, folder, safeFilename, fileSize);
    } else {
      // 小文件使用普通方式
      console.log('使用普通上传...');
      uploadResult = await uploadSmallFile(req.file.path, folder, safeFilename);
    }
    
    // 清理临时文件
    fs.unlink(req.file.path, (err) => {
      if (err) console.warn('删除临时文件失败:', err);
    });
    
    if (!uploadResult.ok) {
      return res.status(500).json({ ok: false, message: uploadResult.message });
    }

    console.log('上传成功!');
    return res.json({
      ok: true,
      message: '上传成功',
      file: safeFilename,
      size: fileSize,
      category: folder,
      fileType: fileType,
      fileIcon: fileCategory.icon,
      downloadUrl: `https://${GITHUB_OWNER}.github.io/${GITHUB_REPO}/${folder}/${safeFilename}`,
    });
  } catch (error) {
    console.error('上传失败:', error);
    // 清理临时文件
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.warn('删除临时文件失败:', err);
      });
    }
    return res.status(500).json({ ok: false, message: '服务器异常', error: error.message });
  }
});

// 上传小文件（< 20MB）
async function uploadSmallFile(filePath, folder, filename) {
  try {
    // 读取文件内容
    const fileContent = await fs.promises.readFile(filePath);
    const content = fileContent.toString('base64');
    
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${folder}/${filename}`;
    
    // 检查文件是否已存在
    const shaRes = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'sharing-file-backend',
      },
    });

    let sha = null;
    if (shaRes.ok) {
      const existing = await shaRes.json();
      sha = existing.sha;
      console.log('文件已存在，SHA:', sha);
    }

    // 上传文件
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'sharing-file-backend',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Upload file: ${filename}`,
        content,
        branch: GITHUB_BRANCH,
        sha,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { ok: false, message: data.message || '上传失败' };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

// 分块上传大文件（使用 GitHub Git Blob API）
async function uploadFileInChunks(filePath, folder, filename, fileSize) {
  try {
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'sharing-file-backend',
      'Content-Type': 'application/json',
    };

    console.log('使用 Git Blob API 上传大文件...');

    // 1. 读取文件内容并创建 base64
    console.log('读取文件内容...');
    const fileContent = await fs.promises.readFile(filePath);
    const content = fileContent.toString('base64');

    // 2. 创建 Git Blob
    console.log('创建 Git Blob...');
    const blobUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs`;
    const blobResponse = await fetch(blobUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content: content,
        encoding: 'base64',
      }),
    });

    if (!blobResponse.ok) {
      const blobData = await blobResponse.json().catch(() => ({}));
      return { ok: false, message: `创建 Blob 失败: ${blobData.message || blobResponse.status}` };
    }

    const blobData = await blobResponse.json();
    console.log('Blob 创建成功:', blobData.sha);

    // 3. 获取当前分支的 SHA
    console.log('获取当前分支 SHA...');
    const branchUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${GITHUB_BRANCH}`;
    const branchResponse = await fetch(branchUrl, { headers });

    if (!branchResponse.ok) {
      return { ok: false, message: '获取分支信息失败' };
    }

    const branchData = await branchResponse.json();
    const currentTreeSha = branchData.object.sha;

    // 4. 获取当前树
    console.log('获取当前树...');
    const treeUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${currentTreeSha}?recursive=1`;
    const treeResponse = await fetch(treeUrl, { headers });

    if (!treeResponse.ok) {
      return { ok: false, message: '获取树信息失败' };
    }

    const treeData = await treeResponse.json();
    const folderPath = folder.replace(/^files\//, '');

    // 5. 创建新的树节点
    console.log('创建新的树节点...');
    const newTreeItem = {
      path: `${folderPath}/${filename}`,
      mode: '100644',
      type: 'blob',
      sha: blobData.sha,
    };

    // 检查文件是否已存在
    const existingItem = treeData.tree.find(item => item.path === `${folderPath}/${filename}`);
    const newTree = existingItem
      ? treeData.tree.map(item => item.path === `${folderPath}/${filename}` ? newTreeItem : item)
      : [...treeData.tree, newTreeItem];

    // 6. 创建新的树
    console.log('创建新的树...');
    const createTreeUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees`;
    const createTreeResponse = await fetch(createTreeUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        base_tree: currentTreeSha,
        tree: newTree,
      }),
    });

    if (!createTreeResponse.ok) {
      const createTreeData = await createTreeResponse.json().catch(() => ({}));
      return { ok: false, message: `创建树失败: ${createTreeData.message || createTreeResponse.status}` };
    }

    const newTreeData = await createTreeResponse.json();
    console.log('新树创建成功:', newTreeData.sha);

    // 7. 创建新的提交
    console.log('创建新的提交...');
    const commitUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits`;
    const commitResponse = await fetch(commitUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: `Upload file: ${filename}`,
        tree: newTreeData.sha,
        parents: [currentTreeSha],
      }),
    });

    if (!commitResponse.ok) {
      const commitData = await commitResponse.json().catch(() => ({}));
      return { ok: false, message: `创建提交失败: ${commitData.message || commitResponse.status}` };
    }

    const commitData = await commitResponse.json();
    console.log('提交创建成功:', commitData.sha);

    // 8. 更新分支引用
    console.log('更新分支引用...');
    const updateRefUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${GITHUB_BRANCH}`;
    const updateRefResponse = await fetch(updateRefUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sha: commitData.sha,
      }),
    });

    if (!updateRefResponse.ok) {
      const updateRefData = await updateRefResponse.json().catch(() => ({}));
      return { ok: false, message: `更新分支失败: ${updateRefData.message || updateRefResponse.status}` };
    }

    console.log('大文件上传成功!');
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

app.listen(PORT, () => {
  console.log(`File backend listening on http://localhost:${PORT}`);
});
