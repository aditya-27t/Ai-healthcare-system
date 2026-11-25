param(
  [int]$Port = 8090
)

$Root = $PSScriptRoot
$Prefix = "http://localhost:$Port/"

$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add($Prefix)
$Listener.Start()

Write-Host "MedAssist AI Web Application running at $Prefix" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow

$MimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
}

try {
  while ($Listener.IsListening) {
    $Context = $Listener.GetContext()
    $RelPath = $Context.Request.Url.AbsolutePath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($RelPath)) { $RelPath = "index.html" }

    $SafePath = $RelPath -replace '\.\.', ''
    $FilePath = Join-Path $Root $SafePath

    if (Test-Path $FilePath -PathType Leaf) {
      $Ext = [System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()
      $ContentType = if ($MimeTypes.ContainsKey($Ext)) { $MimeTypes[$Ext] } else { "application/octet-stream" }
      $Bytes = [System.IO.File]::ReadAllBytes($FilePath)
      $Context.Response.StatusCode = 200
      $Context.Response.ContentType = $ContentType
      $Context.Response.ContentLength64 = $Bytes.Length
      $Context.Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
    } else {
      $Context.Response.StatusCode = 404
      $Msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
      $Context.Response.OutputStream.Write($Msg, 0, $Msg.Length)
    }
    $Context.Response.Close()
  }
} finally {
  $Listener.Stop()
}
