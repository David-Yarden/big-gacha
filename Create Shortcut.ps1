# Run this script once to create the Big Gacha desktop shortcut.
# After it runs, right-click the shortcut on your Desktop and choose "Pin to taskbar".

$ProjectDir    = "C:\Repository\Big Gacha"
$PngPath       = "$ProjectDir\client\public\BIG_GACHA_LOGO.png"
$IcoPath       = "$ProjectDir\BIG_GACHA_LOGO.ico"
$LaunchScript  = "$ProjectDir\launch.ps1"
$ShortcutPath  = [Environment]::GetFolderPath("Desktop") + "\Big Gacha.lnk"

# ── Convert PNG → ICO (PNG-in-ICO, Windows Vista+) ───────────────────────────
Add-Type -AssemblyName System.Drawing

$img    = [System.Drawing.Image]::FromFile($PngPath)
$bitmap = New-Object System.Drawing.Bitmap($img, 256, 256)

$ms = New-Object System.IO.MemoryStream
$bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = $ms.ToArray()
$ms.Close()
$bitmap.Dispose()
$img.Dispose()

$stream = [System.IO.File]::Create($IcoPath)
$writer = New-Object System.IO.BinaryWriter($stream)

# ICONDIR (6 bytes)
$writer.Write([uint16]0)    # reserved
$writer.Write([uint16]1)    # type: icon
$writer.Write([uint16]1)    # image count

# ICONDIRENTRY (16 bytes)
$writer.Write([byte]0)      # width  (0 = 256)
$writer.Write([byte]0)      # height (0 = 256)
$writer.Write([byte]0)      # color count
$writer.Write([byte]0)      # reserved
$writer.Write([uint16]1)    # planes
$writer.Write([uint16]32)   # bits per pixel
$writer.Write([uint32]$pngBytes.Length)   # image data size
$writer.Write([uint32]22)   # image data offset (6 + 16)

# PNG image data
$writer.Write($pngBytes)
$writer.Close()
$stream.Close()

Write-Host "Icon saved to: $IcoPath"

# ── Create desktop shortcut ───────────────────────────────────────────────────
$wsh      = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($ShortcutPath)
$shortcut.TargetPath      = "powershell.exe"
$shortcut.Arguments       = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$LaunchScript`""
$shortcut.WorkingDirectory = $ProjectDir
$shortcut.IconLocation    = "$IcoPath,0"
$shortcut.Description     = "Launch Big Gacha"
$shortcut.Save()

Write-Host "Shortcut created: $ShortcutPath"
Write-Host ""
Write-Host "Right-click 'Big Gacha' on your Desktop and select 'Pin to taskbar'."
