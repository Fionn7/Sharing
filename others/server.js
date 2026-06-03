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
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// 使用内存存储
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'Fionn7';
const GITHUB_REPO = process.env.GITHUB_REPO || 'Sharing';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

// 文件类型分类函数
function getFileCategory(ext) {
  const categories = {
    pdf: { folder: 'pdfs', type: 'PDF文档', icon: '📄' },
    doc: { folder: 'documents', type: 'Word文档', icon: '📝' },
    docx: { folder: 'documents', type: 'Word文档', icon: '📝' },
    xls: { folder: 'documents', type: 'Excel表格', icon: '📊' },
    xlsx: { folder: 'documents', type: 'Excel表格', icon: '📊' },
    ppt: { folder: 'documents', type: 'PPT演示', icon: '📽️' },
    pptx: { folder: 'documents', type: 'PPT演示', icon: '📽️' },
    txt: { folder: 'documents', type: '文本文件', icon: '📃' },
    jpg: { folder: 'images', type: '图片', icon: '🖼️' },
    jpeg: { folder: 'images', type: '图片', icon: '🖼️' },
    png: { folder: 'images', type: '图片', icon: '🖼️' },
    gif: { folder: 'images', type: '图片', icon: '🖼️' },
    bmp: { folder: 'images', type: '图片', icon: '🖼️' },
    svg: { folder: 'images', type: '图片', icon: '🖼️' },
    mp4: { folder: 'videos', type: '视频', icon: '🎬' },
    avi: { folder: 'videos', type: '视频', icon: '🎬' },
    mov: { folder: 'videos', type: '视频', icon: '🎬' },
    wmv: { folder: 'videos', type: '视频', icon: '🎬' },
    mp3: { folder: 'audio', type: '音频', icon: '🎵' },
    wav: { folder: 'audio', type: '音频', icon: '🎵' },
    flac: { folder: 'audio', type: '音频', icon: '🎵' },
    zip: { folder: 'archives', type: '压缩包', icon: '📦' },
    rar: { folder: 'archives', type: '压缩包', icon: '📦' },
    '7z': { folder: 'archives', type: '压缩包', icon: '📦' },
    tar: { folder: 'archives', type: '压缩包', icon: '📦' },
    gz: { folder: 'archives', type: '压缩包', icon: '📦' },
    js: { folder: 'codes', type: '代码', icon: '💻' },
    html: { folder: 'codes', type: '代码', icon: '💻' },
    css: { folder: 'codes', type: '代码', icon: '💻' },
    json: { folder: 'codes', type: '代码', icon: '💻' },
    py: { folder: 'codes', type: '代码', icon: '💻' },
    java: { folder: 'codes', type: '代码', icon: '💻' },
    cpp: { folder: 'codes', type: '代码', icon: '💻' },
    c: { folder: 'codes', type: '代码', icon: '💻' },
    xml: { folder: 'codes', type: '代码', icon: '💻' },
  };
  
  return categories[ext] || { folder: 'others', type: '其他文件', icon: '📁' };
}

// 请求超时设置（30秒 - Render 免费版限制）
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    console.log('Request timeout');
    if (!res.headersSent) {
      res.status(408).json({ ok: false, message: '请求超时，请使用更小的文件或重试' });
    }
  });
  next();
});

app.use(express.json());
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

app.get('/health', (_, res) => {
  res.json({ ok: true, message: 'backend-ready' });
});

app.get('/api/files', async (_, res) => {
  try {
    // 支持的文件夹列表
    const folders = ['pdfs', 'documents', 'images', 'videos', 'audio', 'archives', 'codes', 'others'];
    const allFiles = [];
    
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'sharing-file-backend',
    };

    if (GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    }

    // 获取所有文件夹的文件
    for (const folder of folders) {
      try {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${folder}`;
        const response = await fetch(url, { headers });
        
        if (response.ok) {
          const data = await response.json().catch(() => []);
          if (Array.isArray(data)) {
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
        }
      } catch (error) {
        console.log(`获取 ${folder} 文件夹失败:`, error.message);
      }
    }

    return res.json({ ok: true, files: allFiles });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: '获取文件列表失败', error: error.message });
  }
});

app.delete('/api/files/:name', async (req, res) => {
  try {
    if (!GITHUB_TOKEN) {
      return res.status(500).json({ ok: false, message: '未配置 GITHUB_TOKEN' });
    }

    const rawName = decodeURIComponent(req.params.name || '');
    const safeFilename = rawName.replace(/\\/g, '_').replace(/\/+/, '_');
    // 从查询参数获取文件夹，如果没有则默认为 pdfs
    const folder = decodeURIComponent(req.query.category || 'pdfs');
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
    
    // 获取文件扩展名
    const ext = path.extname(safeFilename).toLowerCase();
    
    // 根据文件类型确定存储文件夹
    let folder = 'others'; // 默认分类
    const fileCategory = getFileCategory(ext);
    folder = fileCategory.folder;
    const fileType = fileCategory.type;
    
    console.log(`上传文件: ${safeFilename}, 类型: ${fileType}, 大小: ${(fileSize / 1024 / 1024).toFixed(2)}MB, 分类: ${folder}`);

    // 检查文件大小
    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ 
        ok: false, 
        message: `文件大小超过限制（最大 ${MAX_FILE_SIZE / 1024 / 1024}MB）` 
      });
    }

    const content = req.file.buffer.toString('base64');
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${folder}/${safeFilename}`;
    
    console.log('正在检查文件是否已存在...');
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
    } else {
      console.log('文件不存在，将创建新文件');
    }

    console.log('正在上传到 GitHub...');
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
        message: `Upload file: ${safeFilename}`,
        content,
        branch: GITHUB_BRANCH,
        sha,
      }),
    });

    const data = await response.json().catch(() => ({}));
    
    console.log('GitHub 响应状态:', response.status);
    if (!response.ok) {
      console.error('GitHub 上传失败:', data);
      
      // 提供更友好的错误消息
      let errorMessage = data.message || '上传到 GitHub 失败';
      
      if (response.status === 401) {
        errorMessage = 'GitHub Token 无效或已过期，请检查后端配置';
      } else if (response.status === 403) {
        if (data.message && data.message.includes('rate limit')) {
          errorMessage = 'GitHub API 请求次数超限，请稍后再试';
        } else {
          errorMessage = 'GitHub Token 权限不足，需要 repo 权限';
        }
      } else if (response.status === 413) {
        errorMessage = '文件太大，无法上传到 GitHub';
      }
      
      return res.status(response.status).json({
        ok: false,
        message: errorMessage,
        details: data,
      });
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
      htmlUrl: data.content?.html_url || null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: '服务器异常', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`File backend listening on http://localhost:${PORT}`);
});
