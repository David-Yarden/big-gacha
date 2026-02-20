$ProjectDir  = $PSScriptRoot
$BackendPort  = 5000
$FrontendPort = 3000

# ── Start backend if not already listening ────────────────────────────────────
$backendUp = Get-NetTCPConnection -LocalPort $BackendPort -State Listen -ErrorAction SilentlyContinue
if (-not $backendUp) {
    Start-Process "cmd.exe" `
        -ArgumentList "/c cd /d `"$ProjectDir`" && npm run dev" `
        -WindowStyle Minimized
}

# ── Start frontend if not already listening ───────────────────────────────────
$frontendUp = Get-NetTCPConnection -LocalPort $FrontendPort -State Listen -ErrorAction SilentlyContinue
$waitForVite = -not $frontendUp
if ($waitForVite) {
    Start-Process "cmd.exe" `
        -ArgumentList "/c cd /d `"$ProjectDir\client`" && npm run dev" `
        -WindowStyle Minimized
}

# ── Poll until Vite is ready, then open browser ───────────────────────────────
if ($waitForVite) {
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 1
        $up = Get-NetTCPConnection -LocalPort $FrontendPort -State Listen -ErrorAction SilentlyContinue
        if ($up) { break }
    }
}

Start-Process "http://localhost:$FrontendPort"
