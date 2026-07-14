var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import htmlContent from "./61b4f9bdab7030cef77a4773e8e30a93027032d9-index.html";
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept"
};
function getGitHubHeaders(token) {
  return {
    "Authorization": `token ${token}`,
    "Accept": "application/vnd.github+json",
    "User-Agent": "Sharing-App/1.0"
  };
}
__name(getGitHubHeaders, "getGitHubHeaders");
function getUploadHeaders(token) {
  return {
    "Authorization": `token ${token}`,
    "Accept": "application/vnd.github+json",
    "User-Agent": "Sharing-App/1.0"
  };
}
__name(getUploadHeaders, "getUploadHeaders");
async function getOrCreateRelease(token, owner, repo) {
  const tag = "files";
  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`, {
    headers: getGitHubHeaders(token)
  });
  if (resp.ok) {
    const release = await resp.json();
    return { tag, id: release.id };
  }
  const createResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
    method: "POST",
    headers: {
      ...getGitHubHeaders(token),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tag_name: tag,
      name: "Files Storage",
      description: "Large file storage for sharing",
      draft: false,
      prerelease: false
    })
  });
  if (!createResp.ok) {
    const err = await createResp.json();
    throw new Error(`\u521B\u5EFA release \u5931\u8D25: ${err.message}`);
  }
  const newRelease = await createResp.json();
  return { tag, id: newRelease.id };
}
__name(getOrCreateRelease, "getOrCreateRelease");
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
}
__name(jsonResponse, "jsonResponse");
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;
    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    const githubToken = env.GITHUB_TOKEN;
    const githubOwner = env.GITHUB_OWNER || "Fionn7";
    const githubRepo = env.GITHUB_REPO || "Sharing";
    if (pathname === "/") {
      return handleHome();
    }
    if (pathname === "/api/files" && method === "GET") {
      return handleGetFiles(githubToken, githubOwner, githubRepo);
    }
    if (pathname === "/api/upload" && method === "POST") {
      return handleUpload(request, githubToken, githubOwner, githubRepo);
    }
    if (pathname.startsWith("/api/files/") && method === "DELETE") {
      const filename = decodeURIComponent(pathname.replace("/api/files/", ""));
      const category = url.searchParams.get("category") || "files/others";
      return handleDelete(filename, category, githubToken, githubOwner, githubRepo);
    }
    if (pathname.startsWith("/download/")) {
      const path = pathname.replace("/download/", "");
      return handleDownload(path, githubToken, githubOwner, githubRepo);
    }
    if (pathname.startsWith("/preview/")) {
      const path = pathname.replace("/preview/", "");
      return handlePreview(path, githubToken, githubOwner, githubRepo);
    }
    if (pathname === "/api/debug") {
      let githubStatus = "unknown";
      let rawResponse = null;
      let traverseLog = [];
      let tokenInfo = {};
      if (githubToken) {
        try {
          const userResp = await fetch("https://api.github.com/user", {
            headers: getGitHubHeaders(githubToken)
          });
          tokenInfo.userStatus = `${userResp.status} ${userResp.statusText}`;
          if (userResp.ok) {
            const userData = await userResp.json();
            tokenInfo.user = userData.login;
          }
          const repoResp = await fetch(`https://api.github.com/repos/${githubOwner}/${githubRepo}`, {
            headers: getGitHubHeaders(githubToken)
          });
          tokenInfo.repoStatus = `${repoResp.status} ${repoResp.statusText}`;
          const testUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/files`;
          const testResp = await fetch(testUrl, {
            headers: getGitHubHeaders(githubToken)
          });
          githubStatus = `${testResp.status} ${testResp.statusText}`;
          if (testResp.ok) {
            const data = await testResp.json();
            rawResponse = data;
            if (Array.isArray(data)) {
              traverseLog.push(`files/ \u76EE\u5F55\u5305\u542B ${data.length} \u4E2A\u9879\u76EE`);
              for (const item of data) {
                traverseLog.push(`  - ${item.name} (${item.type})`);
              }
            }
          } else {
            const errorText = await testResp.text();
            traverseLog.push(`Error: ${errorText}`);
          }
        } catch (e) {
          githubStatus = `error: ${e instanceof Error ? e.message : "unknown"}`;
        }
      }
      return jsonResponse({
        ok: true,
        tokenConfigured: !!githubToken,
        tokenPrefix: githubToken ? githubToken.substring(0, 10) + "..." : null,
        owner: githubOwner,
        repo: githubRepo,
        tokenInfo,
        githubStatus,
        rawResponse,
        traverseLog
      });
    }
    if (pathname === "/api/upload-debug" && method === "POST") {
      try {
        const contentLength = request.headers.get("content-length");
        console.log(`Upload debug: content-length=${contentLength}`);
        return jsonResponse({
          ok: true,
          message: "Upload debug endpoint",
          contentLength
        });
      } catch (e) {
        return jsonResponse({ ok: false, message: e instanceof Error ? e.message : "error" }, 500);
      }
    }
    if (pathname === "/api/share" && method === "POST") {
      return handleCreateShare(request, env);
    }
    if (pathname.startsWith("/s/")) {
      return handleShareAccess(request, env);
    }
    return new Response("404 Not Found", { status: 404, headers: corsHeaders });
  }
};
function handleHome() {
  return new Response(htmlContent, {
    headers: { "Content-Type": "text/html; charset=UTF-8", ...corsHeaders }
  });
}
__name(handleHome, "handleHome");
async function handleGetFiles(token, owner, repo) {
  if (!token) {
    return jsonResponse({ ok: false, message: "\u8BF7\u914D\u7F6E GITHUB_TOKEN\uFF08\u4F7F\u7528 wrangler secret put GITHUB_TOKEN\uFF09", files: [], count: 0 }, 500);
  }
  try {
    console.log("=== handleGetFiles called ===");
    console.log("Loading files from GitHub...", { owner, repo });
    const files = await fetchGitHubFiles(token, owner, repo);
    console.log("Loaded files:", files.length);
    const response = { ok: true, files, count: files.length };
    console.log("=== Response to frontend ===", JSON.stringify(response, null, 2));
    return jsonResponse(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error loading files:", error);
    return jsonResponse({ ok: false, message, files: [], count: 0 }, 500);
  }
}
__name(handleGetFiles, "handleGetFiles");
async function fetchGitHubFiles(token, owner, repo) {
  const files = [];
  console.log("=== Starting to fetch files ===");
  console.log("Owner:", owner);
  console.log("Repo:", repo);
  try {
    console.log("Step 1: Loading release files...");
    const allReleasesResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
      headers: getGitHubHeaders(token)
    });
    if (!allReleasesResp.ok) {
      console.log("Failed to fetch releases:", allReleasesResp.status, allReleasesResp.statusText);
    } else {
      const allReleases = await allReleasesResp.json();
      console.log("Found", allReleases.length, "releases");
      let targetRelease = null;
      targetRelease = allReleases.find((r) => r.tag_name === "files");
      if (!targetRelease && allReleases.length > 0) {
        targetRelease = allReleases[0];
      }
      if (targetRelease) {
        console.log("Using release:", targetRelease.tag_name, "(ID:", targetRelease.id, ")");
        const assetsResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${targetRelease.id}/assets`, {
          headers: getGitHubHeaders(token)
        });
        if (assetsResp.ok) {
          const assets = await assetsResp.json();
          console.log("=== Found", assets.length, "assets ===");
          console.log("Raw assets:", JSON.stringify(assets, null, 2));
          for (const asset of assets) {
            console.log(`Asset: [${asset.id}] "${asset.name}" (size: ${asset.size}, created: ${asset.created_at}, updated: ${asset.updated_at})`);
            console.log(`  Asset object keys:`, Object.keys(asset));
            if (!asset.updated_at && !asset.created_at) {
              console.log("    Skipping (no date)");
              continue;
            }
            let displayName = asset.name;
            if (asset.name.includes("___ORIGINAL___")) {
              try {
                const parts = asset.name.split("___ORIGINAL___");
                displayName = decodeURIComponent(atob(parts[1]));
                console.log(`  Decoded filename: "${asset.name}" -> "${displayName}"`);
              } catch (e) {
                console.log(`  Failed to decode filename: "${asset.name}"`);
              }
            }
            const ext = displayName.split(".").pop()?.toLowerCase() || "";
            const category = getCategory(ext);
            const folder = getFolder(ext);
            const fileObj = {
              name: displayName,
              originalName: asset.name,
              // 保存原始编码名，用于下载等操作
              path: `release/${asset.id}`,
              folder,
              size: asset.size,
              type: category.name,
              icon: category.icon,
              last_modified: asset.updated_at || asset.created_at,
              isLargeFile: asset.size > 10 * 1024 * 1024,
              // >10MB 显示大文件标签
              downloadUrl: asset.browser_download_url
            };
            console.log(`  Adding file object:`, JSON.stringify(fileObj, null, 2));
            files.push(fileObj);
          }
          console.log("=== Added", files.length, "files from release ===");
          console.log("=== Final files array ===", JSON.stringify(files, null, 2));
        } else {
          console.log("Failed to fetch assets:", assetsResp.status);
          const errorText = await assetsResp.text();
          console.log("Assets error:", errorText);
        }
      } else {
        console.log("No releases found");
      }
    }
  } catch (e) {
    console.error("Failed to load release files:", e);
  }
  console.log("Step 2: Loading contents files...");
  try {
    const visitedPaths = [];
    async function traverse(path) {
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
          if (items.type === "file") {
            const ext = items.name.split(".").pop()?.toLowerCase() || "";
            const category = getCategory(ext);
            files.push({
              name: items.name,
              path: items.path,
              folder: items.path.substring(0, items.path.lastIndexOf("/")),
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
          if (item.type === "dir") {
            await traverse(item.path);
          } else if (item.type === "file") {
            const ext = item.name.split(".").pop()?.toLowerCase() || "";
            const category = getCategory(ext);
            files.push({
              name: item.name,
              path: item.path,
              folder: item.path.substring(0, item.path.lastIndexOf("/")),
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
    __name(traverse, "traverse");
    await traverse("files");
  } catch (e) {
    console.error("Error loading contents files:", e);
  }
  console.log("=== Total files loaded:", files.length, "===");
  return files.sort((a, b) => {
    const dateA = a.last_modified;
    const dateB = b.last_modified;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateB.localeCompare(dateA);
  });
}
__name(fetchGitHubFiles, "fetchGitHubFiles");
function getCategory(ext) {
  const categories = {
    pdf: { name: "PDF\u6587\u6863", icon: "\u{1F4C4}" },
    doc: { name: "Word\u6587\u6863", icon: "\u{1F4DD}" },
    docx: { name: "Word\u6587\u6863", icon: "\u{1F4DD}" },
    xls: { name: "Excel\u8868\u683C", icon: "\u{1F4CA}" },
    xlsx: { name: "Excel\u8868\u683C", icon: "\u{1F4CA}" },
    ppt: { name: "PPT\u6F14\u793A", icon: "\u{1F4FD}\uFE0F" },
    pptx: { name: "PPT\u6F14\u793A", icon: "\u{1F4FD}\uFE0F" },
    txt: { name: "\u5176\u4ED6\u6587\u4EF6", icon: "\u{1F4C3}" },
    jpg: { name: "\u56FE\u7247", icon: "\u{1F5BC}\uFE0F" },
    jpeg: { name: "\u56FE\u7247", icon: "\u{1F5BC}\uFE0F" },
    png: { name: "\u56FE\u7247", icon: "\u{1F5BC}\uFE0F" },
    gif: { name: "\u56FE\u7247", icon: "\u{1F5BC}\uFE0F" },
    bmp: { name: "\u56FE\u7247", icon: "\u{1F5BC}\uFE0F" },
    svg: { name: "\u56FE\u7247", icon: "\u{1F5BC}\uFE0F" },
    mp4: { name: "\u89C6\u9891", icon: "\u{1F3AC}" },
    avi: { name: "\u89C6\u9891", icon: "\u{1F3AC}" },
    mov: { name: "\u89C6\u9891", icon: "\u{1F3AC}" },
    mp3: { name: "\u97F3\u9891", icon: "\u{1F3B5}" },
    wav: { name: "\u97F3\u9891", icon: "\u{1F3B5}" },
    zip: { name: "\u538B\u7F29\u5305", icon: "\u{1F4E6}" },
    rar: { name: "\u538B\u7F29\u5305", icon: "\u{1F4E6}" },
    "7z": { name: "\u538B\u7F29\u5305", icon: "\u{1F4E6}" },
    js: { name: "\u4EE3\u7801", icon: "\u{1F4BB}" },
    html: { name: "\u4EE3\u7801", icon: "\u{1F4BB}" },
    css: { name: "\u4EE3\u7801", icon: "\u{1F4BB}" },
    json: { name: "\u4EE3\u7801", icon: "\u{1F4BB}" }
  };
  return categories[ext] || { name: "\u5176\u4ED6\u6587\u4EF6", icon: "\u{1F4C1}" };
}
__name(getCategory, "getCategory");
async function handleUpload(request, token, owner, repo) {
  if (!token) {
    return jsonResponse({ ok: false, message: "\u8BF7\u914D\u7F6E GITHUB_TOKEN" }, 500);
  }
  try {
    console.log("=== Upload request received ===");
    console.log("Request headers:", Object.fromEntries(request.headers.entries()));
    const formData = await request.formData();
    console.log("FormData parsed");
    console.log("FormData entries:");
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`  ${key}: File(name=${value.name}, size=${value.size}, type=${value.type})`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }
    const file = formData.get("file");
    const originalFilename = formData.get("filename")?.toString() || file?.name || "unknown";
    console.log("=== File object details ===");
    console.log("file.name:", file.name);
    console.log("file.type:", file.type);
    console.log("file.size:", file.size);
    console.log("file.lastModified:", file.lastModified);
    console.log("originalFilename:", originalFilename);
    console.log("originalFilename length:", originalFilename.length);
    console.log("originalFilename char codes:", originalFilename.split("").map((c) => c.charCodeAt(0).toString(16)).join(" "));
    if (!file) {
      return jsonResponse({ ok: false, message: "\u8BF7\u9009\u62E9\u6587\u4EF6" }, 400);
    }
    console.log(`Original filename: ${originalFilename}`);
    console.log(`File size: ${file.size}`);
    let filename = sanitizeFilenameLight(originalFilename);
    console.log(`Clean filename: ${filename}`);
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const folder = getFolder(ext);
    const release = await getOrCreateRelease(token, owner, repo);
    console.log(`Using release: ${release.tag} (ID: ${release.id})`);
    const assetsResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${release.id}/assets`, {
      headers: getGitHubHeaders(token)
    });
    if (assetsResp.ok) {
      const assets = await assetsResp.json();
      console.log(`=== Current assets (${assets.length}) ===`);
      assets.forEach((a) => console.log(`  - [${a.id}] ${a.name}`));
    }
    console.log("=== Uploading file ===");
    const uploadResult = await tryUploadFile(file, filename, release.id, token, owner, repo);
    if (uploadResult.success) {
      console.log("Upload successful!");
      console.log("Final filename:", uploadResult.asset.name);
      console.log("Asset:", uploadResult.asset);
      return jsonResponse({
        ok: true,
        message: "\u4E0A\u4F20\u6210\u529F",
        filename: uploadResult.asset.name,
        originalFilename: filename,
        folder,
        isLargeFile: true,
        downloadUrl: uploadResult.asset.browser_download_url,
        diagnostics: uploadResult.diagnostics
      });
    } else {
      console.error("Upload failed");
      return jsonResponse({
        ok: false,
        message: uploadResult.error || "\u4E0A\u4F20\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5",
        diagnostics: uploadResult.diagnostics
      }, 500);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Upload error:", message);
    console.error("Stack trace:", error instanceof Error ? error.stack : "");
    return jsonResponse({ ok: false, message }, 500);
  }
}
__name(handleUpload, "handleUpload");
async function tryUploadFile(file, filename, releaseId, token, owner, repo) {
  const diagnostics = [];
  try {
    diagnostics.push({ type: "info", message: `\u5F00\u59CB\u4E0A\u4F20\uFF0C\u671F\u671B\u6587\u4EF6\u540D: ${filename}` });
    console.log(`Trying upload with filename: ${filename}`);
    const timestamp = Date.now();
    const ext = filename.includes(".") ? filename.split(".").pop() : "";
    const baseName = filename.includes(".") ? filename.substring(0, filename.lastIndexOf(".")) : filename;
    const safeBaseName = baseName.split("").map((c) => {
      const code = c.charCodeAt(0);
      if (code < 128) return c;
      return "_";
    }).join("");
    const encodedOriginalFilename = btoa(encodeURIComponent(filename));
    const uploadFilename = `${safeBaseName}-${timestamp}${ext ? "." + ext : ""}___ORIGINAL___${encodedOriginalFilename}`;
    diagnostics.push({ type: "info", message: `\u4F7F\u7528\u7F16\u7801\u6587\u4EF6\u540D\u4E0A\u4F20: ${uploadFilename}` });
    console.log("Upload filename (GitHub):", uploadFilename);
    const binaryContent = await file.arrayBuffer();
    const checkResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets`, {
      headers: getGitHubHeaders(token)
    });
    let existingAsset = null;
    if (checkResp.ok) {
      const assets = await checkResp.json();
      diagnostics.push({ type: "info", message: `\u5F53\u524D\u6709 ${assets.length} \u4E2A\u6587\u4EF6` });
      console.log("Current assets:", assets.map((a) => `[${a.id}] ${a.name}`));
      existingAsset = assets.find((a) => {
        if (a.name.includes("___ORIGINAL___")) {
          try {
            const parts = a.name.split("___ORIGINAL___");
            const decoded = decodeURIComponent(atob(parts[1]));
            return decoded === filename;
          } catch {
            return false;
          }
        }
        return a.name === filename;
      });
      if (existingAsset) {
        diagnostics.push({ type: "warning", message: `\u627E\u5230\u5339\u914D\u6587\u4EF6: ${existingAsset.name} (ID: ${existingAsset.id})\uFF0C\u5C06\u5148\u5220\u9664` });
        console.log(`Found match to replace: "${existingAsset.name}" (ID: ${existingAsset.id})`);
      } else {
        diagnostics.push({ type: "info", message: `\u672A\u627E\u5230\u5339\u914D\u6587\u4EF6\uFF0C\u76F4\u63A5\u4E0A\u4F20` });
        console.log(`No match found for "${filename}"`);
      }
    }
    if (existingAsset) {
      diagnostics.push({ type: "info", message: `\u6B63\u5728\u5220\u9664\u65E7\u6587\u4EF6...` });
      console.log(`Deleting existing file before upload: ${existingAsset.name} (ID: ${existingAsset.id})`);
      const deleteResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${existingAsset.id}`, {
        method: "DELETE",
        headers: getGitHubHeaders(token)
      });
      diagnostics.push({ type: "info", message: `\u5220\u9664\u8BF7\u6C42\u72B6\u6001: ${deleteResp.status}` });
      console.log(`Delete response: ${deleteResp.status}`);
      diagnostics.push({ type: "info", message: `\u7B49\u5F85 4 \u79D2\u8BA9 GitHub \u5904\u7406\u5220\u9664...` });
      console.log("Waiting 4 seconds for GitHub to process deletion...");
      await new Promise((resolve) => setTimeout(resolve, 4e3));
      console.log("Verifying file deletion...");
      const verifyResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets`, {
        headers: getGitHubHeaders(token)
      });
      if (verifyResp.ok) {
        const assetsAfterDelete = await verifyResp.json();
        const stillExists = assetsAfterDelete.find((a) => a.id === existingAsset.id);
        if (stillExists) {
          diagnostics.push({ type: "warning", message: `\u6587\u4EF6\u4ECD\u5B58\u5728\uFF0C\u518D\u7B49\u5F85 3 \u79D2...` });
          console.warn("File still exists after deletion! Waiting 3 more seconds...");
          await new Promise((resolve) => setTimeout(resolve, 3e3));
        } else {
          diagnostics.push({ type: "success", message: `\u65E7\u6587\u4EF6\u5DF2\u6210\u529F\u5220\u9664\uFF01` });
          console.log("File successfully deleted!");
        }
      }
    }
    const encodedFilename = encodeURIComponent(uploadFilename);
    const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodedFilename}`;
    diagnostics.push({ type: "info", message: `\u4E0A\u4F20 URL: ${uploadUrl}` });
    diagnostics.push({ type: "info", message: `\u7F16\u7801\u540E\u6587\u4EF6\u540D: ${encodedFilename}` });
    console.log("Upload URL:", uploadUrl);
    console.log("Filename for header:", uploadFilename);
    console.log("Encoded filename:", encodedFilename);
    const rfc5987Filename = encodeURIComponent(uploadFilename);
    diagnostics.push({ type: "info", message: `\u6B63\u5728\u4E0A\u4F20\u6587\u4EF6...` });
    console.log("Uploading file...");
    let response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        ...getUploadHeaders(token),
        "Content-Type": "application/octet-stream",
        "Content-Length": file.size.toString(),
        "Content-Disposition": `attachment; filename="${uploadFilename.replace(/"/g, '\\"')}"`
      },
      body: binaryContent
    });
    diagnostics.push({ type: "info", message: `\u4E0A\u4F20\u54CD\u5E94\u72B6\u6001: ${response.status}` });
    console.log("Upload response status:", response.status);
    if (response.ok) {
      const asset = await response.json();
      diagnostics.push({ type: "success", message: `\u4E0A\u4F20\u6210\u529F\uFF01GitHub \u4FDD\u5B58\u7684\u6587\u4EF6\u540D: ${asset.name}` });
      console.log("Upload successful, asset name:", asset.name);
      if (asset.name !== uploadFilename) {
        diagnostics.push({ type: "warning", message: `\u6CE8\u610F\uFF01\u6587\u4EF6\u540D\u88AB GitHub \u4FEE\u6539\u4E86\uFF01` });
        diagnostics.push({ type: "warning", message: `\u671F\u671B: ${uploadFilename}` });
        diagnostics.push({ type: "warning", message: `\u5B9E\u9645: ${asset.name}` });
      }
      diagnostics.push({ type: "success", message: `\u539F\u59CB\u6587\u4EF6\u540D: ${filename}` });
      diagnostics.push({ type: "success", message: `\u7F16\u7801\u6587\u4EF6\u540D: ${uploadFilename}` });
      return { success: true, asset, diagnostics };
    } else {
      const responseClone = response.clone();
      const errorText = await responseClone.text();
      diagnostics.push({ type: "error", message: `GitHub \u9519\u8BEF: HTTP ${response.status} - ${errorText}` });
      console.error("Upload error:", response.status, errorText);
      if (response.status === 422 && errorText.includes("already_exists")) {
        diagnostics.push({ type: "warning", message: "\u6587\u4EF6\u5DF2\u5B58\u5728\uFF0C\u5C1D\u8BD5\u67E5\u627E\u5E76\u5220\u9664..." });
        const checkAgainResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets`, {
          headers: getGitHubHeaders(token)
        });
        if (checkAgainResp.ok) {
          const assets = await checkAgainResp.json();
          diagnostics.push({ type: "info", message: `\u5F53\u524D\u6709 ${assets.length} \u4E2A\u6587\u4EF6` });
          let assetToDelete = assets.find((a) => {
            if (a.name.includes("___ORIGINAL___")) {
              try {
                const parts = a.name.split("___ORIGINAL___");
                const decoded = decodeURIComponent(atob(parts[1]));
                return decoded === filename;
              } catch {
                return false;
              }
            }
            return a.name === filename;
          });
          if (assetToDelete) {
            diagnostics.push({ type: "info", message: `\u627E\u5230\u5339\u914D\u6587\u4EF6: ${assetToDelete.name}` });
            diagnostics.push({ type: "info", message: `\u6B63\u5728\u5220\u9664...` });
            const deleteResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${assetToDelete.id}`, {
              method: "DELETE",
              headers: getGitHubHeaders(token)
            });
            diagnostics.push({ type: "info", message: `\u5220\u9664\u54CD\u5E94: ${deleteResp.status}` });
            if (deleteResp.ok || deleteResp.status === 204) {
              diagnostics.push({ type: "success", message: `\u5220\u9664\u6210\u529F\uFF0C\u7B49\u5F85 5 \u79D2\u540E\u91CD\u65B0\u4E0A\u4F20...` });
              await new Promise((resolve) => setTimeout(resolve, 5e3));
              diagnostics.push({ type: "info", message: `\u6B63\u5728\u91CD\u65B0\u4E0A\u4F20...` });
              const retryResponse = await fetch(uploadUrl, {
                method: "POST",
                headers: {
                  ...getUploadHeaders(token),
                  "Content-Type": "application/octet-stream",
                  "Content-Length": file.size.toString(),
                  "Content-Disposition": `attachment; filename="${uploadFilename.replace(/"/g, '\\"')}"`
                },
                body: binaryContent
              });
              diagnostics.push({ type: "info", message: `\u91CD\u8BD5\u54CD\u5E94: ${retryResponse.status}` });
              if (retryResponse.ok) {
                const asset = await retryResponse.json();
                diagnostics.push({ type: "success", message: `\u91CD\u8BD5\u6210\u529F\uFF01\u6700\u7EC8\u6587\u4EF6\u540D: ${asset.name}` });
                if (asset.name !== filename) {
                  diagnostics.push({ type: "warning", message: `\u6CE8\u610F\uFF01\u6587\u4EF6\u540D\u88AB GitHub \u4FEE\u6539\u4E86\uFF01` });
                  diagnostics.push({ type: "warning", message: `\u671F\u671B: ${filename}` });
                  diagnostics.push({ type: "warning", message: `\u5B9E\u9645: ${asset.name}` });
                }
                return { success: true, asset, diagnostics };
              } else {
                const retryErrorText = await retryResponse.text();
                diagnostics.push({ type: "error", message: `\u91CD\u8BD5\u5931\u8D25: ${retryErrorText}` });
                return { success: false, error: retryErrorText, diagnostics };
              }
            }
          } else {
            diagnostics.push({ type: "error", message: "\u627E\u4E0D\u5230\u53EF\u4EE5\u5220\u9664\u7684\u6587\u4EF6\uFF0C\u8BF7\u624B\u52A8\u68C0\u67E5\u6587\u4EF6\u5E93" });
          }
        }
      }
      return { success: false, error: errorText, diagnostics };
    }
  } catch (error) {
    diagnostics.push({ type: "error", message: `\u4E0A\u4F20\u5F02\u5E38: ${error.message}` });
    console.error("Upload attempt failed:", error);
    return { success: false, error: error.message, diagnostics };
  }
}
__name(tryUploadFile, "tryUploadFile");
function sanitizeFilenameLight(filename) {
  let sanitized = filename.replace(/[\x00-\x1F\x7F]/g, "");
  sanitized = sanitized.replace(/[\/\\?%*:|"<>]/g, "_");
  sanitized = sanitized.trim();
  if (!sanitized || sanitized === "." || sanitized === "..") {
    const ext = filename.split(".").pop();
    sanitized = ext && ext !== filename ? `unnamed_file.${ext}` : "unnamed_file";
  }
  return sanitized;
}
__name(sanitizeFilenameLight, "sanitizeFilenameLight");
async function handleDelete(filename, folder, token, owner, repo) {
  if (!token) {
    return jsonResponse({ ok: false, message: "\u8BF7\u914D\u7F6E GITHUB_TOKEN" }, 500);
  }
  try {
    if (filename.startsWith("release/")) {
      const assetId = filename.substring("release/".length);
      const deleteResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${assetId}`, {
        method: "DELETE",
        headers: getGitHubHeaders(token)
      });
      if (!deleteResp.ok) {
        const data = await deleteResp.json();
        return jsonResponse({ ok: false, message: data.message || "\u5220\u9664\u5931\u8D25" }, deleteResp.status);
      }
      return jsonResponse({ ok: true, message: "\u5220\u9664\u6210\u529F" });
    }
    const path = `${folder}/${filename}`;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const getResponse = await fetch(url, { headers: getGitHubHeaders(token) });
    if (!getResponse.ok) {
      return jsonResponse({ ok: false, message: "\u6587\u4EF6\u4E0D\u5B58\u5728" }, 404);
    }
    const fileInfo = await getResponse.json();
    const sha = fileInfo.sha;
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        ...getGitHubHeaders(token),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `Delete: ${filename}`,
        sha,
        branch: "main"
      })
    });
    if (!response.ok) {
      const data = await response.json();
      return jsonResponse({ ok: false, message: data.message || "\u5220\u9664\u5931\u8D25" }, response.status);
    }
    return jsonResponse({ ok: true, message: "\u5220\u9664\u6210\u529F" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ ok: false, message }, 500);
  }
}
__name(handleDelete, "handleDelete");
function getFolder(ext) {
  const folders = {
    pdf: "files/pdfs",
    doc: "files/documents",
    docx: "files/documents",
    xls: "files/documents",
    xlsx: "files/documents",
    ppt: "files/documents",
    pptx: "files/documents",
    txt: "files/documents",
    jpg: "files/images",
    jpeg: "files/images",
    png: "files/images",
    gif: "files/images",
    bmp: "files/images",
    svg: "files/images",
    mp4: "files/videos",
    avi: "files/videos",
    mov: "files/videos",
    mp3: "files/audio",
    wav: "files/audio",
    zip: "files/archives",
    rar: "files/archives",
    "7z": "files/archives",
    js: "files/codes",
    html: "files/codes",
    css: "files/codes",
    json: "files/codes"
  };
  return folders[ext] || "files/others";
}
__name(getFolder, "getFolder");
function decodeStoredFilename(storedName) {
  if (storedName.includes("___ORIGINAL___")) {
    try {
      const parts = storedName.split("___ORIGINAL___");
      const decoded = decodeURIComponent(atob(parts[1]));
      return decoded;
    } catch {
      return storedName;
    }
  }
  return storedName;
}
__name(decodeStoredFilename, "decodeStoredFilename");
function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
__name(base64UrlEncode, "base64UrlEncode");
function base64UrlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - str.length % 4) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}
__name(base64UrlDecode, "base64UrlDecode");
async function generateShareSignature(path, secret, expiresInHours = 24) {
  const expires = Math.floor(Date.now() / 1e3) + expiresInHours * 3600;
  const data = `${path}:${expires}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return `${expires}-${base64UrlEncode(signature)}`;
}
__name(generateShareSignature, "generateShareSignature");
async function verifyShareSignature(path, signature, secret) {
  try {
    const parts = signature.split("-");
    if (parts.length !== 2) return false;
    const expires = parseInt(parts[0], 10);
    if (isNaN(expires) || Date.now() / 1e3 > expires) return false;
    const data = `${path}:${expires}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const signatureBytes = base64UrlDecode(parts[1]);
    return await crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(data));
  } catch {
    return false;
  }
}
__name(verifyShareSignature, "verifyShareSignature");
async function handleDownload(path, token, owner, repo) {
  if (!token) {
    return jsonResponse({ ok: false, message: "\u8BF7\u914D\u7F6E GITHUB_TOKEN" }, 500);
  }
  try {
    if (path.startsWith("release/")) {
      const assetId = path.substring("release/".length);
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
          const asset = assets.find((a) => a.id.toString() === assetId);
          if (asset) {
            const originalFilename2 = decodeStoredFilename(asset.name);
            const downloadResponse = await fetch(asset.browser_download_url, {
              headers: getGitHubHeaders(token)
            });
            if (downloadResponse.ok) {
              const contentType2 = downloadResponse.headers.get("content-type") || "application/octet-stream";
              return new Response(downloadResponse.body, {
                headers: {
                  "Content-Type": contentType2,
                  "Content-Disposition": `attachment; filename="${encodeURIComponent(originalFilename2)}"; filename*=UTF-8''${encodeURIComponent(originalFilename2)}`,
                  ...corsHeaders
                }
              });
            }
          }
        }
      }
      return jsonResponse({ ok: false, message: "\u6587\u4EF6\u672A\u627E\u5230" }, 404);
    }
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github.raw",
        "User-Agent": "Sharing-App/1.0"
      }
    });
    if (!response.ok) {
      return jsonResponse({ ok: false, message: "\u6587\u4EF6\u4E0D\u5B58\u5728" }, 404);
    }
    const storedFilename = path.split("/").pop() || "download";
    const originalFilename = decodeStoredFilename(storedFilename);
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    return new Response(response.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(originalFilename)}"; filename*=UTF-8''${encodeURIComponent(originalFilename)}`,
        ...corsHeaders
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ ok: false, message }, 500);
  }
}
__name(handleDownload, "handleDownload");
async function handlePreview(path, token, owner, repo) {
  if (!token) {
    return jsonResponse({ ok: false, message: "\u8BF7\u914D\u7F6E GITHUB_TOKEN" }, 500);
  }
  console.log("=== handlePreview called ===");
  console.log("Preview path:", path);
  console.log("Is release path:", path.startsWith("release/"));
  try {
    if (path.startsWith("release/")) {
      const assetId = path.substring("release/".length);
      console.log("Asset ID:", assetId);
      let releaseResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/files`, {
        headers: getGitHubHeaders(token)
      });
      if (!releaseResp.ok) {
        console.log('Tag "files" not found, trying latest release');
        releaseResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
          headers: getGitHubHeaders(token)
        });
      }
      if (releaseResp.ok) {
        const release = await releaseResp.json();
        console.log("Release found:", release.tag_name, "ID:", release.id);
        const assetsResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${release.id}/assets`, {
          headers: getGitHubHeaders(token)
        });
        if (assetsResp.ok) {
          const assets = await assetsResp.json();
          console.log("Assets count:", assets.length);
          const asset = assets.find((a) => a.id.toString() === assetId);
          console.log("Asset found:", asset ? asset.name : "NOT FOUND");
          if (asset) {
            const originalFilename = decodeStoredFilename(asset.name);
            const ext = originalFilename.split(".").pop()?.toLowerCase() || "";
            const downloadResponse = await fetch(asset.browser_download_url, {
              redirect: "follow"
            });
            if (downloadResponse.ok) {
              let contentType = downloadResponse.headers.get("content-type") || "application/octet-stream";
              const mimeMap = {
                "pdf": "application/pdf",
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "png": "image/png",
                "gif": "image/gif",
                "bmp": "image/bmp",
                "svg": "image/svg+xml",
                "webp": "image/webp",
                "mp4": "video/mp4",
                "webm": "video/webm",
                "mp3": "audio/mpeg",
                "wav": "audio/wav",
                "ogg": "audio/ogg"
              };
              if (mimeMap[ext]) {
                contentType = mimeMap[ext];
              }
              console.log("Preview successful, content-type:", contentType);
              const responseHeaders = {
                "Content-Type": contentType,
                "Content-Disposition": `inline; filename="${encodeURIComponent(originalFilename)}"; filename*=UTF-8''${encodeURIComponent(originalFilename)}`,
                "Cache-Control": "public, max-age=3600",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept"
              };
              return new Response(downloadResponse.body, {
                status: 200,
                headers: responseHeaders
              });
            } else {
              console.log("Failed to fetch asset content:", downloadResponse.status);
            }
          }
        } else {
          console.log("Failed to fetch assets:", assetsResp.status);
        }
      } else {
        console.log("Failed to fetch release:", releaseResp.status);
      }
    } else {
      console.log("Non-release path, using Contents API");
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github.raw",
          "User-Agent": "Sharing-App/1.0"
        }
      });
      if (!response.ok) {
        return jsonResponse({ ok: false, message: "\u6587\u4EF6\u4E0D\u5B58\u5728" }, 404);
      }
      const storedFilename = path.split("/").pop() || "download";
      const originalFilename = decodeStoredFilename(storedFilename);
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      return new Response(response.body, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(originalFilename)}"; filename*=UTF-8''${encodeURIComponent(originalFilename)}`,
          ...corsHeaders
        }
      });
    }
    return jsonResponse({ ok: false, message: "\u6587\u4EF6\u672A\u627E\u5230" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Preview error:", message);
    return jsonResponse({ ok: false, message }, 500);
  }
}
__name(handlePreview, "handlePreview");
async function handleCreateShare(request, env) {
  const secret = env.SHARE_SECRET || "sharing-app-default-secret-key-2026";
  try {
    const body = await request.json();
    const { path, expiresInHours = 24 } = body;
    if (!path) {
      return jsonResponse({ ok: false, message: "\u8BF7\u63D0\u4F9B\u6587\u4EF6\u8DEF\u5F84" }, 400);
    }
    const signature = await generateShareSignature(path, secret, expiresInHours);
    const sharePath = `${path.replace(/^\//, "")}/${signature}`;
    const shareUrl = `${new URL(request.url).origin}/s/${sharePath}`;
    const expiresAt = new Date((Math.floor(Date.now() / 1e3) + expiresInHours * 3600) * 1e3);
    return jsonResponse({
      ok: true,
      shareUrl,
      expiresAt: expiresAt.toISOString(),
      expiresInHours,
      message: `\u5206\u4EAB\u94FE\u63A5\u5DF2\u751F\u6210\uFF0C\u6709\u6548\u671F ${expiresInHours} \u5C0F\u65F6`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ ok: false, message }, 500);
  }
}
__name(handleCreateShare, "handleCreateShare");
async function handleShareAccess(request, env) {
  const secret = env.SHARE_SECRET || "sharing-app-default-secret-key-2026";
  const url = new URL(request.url);
  const sharePath = url.pathname.substring(3);
  const parts = sharePath.split("/");
  if (parts.length < 2) {
    return new Response("\u65E0\u6548\u7684\u5206\u4EAB\u94FE\u63A5", { status: 400 });
  }
  const signature = parts[parts.length - 1];
  const filePath = parts.slice(0, -1).join("/");
  const isValid = await verifyShareSignature(filePath, signature, secret);
  if (!isValid) {
    return new Response("\u5206\u4EAB\u94FE\u63A5\u5DF2\u8FC7\u671F\u6216\u65E0\u6548", { status: 403 });
  }
  const fileInfo = await getFileInfo(filePath, env.GITHUB_TOKEN, env.GITHUB_OWNER, env.GITHUB_REPO);
  if (!fileInfo) {
    return new Response("\u6587\u4EF6\u4E0D\u5B58\u5728", { status: 404 });
  }
  if (request.method === "GET") {
    return handleSharePreview(filePath, fileInfo, env);
  }
  return new Response("\u65B9\u6CD5\u4E0D\u652F\u6301", { status: 405 });
}
__name(handleShareAccess, "handleShareAccess");
async function getFileInfo(path, token, owner, repo) {
  try {
    if (path.startsWith("release/")) {
      const assetId = path.substring("release/".length);
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
          const asset = assets.find((a) => a.id.toString() === assetId);
          if (asset) {
            return {
              name: decodeStoredFilename(asset.name),
              originalName: asset.name,
              size: asset.size,
              ext: decodeStoredFilename(asset.name).split(".").pop()?.toLowerCase() || "",
              url: asset.browser_download_url
            };
          }
        }
      }
    } else {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      const response = await fetch(url, {
        headers: getGitHubHeaders(token)
      });
      if (response.ok) {
        const data = await response.json();
        return {
          name: data.name,
          originalName: data.name,
          size: data.size,
          ext: data.name.split(".").pop()?.toLowerCase() || "",
          url: `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
        };
      }
    }
  } catch {
  }
  return null;
}
__name(getFileInfo, "getFileInfo");
async function handleSharePreview(filePath, fileInfo, env) {
  const ext = fileInfo.ext;
  const previewableExts = ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "pdf", "mp4", "webm", "ogg", "mp3", "wav"];
  const isPreviewable = previewableExts.includes(ext);
  let previewContent = "";
  const downloadUrl = filePath.startsWith("release/") ? `/download/${filePath}` : `/download/${filePath}`;
  if (isPreviewable) {
    const previewUrl = filePath.startsWith("release/") ? `/preview/${filePath}` : `/preview/${filePath}`;
    if (["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"].includes(ext)) {
      previewContent = `<div class="flex items-center justify-center h-96"><img src="${previewUrl}" alt="${fileInfo.name}" class="max-w-full max-h-full object-contain rounded-lg"></div>`;
    } else if (ext === "pdf") {
      previewContent = `<div class="h-96"><iframe src="${previewUrl}" class="w-full h-full rounded-lg" frameborder="0"></iframe></div>`;
    } else if (["mp4", "webm"].includes(ext)) {
      previewContent = `<div class="flex items-center justify-center h-96"><video controls class="max-w-full max-h-full rounded-lg"><source src="${previewUrl}" type="video/${ext}"><p>\u60A8\u7684\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u89C6\u9891\u64AD\u653E</p></video></div>`;
    } else if (["mp3", "wav", "ogg"].includes(ext)) {
      previewContent = `<div class="flex flex-col items-center justify-center h-96"><div class="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6"><i class="fa fa-music text-4xl text-white/70"></i></div><audio controls class="w-full max-w-md"><source src="${previewUrl}" type="audio/${ext === "ogg" ? "ogg" : ext}"><p>\u60A8\u7684\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u97F3\u9891\u64AD\u653E</p></audio></div>`;
    }
  } else {
    previewContent = `<div class="flex items-center justify-center h-96"><div class="text-center text-white/60"><i class="fa fa-file-o text-6xl mb-4"></i><p>\u8BE5\u6587\u4EF6\u7C7B\u578B\u6682\u4E0D\u652F\u6301\u9884\u89C8</p><p class="text-sm mt-2">\u8BF7\u4E0B\u8F7D\u540E\u67E5\u770B</p></div></div>`;
  }
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>\u6587\u4EF6\u5206\u4EAB - ${fileInfo.name}</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <link href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" rel="stylesheet">
    <style>
        body { background: linear-gradient(135deg, #0f172a, #1e293b); }
        .glass { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.2); }
    </style>
</head>
<body class="min-h-screen text-white p-4 md:p-8">
    <div class="max-w-3xl mx-auto">
        <div class="glass rounded-2xl overflow-hidden">
            <div class="p-6 border-b border-white/10">
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <div class="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mr-4">
                            <i class="fa fa-share-alt text-green-400 text-xl"></i>
                        </div>
                        <div>
                            <h1 class="text-xl font-bold">\u6587\u4EF6\u5206\u4EAB</h1>
                            <p class="text-sm text-white/60">\u8FD9\u662F\u4E00\u4E2A\u5B89\u5168\u7684\u5206\u4EAB\u94FE\u63A5</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="p-6">
                <div class="glass rounded-xl p-4 mb-6">
                    <div class="flex items-center">
                        <div class="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mr-4">
                            <i class="fa ${getFileShareIcon(fileInfo.ext)} ${getFileShareIconClass(fileInfo.ext)} text-xl"></i>
                        </div>
                        <div class="flex-1">
                            <div class="font-medium text-lg break-all">${fileInfo.name}</div>
                            <div class="text-sm text-white/60 mt-1">${formatShareFileSize(fileInfo.size)}</div>
                        </div>
                    </div>
                </div>
                
                ${previewContent}
                
                <div class="mt-6 flex justify-center">
                    <a href="${downloadUrl}" class="flex items-center px-6 py-3 bg-green-500 hover:bg-green-600 rounded-lg transition-colors">
                        <i class="fa fa-download mr-2"></i>\u4E0B\u8F7D\u6587\u4EF6
                    </a>
                </div>
            </div>
            
            <div class="p-4 border-t border-white/10 text-center text-xs text-white/50">
                <p>\xA9 2026 Sharing \u6587\u4EF6\u5171\u4EAB\u5E73\u53F0</p>
            </div>
        </div>
    </div>
</body>
</html>
  `;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      ...corsHeaders
    }
  });
}
__name(handleSharePreview, "handleSharePreview");
function getFileShareIcon(ext) {
  if (!ext) return "fa-file-o";
  const icons = {
    pdf: "fa-file-pdf-o",
    doc: "fa-file-word-o",
    docx: "fa-file-word-o",
    xls: "fa-file-excel-o",
    xlsx: "fa-file-excel-o",
    ppt: "fa-file-powerpoint-o",
    pptx: "fa-file-powerpoint-o",
    jpg: "fa-file-image-o",
    jpeg: "fa-file-image-o",
    png: "fa-file-image-o",
    gif: "fa-file-image-o",
    bmp: "fa-file-image-o",
    svg: "fa-file-image-o",
    mp4: "fa-file-video-o",
    avi: "fa-file-video-o",
    mov: "fa-file-video-o",
    mp3: "fa-file-audio-o",
    wav: "fa-file-audio-o",
    zip: "fa-file-archive-o",
    rar: "fa-file-archive-o",
    "7z": "fa-file-archive-o",
    js: "fa-file-code-o",
    html: "fa-file-code-o",
    css: "fa-file-code-o",
    json: "fa-file-code-o"
  };
  return icons[ext] || "fa-file-o";
}
__name(getFileShareIcon, "getFileShareIcon");
function getFileShareIconClass(ext) {
  if (!ext) return "text-gray-400";
  const classes = {
    pdf: "text-red-400",
    doc: "text-blue-400",
    docx: "text-blue-400",
    xls: "text-green-400",
    xlsx: "text-green-400",
    ppt: "text-orange-400",
    pptx: "text-orange-400",
    jpg: "text-purple-400",
    jpeg: "text-purple-400",
    png: "text-purple-400",
    gif: "text-purple-400",
    bmp: "text-purple-400",
    svg: "text-purple-400",
    mp4: "text-yellow-400",
    avi: "text-yellow-400",
    mov: "text-yellow-400",
    mp3: "text-pink-400",
    wav: "text-pink-400",
    zip: "text-orange-400",
    rar: "text-orange-400",
    "7z": "text-orange-400",
    js: "text-yellow-400",
    html: "text-yellow-400",
    css: "text-yellow-400",
    json: "text-yellow-400"
  };
  return classes[ext] || "text-gray-400";
}
__name(getFileShareIconClass, "getFileShareIconClass");
function formatShareFileSize(bytes) {
  if (bytes === 0 || !bytes) return "--";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
__name(formatShareFileSize, "formatShareFileSize");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
