const GITHUB_BRANCH = 'main';

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  if (method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, message: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
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

  // GET /download/:path - Download a file
  if (pathname.startsWith('/download/')) {
    const path = pathname.replace('/download/', '');
    const key = `files/${path}`;
    
    if (key.includes('..') || !key.startsWith('files/')) {
      return new Response(JSON.stringify({ ok: false, message: '非法路径' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    try {
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

  return new Response(JSON.stringify({ ok: false, message: '路由不存在' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}
