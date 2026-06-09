param(
    [string]$Message = "Update files"
)

# 生成当前时间戳
$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Write-Host "======================================"
Write-Host "        Git 自动同步脚本"
Write-Host "======================================"
Write-Host ""

# 检查是否在 Git 仓库中
if (-not (Test-Path ".git")) {
    Write-Host "❌ 错误：当前目录不是 Git 仓库" -ForegroundColor Red
    exit 1
}

# 切换到 main 分支
Write-Host "🔄 切换到 main 分支..." -ForegroundColor Cyan
git checkout main

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 切换分支失败" -ForegroundColor Red
    exit 1
}

# 拉取远程最新代码
Write-Host "📥 拉取远程最新代码..." -ForegroundColor Cyan
git pull origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 拉取失败，可能有冲突需要手动处理" -ForegroundColor Yellow
}

# 添加所有更改
Write-Host "📝 添加所有更改..." -ForegroundColor Cyan
git add .

# 提交更改（消息自动追加当前时间）
$CommitMessage = "$Message [$Timestamp]"
Write-Host "💾 提交更改: $CommitMessage" -ForegroundColor Cyan
git commit -m $CommitMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ 没有需要提交的更改" -ForegroundColor Yellow
    exit 0
}

# 推送到远程仓库
Write-Host "📤 推送到远程仓库..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ 同步成功！" -ForegroundColor Green
    Write-Host "======================================"
} else {
    Write-Host ""
    Write-Host "❌ 推送失败" -ForegroundColor Red
    Write-Host "======================================"
    exit 1
}
