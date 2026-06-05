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

function getGitHubHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'Sharing-App/1.0'
  };
}

function getUploadHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'Sharing-App/1.0'
  };
}

// 创建或获取默认 release
async function getOrCreateRelease(token: string, owner: string, repo: string): Promise<{ tag: string; id: number }> {
  const tag = 'files';
  
  // 检查是否已存在
  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`, {
    headers: getGitHubHeaders(token)
  });
  
  if (resp.ok) {
    const release = await resp.json();
    return { tag, id: release.id };
  }
  
  // 创建新 release
  const createResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
    method: 'POST',
    headers: {
      ...getGitHubHeaders(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tag_name: tag,
      name: 'Files Storage',
      description: 'Large file storage for sharing',
      draft: false,
      prerelease: false
    })
  });
  
  if (!createResp.ok) {
    const err = await createResp.json();
    throw new Error(`创建 release 失败: ${err.message}`);
  }
  
  const newRelease = await createResp.json();
  return { tag, id: newRelease.id };
}

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
      let rawResponse: any = null;
      let traverseLog: string[] = [];
      let tokenInfo: any = {};
      
      if (githubToken) {
        try {
          // 测试 token 有效性 - 获取当前用户
          const userResp = await fetch('https://api.github.com/user', {
            headers: getGitHubHeaders(githubToken)
          });
          tokenInfo.userStatus = `${userResp.status} ${userResp.statusText}`;
          if (userResp.ok) {
            const userData = await userResp.json();
            tokenInfo.user = userData.login;
          }
          
          // 测试仓库访问
          const repoResp = await fetch(`https://api.github.com/repos/${githubOwner}/${githubRepo}`, {
            headers: getGitHubHeaders(githubToken)
          });
          tokenInfo.repoStatus = `${repoResp.status} ${repoResp.statusText}`;
          
          // 测试 files 目录
          const testUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/files`;
          const testResp = await fetch(testUrl, {
            headers: getGitHubHeaders(githubToken)
          });
          githubStatus = `${testResp.status} ${testResp.statusText}`;
          
          if (testResp.ok) {
            const data = await testResp.json();
            rawResponse = data;
            
            if (Array.isArray(data)) {
              traverseLog.push(`files/ 目录包含 ${data.length} 个项目`);
              for (const item of data) {
                traverseLog.push(`  - ${item.name} (${item.type})`);
              }
            }
          } else {
            const errorText = await testResp.text();
            traverseLog.push(`Error: ${errorText}`);
          }
        } catch (e) {
          githubStatus = `error: ${e instanceof Error ? e.message : 'unknown'}`;
        }
      }
      
      return jsonResponse({
        ok: true,
        tokenConfigured: !!githubToken,
        tokenPrefix: githubToken ? githubToken.substring(0, 10) + '...' : null,
        owner: githubOwner,
        repo: githubRepo,
        tokenInfo,
        githubStatus,
        rawResponse,
        traverseLog
      });
    }
    
    // 上传调试端点
    if (pathname === '/api/upload-debug' && method === 'POST') {
      try {
        const contentLength = request.headers.get('content-length');
        console.log(`Upload debug: content-length=${contentLength}`);
        return jsonResponse({ 
          ok: true, 
          message: 'Upload debug endpoint',
          contentLength 
        });
      } catch (e) {
        return jsonResponse({ ok: false, message: e instanceof Error ? e.message : 'error' }, 500);
      }
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
    return jsonResponse({ ok: true, files, count: files.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ ok: false, message, files: [], count: 0 }, 500);
  }
}

async function fetchGitHubFiles(token: string, owner: string, repo: string): Promise<any[]> {
  const files: any[] = [];
  const visitedPaths: string[] = [];

  async function traverse(path: string): Promise<void> {
    if (visitedPaths.includes(path)) return; // 防止重复遍历
    visitedPaths.push(path);

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url, {
      headers: getGitHubHeaders(token)
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${path}: ${response.status}`);
      return;
    }

    const items = await response.json();
    
    // 如果返回的是单个文件对象（不是数组），说明路径指向文件
    if (!Array.isArray(items)) {
      if (items.type === 'file') {
        const ext = items.name.split('.').pop()?.toLowerCase() || '';
        const category = getCategory(ext);
        files.push({
          name: items.name,
          path: items.path,
          folder: items.path.substring(0, items.path.lastIndexOf('/')),
          size: items.size,
          type: category.name,
          icon: category.icon,
          last_modified: items.updated_at || items.sha
        });
      }
      return;
    }

    // 遍历目录内容
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
          last_modified: item.updated_at || item.sha,
          isLargeFile: false
        });
      }
    }
  }

  await traverse('files');

  // 从 Releases API 读取大文件
  async function loadReleaseFiles(): Promise<void> {
    try {
      // 获取 release
      let releaseResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/files`, {
        headers: getGitHubHeaders(token)
      });
      
      if (!releaseResp.ok) {
        releaseResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
          headers: getGitHubHeaders(token)
        });
      }
      
      if (!releaseResp.ok) return;
      
      const release = await releaseResp.json();
      
      // 获取 assets
      const assetsResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${release.id}/assets`, {
        headers: getGitHubHeaders(token)
      });
      
      if (!assetsResp.ok) return;
      
      const assets = await assetsResp.json();
      
      for (const asset of assets) {
        // 过滤无日期文件
        if (!asset.updated_at && !asset.created_at) continue;
        
        const ext = asset.name.split('.').pop()?.toLowerCase() || '';
        const category = getCategory(ext);
        const folder = getFolder(ext);
        
        files.push({
          name: asset.name,
          path: `release/${asset.id}`,
          folder,
          size: asset.size,
          type: category.name,
          icon: category.icon,
          last_modified: asset.updated_at || asset.created_at,
          isLargeFile: asset.size > 10 * 1024 * 1024, // >10MB显示大文件标签
          downloadUrl: asset.browser_download_url
        });
      }
    } catch (e) {
      console.error('Failed to load release files:', e);
    }
  }

  await loadReleaseFiles();

  // 按修改时间倒序排列
  return files.sort((a, b) => {
    const dateA = a.last_modified;
    const dateB = b.last_modified;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateB.localeCompare(dateA);
  });
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
    console.log('Upload request received');
    const formData = await request.formData();
    console.log('FormData parsed');
    
    const file = formData.get('file') as File;
    const filename = formData.get('filename')?.toString() || file?.name || 'unknown';

    if (!file) {
      return jsonResponse({ ok: false, message: '请选择文件' }, 400);
    }

    console.log(`Uploading: ${filename}, size: ${file.size}`);
    
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const folder = getFolder(ext);

    // 获取或创建 release
    const release = await getOrCreateRelease(token, owner, repo);
    
    // 检查是否已存在同名 asset
    const assetsResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${release.id}/assets`, {
      headers: getGitHubHeaders(token)
    });
    
    let existingAssetId: number | undefined;
    if (assetsResp.ok) {
      const assets = await assetsResp.json();
      const existing = assets.find((a: any) => a.name === filename);
      if (existing) existingAssetId = existing.id;
    }

    // 如果已存在，先删除
    if (existingAssetId) {
      await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${existingAssetId}`, {
        method: 'DELETE',
        headers: getGitHubHeaders(token)
      });
    }

    // 上传新 asset
    const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(filename)}`;
    
    // 直接从 file 读取二进制
    const binaryContent = await file.arrayBuffer();

    console.log('Sending to GitHub releases...');
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        ...getUploadHeaders(token),
        'Content-Type': 'application/octet-stream'
      },
      body: binaryContent
    });
    console.log(`GitHub response: ${response.status}`);

    if (!response.ok) {
      const data = await response.json();
      return jsonResponse({ ok: false, message: data.message || '上传失败' }, response.status);
    }

    const asset = await response.json();
    
    return jsonResponse({ 
      ok: true, 
      message: '上传成功', 
      filename, 
      folder,
      isLargeFile: true,
      downloadUrl: asset.browser_download_url
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Upload error:', message);
    return jsonResponse({ ok: false, message }, 500);
  }
}

async function handleDelete(filename: string, folder: string, token: string, owner: string, repo: string): Promise<Response> {
  if (!token) {
    return jsonResponse({ ok: false, message: '请配置 GITHUB_TOKEN' }, 500);
  }

  try {
    // 检查是否是大文件（特殊路径格式 release/{id}）
    if (filename.startsWith('release/')) {
      const assetId = filename.substring('release/'.length);
      
      const deleteResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${assetId}`, {
        method: 'DELETE',
        headers: getGitHubHeaders(token)
      });
      
      if (!deleteResp.ok) {
        const data = await deleteResp.json();
        return jsonResponse({ ok: false, message: data.message || '删除失败' }, deleteResp.status);
      }
      
      return jsonResponse({ ok: true, message: '删除成功' });
    }

    // 小文件：从 Contents API 删除
    const path = `${folder}/${filename}`;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    const getResponse = await fetch(url, { headers: getGitHubHeaders(token) });
    if (!getResponse.ok) {
      return jsonResponse({ ok: false, message: '文件不存在' }, 404);
    }

    const fileInfo = await getResponse.json();
    const sha = fileInfo.sha;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...getGitHubHeaders(token),
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
    // 检查是否是大文件（特殊路径格式 release/{id}）
    if (path.startsWith('release/')) {
      const assetId = path.substring('release/'.length);
      
      // 先找到对应的 asset 信息
      let releaseResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/files`, {
        headers: getGitHubHeaders(token)
      });
      
      if (!releaseResp.ok) {
        releaseResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
          headers: getGitHubHeaders(token)
        });
      }
      
      if (releaseResp.ok) {
        const release = await releaseResp.json();
        const assetsResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${release.id}/assets`, {
          headers: getGitHubHeaders(token)
        });
        
        if (assetsResp.ok) {
          const assets = await assetsResp.json();
          const asset = assets.find((a: any) => a.id.toString() === assetId);
          
          if (asset) {
            // 重定向到 GitHub 下载链接
            return Response.redirect(asset.browser_download_url, 302);
          }
        }
      }
      return jsonResponse({ ok: false, message: '文件未找到' }, 404);
    }

    // 小文件：从 Contents API 读取
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.raw',
        'User-Agent': 'Sharing-App/1.0'
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
