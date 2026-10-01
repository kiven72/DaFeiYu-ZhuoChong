$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = Split-Path -Parent $PSScriptRoot
$package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$portable = Join-Path $projectRoot 'dist\Coopanion-Offline-Windows-x64'
$archive = Join-Path $projectRoot ('dist\Coopanion-Offline-' + $package.version + '-win-x64.zip')
if (-not (Test-Path -LiteralPath $portable -PathType Container)) { throw 'Build the portable folder first.' }
if (Test-Path -LiteralPath $archive) { throw 'ZIP already exists. Move or rename the previous ZIP first.' }
$zip = [System.IO.Compression.ZipFile]::Open($archive, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in Get-ChildItem -LiteralPath $portable -Recurse -File -Force) {
        $relative = $file.FullName.Substring($portable.Length + 1)
        if ($relative -match '^(data|test-data)[\\/]') { continue }
        $entry = 'Coopanion-Offline-Windows-x64/' + $relative.Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entry, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally {
    $zip.Dispose()
}
Write-Output $archive
