import htmlContent from './index.html';

interface Env {
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
};

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
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
      // 测试 GitHub API 连接
      let githubStatus = 'unknown';
      let fileCount = 0;
      if (githubToken) {
        try {
          const testUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/files`;
          const testResp = await fetch(testUrl, {
            headers: {
              'Authorization': `Bearer ${githubToken}`,
              'Accept': 'application/vnd.github+json'
            }
          });
          githubStatus = `${testResp.status} ${testResp.statusText}`;
          if (testResp.ok) {
            const data = await testResp.json();
            if (Array.isArray(data)) {
              fileCount = data.length;
            }
          }
        } catch (e) {
          githubStatus = `error: ${e instanceof Error ? e.message : 'unknown'}`;
        }
      }
      return jsonResponse({
        ok: true,
        tokenConfigured: !!githubToken,
        owner: githubOwner,
        repo: githubRepo,
        githubStatus,
        filesInRoot: fileCount
      });
    }

    return new Response('404 Not Found', { status: 404, headers: corsHeaders });
  }
};

function handleHome(): Response {
  return new Response(htmlContent, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8', ...corsHeaders }
  });
}

async function handleGetFiles(token: string, owner: string, repo: string): Promise<Response> {
  if (!token) {
    return jsonResponse({ ok: false, message: '请配置 GITHUB_TOKEN（使用 wrangler secret put GITHUB_TOKEN）', files: [], count: 0 }, 500);
  }

  try {
    const files = await fetchGitHubFiles(token, owner, repo);
    if (files.length === 0) {
      return jsonResponse({ 
        ok: true, 
        files: [], 
        count: 0, 
        message: '未找到文件，请检查 GitHub 仓库是否有 files 目录',
        debug: { owner, repo }
      });
    }
    return jsonResponse({ ok: true, files, count: files.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ ok: false, message, files: [], count: 0 }, 500);
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

    if (!response.ok) {
      console.error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
      return;
    }

    const items = await response.json();
    if (!Array.isArray(items)) {
      console.error(`Unexpected response for ${path}:`, items);
      return;
    }

    for (const item of items) {
      if (item.type === 'dir') {
        await traverse(item.path);
      } else if (item.type === 'file') {
        const ext = item.name.split('.').pop()?.toLowerCase() || '';
        const category = getCategory(ext);
        files.push({
          name: item.name,
          path: item.path,
          folder: item.path.substring(0, item.path.lastIndexOf('/')),
          size: item.size,
          type: category.name,
          icon: category.icon,
          last_modified: item.updated_at || item.sha
        });
      }
    }
  }

  await traverse('files');
  console.log(`Found ${files.length} files`);
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
    return jsonResponse({ ok: false, message: '请配置 GITHUB_TOKEN' }, 500);
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const filename = formData.get('filename') || (file as File).name;

    if (!file) {
      return jsonResponse({ ok: false, message: '请选择文件' }, 400);
    }

    const ext = filename.toString().split('.').pop()?.toLowerCase() || '';
    const folder = getFolder(ext);
    const path = `${folder}/${filename}`;

    const arrayBuffer = await (file as File).arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const content = btoa(binary);

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
      return jsonResponse({ ok: false, message: data.message || '上传失败' }, response.status);
    }

    return jsonResponse({ ok: true, message: '上传成功', filename, folder });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ ok: false, message }, 500);
  }
}

async function handleDelete(filename: string, folder: string, token: string, owner: string, repo: string): Promise<Response> {
  if (!token) {
    return jsonResponse({ ok: false, message: '请配置 GITHUB_TOKEN' }, 500);
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
      return jsonResponse({ ok: false, message: '文件不存在' }, 404);
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
      return jsonResponse({ ok: false, message: data.message || '删除失败' }, response.status);
    }

    return jsonResponse({ ok: true, message: '删除成功' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ ok: false, message }, 500);
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
    return jsonResponse({ ok: false, message: '请配置 GITHUB_TOKEN' }, 500);
  }

  try {
    // path 已经包含完整路径，如 files/documents/report.docx
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.raw'
      }
    });

    if (!response.ok) {
      return jsonResponse({ ok: false, message: '文件不存在' }, 404);
    }

    const filename = path.split('/').pop() || 'download';
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return new Response(response.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        ...corsHeaders
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ ok: false, message }, 500);
  }
}
