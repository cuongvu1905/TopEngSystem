Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement

$condition = [System.Windows.Automation.Condition]::TrueCondition
$windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $condition)

Write-Output "Found windows count: $($windows.Count)"
foreach ($win in $windows) {
    $name = $win.Current.Name
    $rect = $win.Current.BoundingRectangle
    if ($name -and $rect.Width -gt 50) {
        Write-Output "WIN: '$name' | Rect: $($rect.X), $($rect.Y), $($rect.Width), $($rect.Height)"
    }
}
