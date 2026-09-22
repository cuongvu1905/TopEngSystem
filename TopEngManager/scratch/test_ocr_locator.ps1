param(
    [string]$TargetText = "",
    [string]$WindowTitleHint = ""
)

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient

[Windows.Media.Ocr.OcrEngine, Windows.Foundation.FoundationContract, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation.FoundationContract, ContentType = WindowsRuntime] | Out-Null

function Normalize-Text([string]$str) {
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

Write-Output "OCR Locator Ready"
