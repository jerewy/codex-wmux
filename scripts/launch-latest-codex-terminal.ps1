param(
  [switch]$PrintPath,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Arguments
)

$argsForLauncher = @()
if ($PrintPath) {
  $argsForLauncher += '-PrintPath'
}
$argsForLauncher += $Arguments

powershell -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\launch-latest-wmux.ps1" @argsForLauncher
exit $LASTEXITCODE
