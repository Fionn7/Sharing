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
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'Sharing-App/1.0'
  };
}

function getUploadHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `token ${token}`,
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
    console.log('Loading files from GitHub...', { owner, repo });
    const files = await fetchGitHubFiles(token, owner, repo);
    console.log('Loaded files:', files.length);
    return jsonResponse({ ok: true, files, count: files.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error loading files:', error);
    return jsonResponse({ ok: false, message, files: [], count: 0 }, 500);
  }
}

async function fetchGitHubFiles(token: string, owner: string, repo: string): Promise<any[]> {
  const files: any[] = [];

  console.log('=== Starting to fetch files ===');
  console.log('Owner:', owner);
  console.log('Repo:', repo);

  // 先从 Releases API 读取所有文件
  try {
    console.log('Step 1: Loading release files...');
    
    // 获取所有 releases
    const allReleasesResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
      headers: getGitHubHeaders(token)
    });
    
    if (!allReleasesResp.ok) {
      console.log('Failed to fetch releases:', allReleasesResp.status, allReleasesResp.statusText);
    } else {
      const allReleases = await allReleasesResp.json();
      console.log('Found', allReleases.length, 'releases');
      
      let targetRelease = null;
      
      // 先找 tag 为 "files" 的 release
      targetRelease = allReleases.find((r: any) => r.tag_name === 'files');
      
      // 如果没有，找最新的
      if (!targetRelease && allReleases.length > 0) {
        targetRelease = allReleases[0];
      }
      
      if (targetRelease) {
        console.log('Using release:', targetRelease.tag_name, '(ID:', targetRelease.id, ')');
        
        // 获取 assets
        const assetsResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${targetRelease.id}/assets`, {
          headers: getGitHubHeaders(token)
        });
        
        if (assetsResp.ok) {
          const assets = await assetsResp.json();
          console.log('Found assets:', assets.length);
          
          for (const asset of assets) {
            console.log('  -', asset.name, '(size:', asset.size, ')');
            
            // 过滤无日期文件
            if (!asset.updated_at && !asset.created_at) {
              console.log('    Skipping (no date)');
              continue;
            }
            
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
        } else {
          console.log('Failed to fetch assets:', assetsResp.status);
        }
      } else {
        console.log('No releases found');
      }
    }
  } catch (e) {
    console.error('Failed to load release files:', e);
  }

  console.log('Step 2: Loading contents files...');
  // 再尝试从 contents/files 目录加载旧文件（兼容）
  try {
    const visitedPaths: string[] = [];

    async function traverse(path: string): Promise<void> {
      if (visitedPaths.includes(path)) return;
      visitedPaths.push(path);

      try {
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        const response = await fetch(url, {
          headers: getGitHubHeaders(token)
        });

        if (!response.ok) {
          console.error(`Failed to fetch ${path}: ${response.status}`);
          return;
        }

        const items = await response.json();
        
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
              last_modified: items.sha,
              isLargeFile: false
            });
          }
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
              last_modified: item.sha,
              isLargeFile: false
            });
          }
        }
      } catch (e) {
        console.error(`Error traversing ${path}:`, e);
      }
    }

    await traverse('files');
  } catch (e) {
    console.error('Error loading contents files:', e);
  }

  console.log('=== Total files loaded:', files.length, '===');

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
    let filename = formData.get('filename')?.toString() || file?.name || 'unknown';

    if (!file) {
      return jsonResponse({ ok: false, message: '请选择文件' }, 400);
    }

    console.log(`Uploading: ${filename}, size: ${file.size}`);
    
    // 清理文件名 - GitHub 对文件名有一定限制
    filename = sanitizeFilename(filename);
    console.log(`Sanitized filename: ${filename}`);
    
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const folder = getFolder(ext);

    // 获取或创建 release
    const release = await getOrCreateRelease(token, owner, repo);
    console.log(`Using release: ${release.tag} (ID: ${release.id})`);
    
    // 检查是否已存在同名 asset
    const assetsResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${release.id}/assets`, {
      headers: getGitHubHeaders(token)
    });
    
    let existingAssetId: number | undefined;
    if (assetsResp.ok) {
      const assets = await assetsResp.json();
      const existing = assets.find((a: any) => a.name === filename);
      if (existing) {
        existingAssetId = existing.id;
        console.log(`Found existing asset: ${existingAssetId}`);
      }
    }

    // 如果已存在，先删除
    if (existingAssetId) {
      console.log(`Deleting existing asset: ${existingAssetId}`);
      const deleteResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${existingAssetId}`, {
        method: 'DELETE',
        headers: getGitHubHeaders(token)
      });
      console.log(`Delete response: ${deleteResp.status}`);
      // 等待一小段时间确保删除完成
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 正确构建上传 URL - 对文件名进行适当编码
    // GitHub Releases API 需要正确的 URL 编码
    const encodedFilename = encodeURIComponent(filename);
    const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodedFilename}`;
    console.log(`Upload URL: ${uploadUrl}`);
    
    // 直接从 file 读取二进制
    const binaryContent = await file.arrayBuffer();

    console.log('Sending to GitHub releases...');
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        ...getUploadHeaders(token),
        'Content-Type': 'application/octet-stream',
        // 对于大文件，可以添加一些额外的头信息
        'Content-Length': file.size.toString()
      },
      body: binaryContent
    });
    console.log(`GitHub response: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub error response:', errorText);
      let errorMessage = '上传失败';
      try {
        const data = JSON.parse(errorText);
        errorMessage = data.message || errorText;
      } catch {
        errorMessage = errorText;
      }
      
      // 如果是文件名相关的错误，尝试简化文件名
      if (errorMessage.includes('name') || errorMessage.includes('invalid')) {
        console.log('Attempting with simplified filename...');
        // 尝试只保留 ASCII 字符和扩展名
        const simpleName = simplifyFilename(filename);
        if (simpleName !== filename) {
          console.log(`Trying simplified name: ${simpleName}`);
          const simpleUploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(simpleName)}`;
          
          const retryResponse = await fetch(simpleUploadUrl, {
            method: 'POST',
            headers: {
              ...getUploadHeaders(token),
              'Content-Type': 'application/octet-stream',
              'Content-Length': file.size.toString()
            },
            body: binaryContent
          });
          
          if (retryResponse.ok) {
            const asset = await retryResponse.json();
            console.log('Upload successful with simplified name, asset:', asset);
            return jsonResponse({ 
              ok: true, 
              message: '上传成功', 
              filename: simpleName, 
              folder,
              isLargeFile: true,
              downloadUrl: asset.browser_download_url
            });
          }
        }
      }
      
      return jsonResponse({ ok: false, message: errorMessage }, response.status);
    }

    const asset = await response.json();
    console.log('Upload successful, asset:', asset);
    
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

// 简化文件名，只保留安全字符
function simplifyFilename(filename: string): string {
  const ext = filename.split('.').pop();
  const name = filename.substring(0, filename.length - (ext ? ext.length + 1 : 0));
  
  // 只保留字母、数字、下划线、连字符
  let simpleName = name.replace(/[^a-zA-Z0-9_\-]/g, '_');
  
  // 确保不为空
  if (!simpleName) {
    simpleName = 'file';
  }
  
  // 限制长度
  simpleName = simpleName.substring(0, 50);
  
  return ext ? `${simpleName}.${ext}` : simpleName;
}

// 清理文件名，移除或替换 GitHub 不允许的字符，同时保留中文字符
function sanitizeFilename(filename: string): string {
  console.log('Original filename:', filename);
  
  // 移除控制字符
  let sanitized = filename.replace(/[\x00-\x1F\x7F]/g, '');
  
  // 替换文件系统不允许的字符，但保留中文字符
  // 只替换 / \ ? % * : | " < > 这些真正有问题的字符
  sanitized = sanitized.replace(/[\/\\?%*:|"<>]/g, '_');
  
  // 处理 Windows 下的保留文件名
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  const nameWithoutExt = sanitized.split('.')[0].toUpperCase();
  if (reservedNames.includes(nameWithoutExt)) {
    sanitized = '_' + sanitized;
  }
  
  // 移除首尾空格
  sanitized = sanitized.trim();
  
  // 确保文件名不为空
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    const ext = filename.split('.').pop();
    sanitized = ext && ext !== filename ? `unnamed_file.${ext}` : 'unnamed_file';
  }
  
  // 限制文件名长度（GitHub Releases 有一定限制）
  if (sanitized.length > 255) {
    const extIndex = sanitized.lastIndexOf('.');
    if (extIndex > 0) {
      const ext = sanitized.substring(extIndex);
      const name = sanitized.substring(0, extIndex);
      sanitized = name.substring(0, 250 - ext.length) + ext;
    } else {
      sanitized = sanitized.substring(0, 250);
    }
  }
  
  console.log('Sanitized filename:', sanitized);
  return sanitized;
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
