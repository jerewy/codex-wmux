$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$output = "release-latest-$timestamp"

npm run build:main
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

npm run build:renderer
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

cmd /d /s /c "npx electron-builder --dir --config electron-builder.json --config.directories.output=$output"
exit $LASTEXITCODE
