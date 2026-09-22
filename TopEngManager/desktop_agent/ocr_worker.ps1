param(
    [string]$TargetKeyword = "",
    [string]$WindowTitleHint = "Top Engineering Vina"
)

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

[Windows.Media.Ocr.OcrEngine, Windows.Foundation.FoundationContract, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation.FoundationContract, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation.FoundationContract, ContentType = WindowsRuntime] | Out-Null

function Remove-Diacritics([string]$str) {
    if (-not $str) { return "" }
    $normalized = $str.Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($c in $normalized.ToCharArray()) {
        $uc = [System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($c)
        if ($uc -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$sb.Append($c)
        }
    }
    return $sb.ToString().Normalize([System.Text.NormalizationForm]::FormC).ToLower().Trim()
}

function Find-OcrElementOnScreen([string]$keyword) {
    try {
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
        if (-not $engine) {
            $lang = [Windows.Globalization.Language]::new("en-US")
            $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
        }

        # 1. Capture screen
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
        $g.Dispose()

        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        $bytes = $ms.ToArray()
        $ms.Dispose()

        # 2. Decode SoftwareBitmap for WinRT OCR
        $randAccessStream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
        $writer = New-Object Windows.Storage.Streams.DataWriter($randAccessStream)
        $writer.WriteBytes($bytes)
        $null = $writer.StoreAsync().GetAwaiter().GetResult()
        $writer.DetachStream() | Out-Null
        $randAccessStream.Seek(0)

        $decoder = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($randAccessStream).GetAwaiter().GetResult()
        $softwareBmp = $decoder.GetSoftwareBitmapAsync().GetAwaiter().GetResult()

        # 3. Perform OCR
        $ocrResult = $engine.RecognizeAsync($softwareBmp).GetAwaiter().GetResult()

        $kwClean = Remove-Diacritics $keyword
        $kwTokens = $kwClean.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)

        $bestMatch = $null
        $bestScore = 0

        foreach ($line in $ocrResult.Lines) {
            $lineClean = Remove-Diacritics $line.Text
            if (-not $lineClean) { continue }

            # Calculate match score
            $matchCount = 0
            foreach ($token in $kwTokens) {
                if ($lineClean.Contains($token)) {
                    $matchCount++
                }
            }

            if ($matchCount -gt $bestScore) {
                $bestScore = $matchCount
                
                # Calculate bounding box of line
                $minX = 999999
                $minY = 999999
                $maxX = 0
                $maxY = 0

                foreach ($w in $line.Words) {
                    $r = $w.BoundingRect
                    if ($r.X -lt $minX) { $minX = $r.X }
                    if ($r.Y -lt $minY) { $minY = $r.Y }
                    if (($r.X + $r.Width) -gt $maxX) { $maxX = $r.X + $r.Width }
                    if (($r.Y + $r.Height) -gt $maxY) { $maxY = $r.Y + $r.Height }
                }

                $bestMatch = [PSCustomObject]@{
                    found = $true
                    text = $line.Text
                    x = [int]$minX
                    y = [int]$minY
                    width = [int]($maxX - $minX)
                    height = [int]($maxY - $minY)
                    score = $matchCount
                }
            }
        }

        if ($bestMatch -and $bestScore -gt 0) {
            return ($bestMatch | ConvertTo-Json -Compress)
        }
        
        return '{"found": false}'
    } catch {
        return '{"found": false, "error": "' + $_.Exception.Message + '"}'
    }
}

if ($TargetKeyword) {
    Find-OcrElementOnScreen $TargetKeyword
} else {
    Write-Output '{"found": false, "error": "No keyword provided"}'
}
