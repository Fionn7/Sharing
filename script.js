const SEASONS = {
  spring: { name: '春', particle: 'petal', themeTint: 'rgba(255,220,230,' },
  summer: { name: '夏', particle: 'leaf', themeTint: 'rgba(200,240,200,' },
  autumn: { name: '秋', particle: 'ginkgo', themeTint: 'rgba(255,220,140,' },
  winter: { name: '冬', particle: 'snow', themeTint: 'rgba(220,235,255,' }
};

const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];
const slides = document.querySelectorAll('.bg-slide');
const seasonBtns = document.querySelectorAll('.season-btn');
const seasonIndicator = document.getElementById('seasonIndicator');
const toggleBtn = document.getElementById('toggleBtn');
const clockEl = document.getElementById('footClock');
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');

let currentIdx = 0;
let autoPlay = true;
let autoTimer = null;
const SWITCH_MS = 7000;

function setSeason(seasonKey) {
  currentIdx = SEASON_ORDER.indexOf(seasonKey);
  const data = SEASONS[seasonKey];

  slides.forEach(function (s) { s.classList.remove('is-active'); });
  const activeSlide = document.querySelector('.bg-slide[data-season="' + seasonKey + '"]');
  if (activeSlide) {
    activeSlide.style.animation = 'none';
    activeSlide.offsetHeight;
    activeSlide.classList.add('is-active');
  }

  seasonBtns.forEach(function (b) {
    b.classList.toggle('is-active', b.dataset.season === seasonKey);
  });

  seasonIndicator.textContent = data.name;
  currentParticleType = data.particle;
  currentTint = data.themeTint;
  reinitParticles();
}

function nextSeason() {
  const next = SEASON_ORDER[(currentIdx + 1) % SEASON_ORDER.length];
  setSeason(next);
}

function startAuto() {
  stopAuto();
  if (autoPlay) autoTimer = setInterval(nextSeason, SWITCH_MS);
}

function stopAuto() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = null;
}

seasonBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    setSeason(btn.dataset.season);
    if (autoPlay) startAuto();
  });
});

toggleBtn.addEventListener('click', function () {
  autoPlay = !autoPlay;
  toggleBtn.setAttribute('aria-pressed', String(autoPlay));
  if (autoPlay) startAuto(); else stopAuto();
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextSeason(); }
  else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    const prev = SEASON_ORDER[(currentIdx - 1 + SEASON_ORDER.length) % SEASON_ORDER.length];
    setSeason(prev);
  }
});

function tickClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  clockEl.textContent = h + ':' + m;
}
tickClock();
setInterval(tickClock, 15000);

let particles = [];
let currentParticleType = 'petal';
let currentTint = 'rgba(255,220,230,';
let W = 0, H = 0;
const DPR = Math.min(window.devicePixelRatio || 1, 2);

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
resize();
window.addEventListener('resize', function () { resize(); reinitParticles(); });

function reinitParticles() {
  particles.length = 0;
  const areaCount = Math.round((W * H) / 28000);
  const target = Math.max(22, Math.min(80, areaCount));
  for (let i = 0; i < target; i++) {
    particles.push(makeParticle());
  }
}

function makeParticle() {
  const type = currentParticleType;
  const base = {
    x: Math.random() * W,
    y: Math.random() * H - H * 0.2,
    size: 2 + Math.random() * 5,
    drift: Math.random() * 0.6 + 0.2,
    speedY: 0.3 + Math.random() * 0.8,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.03,
    wobble: Math.random() * 2 + 1
  };
  if (type === 'petal') {
    base.speedY = 0.4 + Math.random() * 0.8;
    base.color = currentTint + (0.55 + Math.random() * 0.35) + ')';
  } else if (type === 'leaf') {
    base.color = currentTint + (0.45 + Math.random() * 0.35) + ')';
    base.speedY = 0.25 + Math.random() * 0.6;
  } else if (type === 'ginkgo') {
    base.color = currentTint + (0.6 + Math.random() * 0.35) + ')';
    base.size = 3 + Math.random() * 6;
    base.speedY = 0.5 + Math.random() * 0.8;
  } else {
    base.color = 'rgba(255,255,255,' + (0.55 + Math.random() * 0.35) + ')';
    base.size = 1.5 + Math.random() * 3.5;
    base.speedY = 0.4 + Math.random() * 0.7;
  }
  return base;
}

function draw(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);

  if (currentParticleType === 'petal') {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 0.8, p.size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (currentParticleType === 'leaf') {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (currentParticleType === 'ginkgo') {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, p.size * 0.6);
    ctx.quadraticCurveTo(-p.size, 0, 0, -p.size * 0.8);
    ctx.quadraticCurveTo(p.size * 0.8, -p.size * 0.4, 0, p.size * 0.6);
    ctx.fill();
  } else {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function tick() {
  ctx.clearRect(0, 0, W, H);
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.x += Math.sin(p.rot) * p.drift;
    p.y += p.speedY;
    p.rot += p.rotSpeed;
    if (p.y > H + 20 || p.x < -20 || p.x > W + 20) {
      particles[i] = makeParticle();
      particles[i].y = -20;
      particles[i].x = Math.random() * W;
    }
    draw(p);
  }
  requestAnimationFrame(tick);
}

reinitParticles();
tick();
startAuto();

document.addEventListener('visibilitychange', function () {
  if (document.hidden) { stopAuto(); } else if (autoPlay) { startAuto(); }
});

const GITHUB_USERNAME = "Fionn7";
const GITHUB_REPO = "Sharing";
const PDF_FOLDER = "pdfs";
const API_BASE = 'https://sharing-h7es.onrender.com';

const FILE_CATEGORIES = {
  pdfs: { name: 'PDF文档', icon: '📄', color: '#333' },
  documents: { name: '文档', icon: '📝', color: '#333' },
  images: { name: '图片', icon: '🖼️', color: '#333' },
  videos: { name: '视频', icon: '🎬', color: '#333' },
  audio: { name: '音频', icon: '🎵', color: '#333' },
  archives: { name: '压缩包', icon: '📦', color: '#333' },
  codes: { name: '代码', icon: '💻', color: '#333' },
  others: { name: '其他', icon: '📁', color: '#333' }
};

function getFileCategory(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const categories = {
    pdf: 'pdfs', doc: 'documents', docx: 'documents',
    xls: 'documents', xlsx: 'documents',
    ppt: 'documents', pptx: 'documents', txt: 'documents',
    jpg: 'images', jpeg: 'images', png: 'images', gif: 'images', bmp: 'images', svg: 'images',
    mp4: 'videos', avi: 'videos', mov: 'videos', wmv: 'videos',
    mp3: 'audio', wav: 'audio', flac: 'audio',
    zip: 'archives', rar: 'archives', '7z': 'archives', tar: 'archives', gz: 'archives',
    js: 'codes', html: 'codes', css: 'codes', json: 'codes', py: 'codes', java: 'codes', cpp: 'codes', c: 'codes', xml: 'codes'
  };
  return categories[ext] || 'others';
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    pdf: '📄', doc: '📝', docx: '📝',
    xls: '📊', xlsx: '📊', ppt: '📽️', pptx: '📽️', txt: '📃',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', bmp: '🖼️', svg: '🖼️',
    mp4: '🎬', avi: '🎬', mov: '🎬', wmv: '🎬',
    mp3: '🎵', wav: '🎵', flac: '🎵',
    zip: '📦', rar: '📦', '7z': '📦', tar: '📦', gz: '📦',
    js: '💻', html: '💻', css: '💻', json: '💻', py: '💻', java: '💻', cpp: '💻', c: '💻', xml: '💻'
  };
  return icons[ext] || '📁';
}

const fileInput = document.getElementById('file-input');
const statusDiv = document.getElementById('status');
const fileListDiv = document.getElementById('file-list');
const uploadProgressDiv = document.getElementById('upload-progress');

async function loadFileList() {
  try {
    const response = await fetch(`${API_BASE}/api/files`);
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      throw new Error(result.message || '加载失败');
    }

    const files = Array.isArray(result.files) ? result.files : [];
    fileListDiv.innerHTML = '';

    if (files.length === 0) {
      fileListDiv.innerHTML = '<p>当前还没有上传的文件。</p>';
      return;
    }

    const categorizedFiles = {};
    files.forEach(file => {
      const category = getFileCategory(file.name);
      if (!categorizedFiles[category]) { categorizedFiles[category] = []; }
      categorizedFiles[category].push(file);
    });

    Object.keys(categorizedFiles).forEach(category => {
      const categoryInfo = FILE_CATEGORIES[category] || FILE_CATEGORIES.others;
      const categoryDiv = document.createElement('div');
      categoryDiv.className = 'file-category';
      categoryDiv.innerHTML = `
        <h3 class="category-title">${categoryInfo.icon} ${categoryInfo.name} (${categorizedFiles[category].length})</h3>
        <div class="category-files"></div>
      `;

      const filesContainer = categoryDiv.querySelector('.category-files');
      categorizedFiles[category].forEach(file => {
        const fileUrl = file.download_url || `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/main/${category}/${file.name}`;
        const icon = getFileIcon(file.name);
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
          <span class="file-icon">${icon}</span>
          <a href="${fileUrl}" target="_blank" rel="noopener">${file.name}</a>
          <button type="button" class="delete-btn" data-name="${file.name}" data-category="${category}">删除</button>
        `;
        filesContainer.appendChild(item);
      });

      fileListDiv.appendChild(categoryDiv);
    });
  } catch (error) {
    fileListDiv.innerHTML = `<p>加载文件列表失败：${error.message || '请稍后重试'}</p>`;
  }
}

function createFileStatusItem(fileName, fileSize) {
  const item = document.createElement('div');
  item.className = 'file-status uploading';
  const sizeStr = fileSize > 1024 * 1024 
    ? (fileSize / 1024 / 1024).toFixed(1) + 'MB' 
    : (fileSize / 1024).toFixed(0) + 'KB';
  item.innerHTML = `
    <span class="status-icon">⏳</span>
    <span class="file-name" title="${fileName}">${fileName}</span>
    <div class="progress-container">
      <div class="mini-progress">
        <div class="mini-progress-bar" style="width: 0%"></div>
      </div>
      <span class="progress-text">0%</span>
    </div>
  `;
  return item;
}

function uploadFileWithProgress(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('filename', file.name);

    xhr.timeout = 30000;

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      try {
        const result = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && result.ok) {
          resolve(result);
        } else {
          let errorMsg = result.message || '上传失败';
          if (result.details) { errorMsg += ' (' + xhr.status + ')'; }
          reject(new Error(errorMsg));
        }
      } catch (e) {
        reject(new Error('服务器响应格式错误 (' + xhr.status + ')'));
      }
    });

    xhr.addEventListener('error', () => { reject(new Error('网络错误')); });
    xhr.addEventListener('timeout', () => { reject(new Error('上传超时')); });

    xhr.open('POST', `${API_BASE}/api/upload`);
    xhr.send(formData);
  });
}

fileInput.addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  const maxSize = 50 * 1024 * 1024;
  for (const file of files) {
    if (file.size > maxSize) {
      const sizeStr = (file.size / 1024 / 1024).toFixed(1) + 'MB';
      statusDiv.innerHTML = `<p style="color: red;">文件 ${file.name} (${sizeStr}) 超过 50MB 限制。</p>`;
      return;
    }
  }

  statusDiv.innerHTML = `<p style="color: #666;">正在上传 ${files.length} 个文件...</p>`;
  uploadProgressDiv.innerHTML = '';

  const fileStatusItems = [];
  for (const file of files) {
    const item = createFileStatusItem(file.name, file.size);
    uploadProgressDiv.appendChild(item);
    fileStatusItems.push({ file, item });
  }

  let successCount = 0;
  let failCount = 0;

  for (const { file, item } of fileStatusItems) {
    try {
      await uploadFileWithProgress(file, (percent) => {
        const bar = item.querySelector('.mini-progress-bar');
        const text = item.querySelector('.progress-text');
        bar.style.width = percent + '%';
        text.textContent = percent + '%';
      });

      item.className = 'file-status success';
      item.querySelector('.status-icon').textContent = '✅';
      item.querySelector('.mini-progress-bar').style.width = '100%';
      item.querySelector('.progress-text').textContent = '完成';
      successCount++;
    } catch (error) {
      item.className = 'file-status error';
      item.querySelector('.status-icon').textContent = '❌';
      item.querySelector('.progress-text').textContent = '失败';
      failCount++;
    }
  }

  if (failCount === 0) {
    statusDiv.innerHTML = `<p style="color: green;">全部 ${successCount} 个文件上传成功！</p>`;
  } else {
    statusDiv.innerHTML = `<p style="color: orange;">上传完成：成功 ${successCount} 个，失败 ${failCount} 个</p>`;
  }

  setTimeout(() => { uploadProgressDiv.innerHTML = ''; }, 5000);
  loadFileList();
});

fileListDiv.addEventListener('click', async (e) => {
  const button = e.target.closest('.delete-btn');
  if (!button) return;

  const name = button.dataset.name;
  const category = button.dataset.category;
  if (!name) return;

  if (!window.confirm(`确认删除 ${name} 吗？`)) return;

  statusDiv.innerHTML = `<p>正在删除 ${name}...</p>`;

  try {
    const deleteUrl = category 
      ? `${API_BASE}/api/files/${encodeURIComponent(name)}?category=${encodeURIComponent(category)}`
      : `${API_BASE}/api/files/${encodeURIComponent(name)}`;
    const response = await fetch(deleteUrl, { method: 'DELETE' });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      throw new Error(result.message || '删除失败');
    }

    statusDiv.innerHTML = `<p style="color: green;">已删除 ${name}</p>`;
    loadFileList();
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: red;">删除失败：${error.message || '请稍后重试'}</p>`;
  }
});

loadFileList();