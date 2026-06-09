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
    'Accept': 'application/vnd.github+json',
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

    if (pathname.startsWith('/preview/')) {
      const path = pathname.replace('/preview/', '');
      return handlePreview(path, githubToken, githubOwner, githubRepo);
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
    console.log('=== handleGetFiles called ===');
    console.log('Loading files from GitHub...', { owner, repo });
    const files = await fetchGitHubFiles(token, owner, repo);
    console.log('Loaded files:', files.length);
    
    const response = { ok: true, files, count: files.length };
    console.log('=== Response to frontend ===', JSON.stringify(response, null, 2));
    
    return jsonResponse(response);
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
          console.log('=== Found', assets.length, 'assets ===');
          console.log('Raw assets:', JSON.stringify(assets, null, 2)); // 打印完整的原始数据
          
          for (const asset of assets) {
            console.log(`Asset: [${asset.id}] "${asset.name}" (size: ${asset.size}, created: ${asset.created_at}, updated: ${asset.updated_at})`);
            console.log(`  Asset object keys:`, Object.keys(asset)); // 打印 asset 的所有字段
            
            // 过滤无日期文件
            if (!asset.updated_at && !asset.created_at) {
              console.log('    Skipping (no date)');
              continue;
            }
            
            // 🔧 解码原始文件名
            let displayName = asset.name;
            if (asset.name.includes('___ORIGINAL___')) {
              try {
                const parts = asset.name.split('___ORIGINAL___');
                displayName = decodeURIComponent(atob(parts[1]));
                console.log(`  Decoded filename: "${asset.name}" -> "${displayName}"`);
              } catch (e) {
                console.log(`  Failed to decode filename: "${asset.name}"`);
              }
            }
            
            const ext = displayName.split('.').pop()?.toLowerCase() || '';
            const category = getCategory(ext);
            const folder = getFolder(ext);
            
            const fileObj = {
              name: displayName,
              originalName: asset.name, // 保存原始编码名，用于下载等操作
              path: `release/${asset.id}`,
              folder,
              size: asset.size,
              type: category.name,
              icon: category.icon,
              last_modified: asset.updated_at || asset.created_at,
              isLargeFile: asset.size > 10 * 1024 * 1024, // >10MB 显示大文件标签
              downloadUrl: asset.browser_download_url
            };
            
            console.log(`  Adding file object:`, JSON.stringify(fileObj, null, 2));
            files.push(fileObj);
          }
          
          console.log('=== Added', files.length, 'files from release ===');
          console.log('=== Final files array ===', JSON.stringify(files, null, 2));
        } else {
          console.log('Failed to fetch assets:', assetsResp.status);
          const errorText = await assetsResp.text();
          console.log('Assets error:', errorText);
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
    console.log('=== Upload request received ===');
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    
    const formData = await request.formData();
    console.log('FormData parsed');
    console.log('FormData entries:');
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`  ${key}: File(name=${value.name}, size=${value.size}, type=${value.type})`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }
    
    const file = formData.get('file') as File;
    const originalFilename = formData.get('filename')?.toString() || file?.name || 'unknown';

    console.log('=== File object details ===');
    console.log('file.name:', file.name);
    console.log('file.type:', file.type);
    console.log('file.size:', file.size);
    console.log('file.lastModified:', file.lastModified);
    console.log('originalFilename:', originalFilename);
    console.log('originalFilename length:', originalFilename.length);
    console.log('originalFilename char codes:', originalFilename.split('').map(c => c.charCodeAt(0).toString(16)).join(' '));

    if (!file) {
      return jsonResponse({ ok: false, message: '请选择文件' }, 400);
    }

    console.log(`Original filename: ${originalFilename}`);
    console.log(`File size: ${file.size}`);
    
    // 只做最基本的文件名清理
    let filename = sanitizeFilenameLight(originalFilename);
    console.log(`Clean filename: ${filename}`);
    
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const folder = getFolder(ext);

    // 获取或创建 release
    const release = await getOrCreateRelease(token, owner, repo);
    console.log(`Using release: ${release.tag} (ID: ${release.id})`);
    
    // 记录当前所有 assets
    const assetsResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${release.id}/assets`, {
      headers: getGitHubHeaders(token)
    });
    
    if (assetsResp.ok) {
      const assets = await assetsResp.json();
      console.log(`=== Current assets (${assets.length}) ===`);
      assets.forEach(a => console.log(`  - [${a.id}] ${a.name}`));
    }

    // 尝试上传
    console.log('=== Uploading file ===');
    const uploadResult = await tryUploadFile(file, filename, release.id, token, owner, repo);
    
    if (uploadResult.success) {
      console.log('Upload successful!');
      console.log('Final filename:', uploadResult.asset.name);
      console.log('Asset:', uploadResult.asset);
      
      return jsonResponse({ 
        ok: true, 
        message: '上传成功', 
        filename: uploadResult.asset.name, 
        originalFilename: filename,
        folder,
        isLargeFile: true,
        downloadUrl: uploadResult.asset.browser_download_url,
        diagnostics: uploadResult.diagnostics
      });
    } else {
      console.error('Upload failed');
      return jsonResponse({ 
        ok: false, 
        message: uploadResult.error || '上传失败，请重试',
        diagnostics: uploadResult.diagnostics
      }, 500);
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Upload error:', message);
    console.error('Stack trace:', error instanceof Error ? error.stack : '');
    return jsonResponse({ ok: false, message }, 500);
  }
}

async function tryUploadFile(file: File, filename: string, releaseId: number, token: string, owner: string, repo: string): Promise<{success: boolean, asset?: any, error?: string, diagnostics: any}> {
  const diagnostics: any[] = [];
  
  try {
    diagnostics.push({ type: 'info', message: `开始上传，期望文件名: ${filename}` });
    console.log(`Trying upload with filename: ${filename}`);
    
    // 🔧 新方案：编码原始文件名到上传文件名中
    // 格式：safeName-timestamp.ext___ORIGINAL___base64encodedOriginal
    const timestamp = Date.now();
    const ext = filename.includes('.') ? filename.split('.').pop() : '';
    const baseName = filename.includes('.') ? filename.substring(0, filename.lastIndexOf('.')) : filename;
    
    // 生成安全的 ASCII 基础名
    const safeBaseName = baseName.split('').map(c => {
      const code = c.charCodeAt(0);
      if (code < 128) return c;
      return '_'; // 非 ASCII 替换成下划线
    }).join('');
    
    // 编码原始文件名
    const encodedOriginalFilename = btoa(encodeURIComponent(filename));
    
    // 最终上传文件名（GitHub 看到的）
    const uploadFilename = `${safeBaseName}-${timestamp}${ext ? '.' + ext : ''}___ORIGINAL___${encodedOriginalFilename}`;
    
    diagnostics.push({ type: 'info', message: `使用编码文件名上传: ${uploadFilename}` });
    console.log('Upload filename (GitHub):', uploadFilename);
    
    // 直接从 file 读取二进制
    const binaryContent = await file.arrayBuffer();
    
    // 首先检查文件是否存在 - 查找是否有相同原始文件名的编码版本
    const checkResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets`, {
      headers: getGitHubHeaders(token)
    });
    
    let existingAsset: any = null;
    if (checkResp.ok) {
      const assets = await checkResp.json();
      diagnostics.push({ type: 'info', message: `当前有 ${assets.length} 个文件` });
      console.log('Current assets:', assets.map((a: any) => `[${a.id}] ${a.name}`));
      
      // 查找是否有相同原始文件名的编码版本
      existingAsset = assets.find((a: any) => {
        if (a.name.includes('___ORIGINAL___')) {
          try {
            const parts = a.name.split('___ORIGINAL___');
            const decoded = decodeURIComponent(atob(parts[1]));
            return decoded === filename;
          } catch {
            return false;
          }
        }
        return a.name === filename; // 老版本文件
      });
      
      if (existingAsset) {
        diagnostics.push({ type: 'warning', message: `找到匹配文件: ${existingAsset.name} (ID: ${existingAsset.id})，将先删除` });
        console.log(`Found match to replace: "${existingAsset.name}" (ID: ${existingAsset.id})`);
      } else {
        diagnostics.push({ type: 'info', message: `未找到匹配文件，直接上传` });
        console.log(`No match found for "${filename}"`);
      }
    }
    
    // 如果文件存在，先删除
    if (existingAsset) {
      diagnostics.push({ type: 'info', message: `正在删除旧文件...` });
      console.log(`Deleting existing file before upload: ${existingAsset.name} (ID: ${existingAsset.id})`);
      const deleteResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${existingAsset.id}`, {
        method: 'DELETE',
        headers: getGitHubHeaders(token)
      });
      
      diagnostics.push({ type: 'info', message: `删除请求状态: ${deleteResp.status}` });
      console.log(`Delete response: ${deleteResp.status}`);
      
      // 等待更长时间确保 GitHub 处理删除
      diagnostics.push({ type: 'info', message: `等待 4 秒让 GitHub 处理删除...` });
      console.log('Waiting 4 seconds for GitHub to process deletion...');
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // 验证文件是否真的被删除了
      console.log('Verifying file deletion...');
      const verifyResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets`, {
        headers: getGitHubHeaders(token)
      });
      
      if (verifyResp.ok) {
        const assetsAfterDelete = await verifyResp.json();
        const stillExists = assetsAfterDelete.find((a: any) => a.id === existingAsset.id);
        if (stillExists) {
          diagnostics.push({ type: 'warning', message: `文件仍存在，再等待 3 秒...` });
          console.warn('File still exists after deletion! Waiting 3 more seconds...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          diagnostics.push({ type: 'success', message: `旧文件已成功删除！` });
          console.log('File successfully deleted!');
        }
      }
    }
    
    // 构建上传 URL - 使用编码后的文件名
    const encodedFilename = encodeURIComponent(uploadFilename);
    const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodedFilename}`;
    
    diagnostics.push({ type: 'info', message: `上传 URL: ${uploadUrl}` });
    diagnostics.push({ type: 'info', message: `编码后文件名: ${encodedFilename}` });
    console.log('Upload URL:', uploadUrl);
    console.log('Filename for header:', uploadFilename);
    console.log('Encoded filename:', encodedFilename);

    // 因为 uploadFilename 已经是纯 ASCII 了，所以不需要复杂的编码
    const rfc5987Filename = encodeURIComponent(uploadFilename);
    
    diagnostics.push({ type: 'info', message: `正在上传文件...` });
    console.log('Uploading file...');
    
    // 上传尝试 - 上传文件名已经是纯 ASCII 了
    let response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        ...getUploadHeaders(token),
        'Content-Type': 'application/octet-stream',
        'Content-Length': file.size.toString(),
        'Content-Disposition': `attachment; filename="${uploadFilename.replace(/"/g, '\\"')}"`
      },
      body: binaryContent
    });

    diagnostics.push({ type: 'info', message: `上传响应状态: ${response.status}` });
    console.log('Upload response status:', response.status);

    if (response.ok) {
      const asset = await response.json();
      diagnostics.push({ type: 'success', message: `上传成功！GitHub 保存的文件名: ${asset.name}` });
      console.log('Upload successful, asset name:', asset.name);
      
      // 检查文件名是否改变（应该不会，因为我们用的是纯 ASCII）
      if (asset.name !== uploadFilename) {
        diagnostics.push({ type: 'warning', message: `注意！文件名被 GitHub 修改了！` });
        diagnostics.push({ type: 'warning', message: `期望: ${uploadFilename}` });
        diagnostics.push({ type: 'warning', message: `实际: ${asset.name}` });
      }
      
      diagnostics.push({ type: 'success', message: `原始文件名: ${filename}` });
      diagnostics.push({ type: 'success', message: `编码文件名: ${uploadFilename}` });
      
      return { success: true, asset, diagnostics };
    } else {
      const responseClone = response.clone();
      const errorText = await responseClone.text();
      diagnostics.push({ type: 'error', message: `GitHub 错误: HTTP ${response.status} - ${errorText}` });
      console.error('Upload error:', response.status, errorText);
      
      // 如果是 422 already_exists，尝试找到并删除相同原始文件名的文件
      if (response.status === 422 && errorText.includes('already_exists')) {
        diagnostics.push({ type: 'warning', message: '文件已存在，尝试查找并删除...' });
        
        // 重新获取 assets 列表
        const checkAgainResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets`, {
          headers: getGitHubHeaders(token)
        });
        
        if (checkAgainResp.ok) {
          const assets = await checkAgainResp.json();
          diagnostics.push({ type: 'info', message: `当前有 ${assets.length} 个文件` });
          
          // 查找是否有相同原始文件名的编码版本
          let assetToDelete = assets.find(a => {
            if (a.name.includes('___ORIGINAL___')) {
              try {
                const parts = a.name.split('___ORIGINAL___');
                const decoded = decodeURIComponent(atob(parts[1]));
                return decoded === filename;
              } catch {
                return false;
              }
            }
            return a.name === filename;
          });
          
          if (assetToDelete) {
            diagnostics.push({ type: 'info', message: `找到匹配文件: ${assetToDelete.name}` });
            diagnostics.push({ type: 'info', message: `正在删除...` });
            
            // 删除文件
            const deleteResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${assetToDelete.id}`, {
              method: 'DELETE',
              headers: getGitHubHeaders(token)
            });
            
            diagnostics.push({ type: 'info', message: `删除响应: ${deleteResp.status}` });
            
            if (deleteResp.ok || deleteResp.status === 204) {
              diagnostics.push({ type: 'success', message: `删除成功，等待 5 秒后重新上传...` });
              
              // 等待 GitHub 处理
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              // 重新上传
              diagnostics.push({ type: 'info', message: `正在重新上传...` });
              const retryResponse = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                  ...getUploadHeaders(token),
                  'Content-Type': 'application/octet-stream',
                  'Content-Length': file.size.toString(),
                  'Content-Disposition': `attachment; filename="${uploadFilename.replace(/"/g, '\\"')}"`
                },
                body: binaryContent
              });
              
              diagnostics.push({ type: 'info', message: `重试响应: ${retryResponse.status}` });
              
              if (retryResponse.ok) {
                const asset = await retryResponse.json();
                diagnostics.push({ type: 'success', message: `重试成功！最终文件名: ${asset.name}` });
                
                if (asset.name !== filename) {
                  diagnostics.push({ type: 'warning', message: `注意！文件名被 GitHub 修改了！` });
                  diagnostics.push({ type: 'warning', message: `期望: ${filename}` });
                  diagnostics.push({ type: 'warning', message: `实际: ${asset.name}` });
                }
                
                return { success: true, asset, diagnostics };
              } else {
                const retryErrorText = await retryResponse.text();
                diagnostics.push({ type: 'error', message: `重试失败: ${retryErrorText}` });
                return { success: false, error: retryErrorText, diagnostics };
              }
            }
          } else {
            diagnostics.push({ type: 'error', message: '找不到可以删除的文件，请手动检查文件库' });
          }
        }
      }
      
      return { success: false, error: errorText, diagnostics };
    }
  } catch (error: any) {
    diagnostics.push({ type: 'error', message: `上传异常: ${error.message}` });
    console.error('Upload attempt failed:', error);
    return { success: false, error: error.message, diagnostics };
  }
}

// 轻量级文件名清理
function sanitizeFilenameLight(filename: string): string {
  // 只移除真正危险的字符
  let sanitized = filename.replace(/[\x00-\x1F\x7F]/g, '');
  sanitized = sanitized.replace(/[\/\\?%*:|"<>]/g, '_');
  sanitized = sanitized.trim();
  
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    const ext = filename.split('.').pop();
    sanitized = ext && ext !== filename ? `unnamed_file.${ext}` : 'unnamed_file';
  }
  
  return sanitized;
}

// 安全的文件名简化
function simplifyFilenameSafe(filename: string): string {
  const ext = filename.split('.').pop();
  const name = filename.substring(0, filename.length - (ext ? ext.length + 1 : 0));
  
  // 保留字母、数字、下划线、连字符，其他替换为下划线
  let simpleName = name.split('').map((char, index) => {
    const code = char.charCodeAt(0);
    if (code >= 0x4E00 && code <= 0x9FFF) { // 中文
      return char;
    } else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || char === '_' || char === '-') {
      return char;
    }
    return '_';
  }).join('');
  
  // 确保不为空
  if (!simpleName.replace(/_/g, '')) {
    simpleName = 'file';
  }
  
  // 限制长度
  simpleName = simpleName.substring(0, 50);
  
  return ext ? `${simpleName}.${ext}` : simpleName;
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
  
  // 更宽松的文件名长度限制（GitHub实际支持更长）
  if (sanitized.length > 200) {
    const extIndex = sanitized.lastIndexOf('.');
    if (extIndex > 0) {
      const ext = sanitized.substring(extIndex);
      const name = sanitized.substring(0, extIndex);
      // 智能截断：保留中文完整性
      let truncatedName = name;
      let maxLength = 180 - ext.length;
      while (truncatedName.length > maxLength && truncatedName.length > 0) {
        truncatedName = truncatedName.substring(0, truncatedName.length - 1);
      }
      sanitized = truncatedName + ext;
    } else {
      sanitized = sanitized.substring(0, 180);
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

// 解码存储的文件名，提取原始文件名
function decodeStoredFilename(storedName: string): string {
  if (storedName.includes('___ORIGINAL___')) {
    try {
      const parts = storedName.split('___ORIGINAL___');
      const decoded = decodeURIComponent(atob(parts[1]));
      return decoded;
    } catch {
      // 如果解码失败，返回原始存储名
      return storedName;
    }
  }
  return storedName;
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
            // 🔧 解码原始文件名，确保下载时使用正确的文件名
            const originalFilename = decodeStoredFilename(asset.name);
            
            // 代理下载文件，设置正确的 Content-Disposition 头
            const downloadResponse = await fetch(asset.browser_download_url, {
              headers: getGitHubHeaders(token)
            });
            
            if (downloadResponse.ok) {
              const contentType = downloadResponse.headers.get('content-type') || 'application/octet-stream';
              
              return new Response(downloadResponse.body, {
                headers: {
                  'Content-Type': contentType,
                  'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFilename)}"; filename*=UTF-8''${encodeURIComponent(originalFilename)}`,
                  ...corsHeaders
                }
              });
            }
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

    // 🔧 解码原始文件名
    const storedFilename = path.split('/').pop() || 'download';
    const originalFilename = decodeStoredFilename(storedFilename);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return new Response(response.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFilename)}"; filename*=UTF-8''${encodeURIComponent(originalFilename)}`,
        ...corsHeaders
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ ok: false, message }, 500);
  }
}

// 文件在线预览处理
async function handlePreview(path: string, token: string, owner: string, repo: string): Promise<Response> {
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
            const originalFilename = decodeStoredFilename(asset.name);
            const ext = originalFilename.split('.').pop()?.toLowerCase() || '';
            
            // 预览文件内容，设置 inline 头让浏览器直接显示
            const downloadResponse = await fetch(asset.browser_download_url, {
              headers: getGitHubHeaders(token)
            });
            
            if (downloadResponse.ok) {
              const contentType = downloadResponse.headers.get('content-type') || 'application/octet-stream';
              
              // 对于图片和 PDF，允许跨域访问以便嵌入显示
              const corsExtra = (ext === 'pdf' || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) 
                ? { 'Access-Control-Allow-Origin': '*' } 
                : {};
              
              return new Response(downloadResponse.body, {
                headers: {
                  'Content-Type': contentType,
                  'Content-Disposition': `inline; filename="${encodeURIComponent(originalFilename)}"; filename*=UTF-8''${encodeURIComponent(originalFilename)}`,
                  ...corsHeaders,
                  ...corsExtra
                }
              });
            }
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

    const storedFilename = path.split('/').pop() || 'download';
    const originalFilename = decodeStoredFilename(storedFilename);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return new Response(response.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(originalFilename)}"; filename*=UTF-8''${encodeURIComponent(originalFilename)}`,
        ...corsHeaders
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ ok: false, message }, 500);
  }
}
