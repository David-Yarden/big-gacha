# Big Gacha launcher — no terminal windows.
# Starts the API (port 5000) and the site (port 3000) hidden, writes their output to
# cache\logs\, opens the browser and puts a Big Gacha icon in the notification area
# (next to the clock): right-click it to open the site, read the logs, restart the server
# or shut everything down. The site's power button (top right) shuts down the same way.
# Launched by the desktop shortcut (see "Create Shortcut.ps1"); run it again while
# Big Gacha is running and it just opens the site.

param([switch]$NoBrowser)

$ProjectDir   = $PSScriptRoot
$BackendPort  = 5000
$FrontendPort = 3000
$SiteUrl      = "http://localhost:$FrontendPort"
$CacheDir     = Join-Path $ProjectDir "cache"
$LogDir       = Join-Path $CacheDir "logs"
$StopFile     = Join-Path $CacheDir "stop-request"
$TrayFile     = Join-Path $CacheDir "tray.pid"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# ── One icon at a time: a second launch only opens the site ───────────────────
$created = $false
$mutex = New-Object System.Threading.Mutex($true, "Local\BigGachaTray", [ref]$created)
if (-not $created) {
    Start-Process $SiteUrl
    exit
}

function Test-Port($port) {
    [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

# ── Start what is not running yet, hidden, output to the logs ─────────────────
$started = @()
Remove-Item $StopFile -ErrorAction SilentlyContinue
if (-not (Test-Port $BackendPort)) {
    $started += Start-Process "cmd.exe" -WindowStyle Hidden -PassThru -WorkingDirectory $ProjectDir `
        -ArgumentList "/c npm run dev > `"$LogDir\server.log`" 2>&1"
}
$waitForSite = -not (Test-Port $FrontendPort)
if ($waitForSite) {
    $started += Start-Process "cmd.exe" -WindowStyle Hidden -PassThru -WorkingDirectory (Join-Path $ProjectDir "client") `
        -ArgumentList "/c npm run dev > `"$LogDir\site.log`" 2>&1"
}
Set-Content -Path $TrayFile -Value $PID

if (-not $NoBrowser) {
    if ($waitForSite) {
        $deadline = (Get-Date).AddSeconds(40)
        while ((Get-Date) -lt $deadline -and -not (Test-Port $FrontendPort)) { Start-Sleep -Milliseconds 500 }
    }
    Start-Process $SiteUrl
}

# ── Notification-area icon ────────────────────────────────────────────────────
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$tray = New-Object System.Windows.Forms.NotifyIcon
$ico  = Join-Path $ProjectDir "BIG_GACHA_LOGO.ico"
$png  = Join-Path $ProjectDir "client\public\BIG_GACHA_LOGO.png"
if (Test-Path $ico) {
    $tray.Icon = New-Object System.Drawing.Icon($ico)
} elseif (Test-Path $png) {
    $tray.Icon = [System.Drawing.Icon]::FromHandle((New-Object System.Drawing.Bitmap((New-Object System.Drawing.Bitmap($png)), 64, 64)).GetHicon())
} else {
    $tray.Icon = [System.Drawing.SystemIcons]::Application
}
$tray.Text = "Big Gacha"
$tray.Visible = $true

function Stop-Tree($procId) {
    if ($procId) { & taskkill.exe /PID $procId /T /F 2>$null | Out-Null }
}

function Stop-BigGacha {
    $timer.Stop()
    # What this launcher started, then whatever still listens on the two ports
    foreach ($p in $started) { Stop-Tree $p.Id }
    foreach ($port in @($BackendPort, $FrontendPort)) {
        Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Tree $_ }
    }
    Remove-Item $StopFile, $TrayFile -ErrorAction SilentlyContinue
    $tray.Visible = $false
    $tray.Dispose()
    [System.Windows.Forms.Application]::Exit()
}

$menu = New-Object System.Windows.Forms.ContextMenuStrip

$open = $menu.Items.Add("Ouvrir Big Gacha")
$open.Font = New-Object System.Drawing.Font($open.Font, [System.Drawing.FontStyle]::Bold)
$open.Add_Click({ Start-Process $SiteUrl })

$logs = $menu.Items.Add("Journaux du serveur")
$logs.Add_Click({ Start-Process "notepad.exe" "`"$LogDir\server.log`"" })

$restart = $menu.Items.Add("Redémarrer le serveur")
$restart.Add_Click({
    try {
        Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$BackendPort/api/admin/restart" -Headers @{ "X-Big-Gacha" = "1" } | Out-Null
        $tray.ShowBalloonTip(3000, "Big Gacha", "Le serveur redémarre.", [System.Windows.Forms.ToolTipIcon]::Info)
    } catch {
        $tray.ShowBalloonTip(4000, "Big Gacha", "Redémarrage impossible : $($_.Exception.Message)", [System.Windows.Forms.ToolTipIcon]::Warning)
    }
})

[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
$quit = $menu.Items.Add("Éteindre Big Gacha")
$quit.Add_Click({ Stop-BigGacha })

$tray.ContextMenuStrip = $menu
$tray.Add_MouseDoubleClick({ Start-Process $SiteUrl })

# The site's power button asks through a file (POST /api/admin/shutdown writes it)
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1000
$timer.Add_Tick({ if (Test-Path $StopFile) { Stop-BigGacha } })
$timer.Start()

$tray.ShowBalloonTip(4000, "Big Gacha", "Big Gacha tourne en arrière-plan. Clic droit sur cette icône pour l'éteindre.", [System.Windows.Forms.ToolTipIcon]::Info)

$context = New-Object System.Windows.Forms.ApplicationContext
[System.Windows.Forms.Application]::Run($context)
$mutex.ReleaseMutex()
