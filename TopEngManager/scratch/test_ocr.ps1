# Test Windows 10/11 Native WinRT OCR via PowerShell
[Windows.Media.Ocr.OcrEngine, Windows.Foundation.FoundationContract, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation.FoundationContract, ContentType = WindowsRuntime] | Out-Null

$languages = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages
Write-Output "Available OCR Languages: $($languages.LanguageTag -join ', ')"
