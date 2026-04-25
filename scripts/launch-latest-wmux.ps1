param(
  [switch]$PrintPath,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Arguments
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')

$latest = Get-ChildItem -LiteralPath $repoRoot -Directory -Filter 'release*' |
  ForEach-Object {
    $exe = Join-Path $_.FullName 'win-unpacked\wmux.exe'
    $asar = Join-Path $_.FullName 'win-unpacked\resources\app.asar'
    if (Test-Path -LiteralPath $exe) {
      $stamp = if (Test-Path -LiteralPath $asar) {
        (Get-Item -LiteralPath $asar).LastWriteTimeUtc
      } else {
        (Get-Item -LiteralPath $exe).LastWriteTimeUtc
      }

      [pscustomobject]@{
        Exe = $exe
        Stamp = $stamp
      }
    }
  } |
  Sort-Object Stamp -Descending |
  Select-Object -First 1

if (-not $latest) {
  throw "No packaged wmux build found under $repoRoot. Run npm run build:latest first."
}

if ($PrintPath) {
  $latest.Exe
  exit 0
}

if ($Arguments.Count -gt 0) {
  Start-Process -FilePath $latest.Exe -ArgumentList $Arguments
} else {
  Start-Process -FilePath $latest.Exe
}
