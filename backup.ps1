<#
.SYNOPSIS
    Sharing 仓库备份 / 还原脚本。
    基线版本：d66ddbe（当前 origin/main），程序更新失败时可一键回到此版本。

.USAGE
    ./backup.ps1              # 默认：备份当前状态到 backup/<时间戳> 分支
    ./backup.ps1 backup       # 同上
    ./backup.ps1 restore      # 还原 main 到基线版本 d66ddbe（自动先备份当前状态）
    ./backup.ps1 status       # 查看基线、当前 HEAD、main、origin/main
    ./backup.ps1 list         # 列出所有 backup/* 分支
#>
param(
    [ValidateSet("backup", "restore", "status", "list")]
    [string]$Action = "backup"
)

# 基线版本（一键回到此版本）
$Baseline     = "d66ddbe0e4b042a35b5c5d04ab0a3b859a8534ca"
$BaselineTag  = "baseline"

function Write-Section($t) {
    Write-Host ""
    Write-Host "====== $t ======" -ForegroundColor Cyan
}

function Ensure-BaselineTag {
    git rev-parse --verify --quiet "refs/tags/$BaselineTag" 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        git tag $BaselineTag $Baseline 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] 已创建基线标签 '$BaselineTag' -> d66ddbe" -ForegroundColor Green
        } else {
            Write-Host "[WARN] 创建基线标签失败，请确认提交 $Baseline 存在" -ForegroundColor Yellow
        }
    }
}

function New-BackupBranch {
    $ts   = Get-Date -Format "yyyyMMdd-HHmmss"
    $name = "backup/$ts"
    git branch $name HEAD 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] 已备份当前状态到分支 '$name'" -ForegroundColor Green
        return $name
    } else {
        Write-Host "[WARN] 备份分支创建失败" -ForegroundColor Yellow
        return $null
    }
}

# 检查是否在 Git 仓库中
if (-not (Test-Path ".git")) {
    Write-Host "[ERR] 当前目录不是 Git 仓库" -ForegroundColor Red
    exit 1
}

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "        Sharing 备份 / 还原脚本" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "基线版本: d66ddbe ($Baseline)" -ForegroundColor DarkGray

Ensure-BaselineTag

switch ($Action) {
    "backup" {
        Write-Section "备份当前状态"
        $null = New-BackupBranch
        Write-Host "[TIP] 更新程序前先运行本命令；如需回到基线版本，运行: ./backup.ps1 restore" -ForegroundColor DarkGray
    }

    "restore" {
        Write-Section "还原到基线版本 d66ddbe"
        # 还原前自动备份当前状态，确保不丢失更新后的代码
        $b = New-BackupBranch

        # 切到 main（若已在 main 则无影响）
        git checkout main 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERR] 切换到 main 失败，可能有未跟踪文件冲突，请手动处理后重试" -ForegroundColor Red
            exit 1
        }

        Write-Host "重置 main 到 '$BaselineTag' ..." -ForegroundColor Cyan
        git reset --hard "$BaselineTag" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[WARN] 按标签重置失败，尝试用完整哈希重置 ..." -ForegroundColor Yellow
            git reset --hard $Baseline 2>&1
        }

        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "[OK] main 已回到基线版本 d66ddbe" -ForegroundColor Green
            Write-Host "     受跟踪的源码已还原；node_modules/.env 等未跟踪文件保持不变" -ForegroundColor DarkGray
            if ($b) {
                Write-Host "     更新前的代码已保留在分支: $b（可用 git checkout $b 查看）" -ForegroundColor DarkGray
            }
            Write-Host ""
            Write-Host "[NOTE] 若更新已推送到远程，还原后需强制推送以同步远程:" -ForegroundColor Yellow
            Write-Host "       git push --force-with-lease origin main" -ForegroundColor Yellow
        } else {
            Write-Host "[ERR] 还原失败" -ForegroundColor Red
            exit 1
        }
    }

    "status" {
        Write-Section "状态"
        $baseTag  = (git rev-parse --short "refs/tags/$BaselineTag" 2>$null)
        $head     = (git rev-parse --short HEAD 2>$null)
        $main     = (git rev-parse --short main 2>$null)
        $origin   = (git rev-parse --short origin/main 2>$null)
        Write-Host ("基线标签 {0,-8} -> {1}" -f $BaselineTag, $baseTag)
        Write-Host ("当前 HEAD      -> {0}" -f $head)
        Write-Host ("main           -> {0}" -f $main)
        Write-Host ("origin/main    -> {0}" -f $origin)
        Write-Section "工作区"
        git status -sb
    }

    "list" {
        Write-Section "已有备份分支 (backup/*)"
        $branches = git branch --list "backup/*"
        if ($branches) { $branches } else { Write-Host "（暂无备份分支）" -ForegroundColor DarkGray }
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
