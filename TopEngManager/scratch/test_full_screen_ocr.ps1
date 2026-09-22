Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

[Windows.Media.Ocr.OcrEngine, Windows.Foundation.FoundationContract, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation.FoundationContract, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation.FoundationContract, ContentType = WindowsRuntime] | Out-Null

function Capture-ScreenToSoftwareBitmap {
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

    $randAccessStream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
    $writer = New-Object Windows.Storage.Streams.DataWriter($randAccessStream)
    $writer.WriteBytes($bytes)
    $null = $writer.StoreAsync().GetAwaiter().GetResult()
    $writer.DetachStream() | Out-Null
    $randAccessStream.Seek(0)

    $decoder = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($randAccessStream).GetAwaiter().GetResult()
    $softwareBmp = $decoder.GetSoftwareBitmapAsync().GetAwaiter().GetResult()
    return $softwareBmp
}

function Run-OcrOnScreen {
    try {
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
        if (-not $engine) {
            $lang = [Windows.Globalization.Language]::new("en-US")
            $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
        }

        $softBmp = Capture-ScreenToSoftwareBitmap
        $ocrResult = $engine.RecognizeAsync($softBmp).GetAwaiter().GetResult()

        $elements = @()
        foreach ($line in $ocrResult.Lines) {
            $lineRect = $line.Words[0].BoundingRect
            $lineText = $line.Text
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

            $elements += [PSCustomObject]@{
                text = $lineText
                x = [int]$minX
                y = [int]$minY
                width = [int]($maxX - $minX)
                height = [int]($maxY - $minY)
            }
        }

        Write-Output ($elements | ConvertTo-Json -Compress)
    } catch {
        Write-Error $_.Exception.Message
    }
}

Run-OcrOnScreen
