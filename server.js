const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = Number(process.env.PORT) || 3100;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },
});

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'Fionn7';
const GITHUB_REPO = process.env.GITHUB_REPO || 'Sharing';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

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
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/pdfs`;
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'sharing-pdf-backend',
    };

    if (GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    }

    const response = await fetch(url, { headers });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        message: data.message || '获取 PDF 列表失败',
        details: data,
      });
    }

    const files = Array.isArray(data) ? data.filter((item) => item?.name?.toLowerCase().endsWith('.pdf')) : [];
    return res.json({ ok: true, files });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: '获取 PDF 列表失败', error: error.message });
  }
});

app.delete('/api/files/:name', async (req, res) => {
  try {
    if (!GITHUB_TOKEN) {
      return res.status(500).json({ ok: false, message: '未配置 GITHUB_TOKEN' });
    }

    const rawName = decodeURIComponent(req.params.name || '');
    const safeFilename = rawName.replace(/\\/g, '_').replace(/\/+/, '_');
    const folder = 'pdfs';
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${folder}/${safeFilename}`;

    const shaRes = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'sharing-pdf-backend',
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
        'User-Agent': 'sharing-pdf-backend',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Delete PDF: ${safeFilename}`,
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

app.post('/api/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: '请上传 PDF 文件' });
    }

    if (!req.file.mimetype || !req.file.mimetype.includes('pdf')) {
      return res.status(400).json({ ok: false, message: '只能上传 PDF 文件' });
    }

    if (!GITHUB_TOKEN) {
      return res.status(500).json({ ok: false, message: '未配置 GITHUB_TOKEN' });
    }

    const filename = req.body.filename || req.file.originalname;
    const safeFilename = filename.replace(/\/+/, '_').replace(/\\/g, '_');
    const folder = 'pdfs';
    const content = req.file.buffer.toString('base64');

    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${folder}/${safeFilename}`;
    const shaRes = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'sharing-pdf-backend',
      },
    });

    let sha = null;
    if (shaRes.ok) {
      const existing = await shaRes.json();
      sha = existing.sha;
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'sharing-pdf-backend',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Upload PDF: ${safeFilename}`,
        content,
        branch: GITHUB_BRANCH,
        sha,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        message: data.message || '上传到 GitHub 失败',
        details: data,
      });
    }

    return res.json({
      ok: true,
      message: '上传成功',
      file: safeFilename,
      downloadUrl: `https://${GITHUB_OWNER}.github.io/${GITHUB_REPO}/${folder}/${safeFilename}`,
      htmlUrl: data.content?.html_url || null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: '服务器异常', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`PDF backend listening on http://localhost:${PORT}`);
});
