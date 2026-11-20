# 예림 인쇄물 제작관리시스템 - 바탕화면 아이콘 만들기
# 아이콘을 누르면 주소창 없는 전용 창(Edge 앱 창)으로 게시된 시스템이 열림. 각 PC에서 한 번만 실행.
$ErrorActionPreference = 'Stop'
$url  = 'https://yerimkimisa-alt.github.io/print-status/'   # 게시 주소가 바뀌면 이 줄만 고침
$name = '예림 인쇄물 제작관리'

$dir = Join-Path $env:LOCALAPPDATA 'YerimPrintStatus'
New-Item -ItemType Directory -Force $dir | Out-Null
$ico = Join-Path $dir 'icon.ico'
$local = Join-Path $PSScriptRoot '..\assets\icon.ico'
if (Test-Path -LiteralPath $local) { Copy-Item -LiteralPath $local $ico -Force }
else { Invoke-WebRequest -UseBasicParsing "$($url)assets/icon.ico" -OutFile $ico }

$edge = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe' -ErrorAction SilentlyContinue).'(default)'
if (-not $edge) { $edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe" }
if (-not (Test-Path -LiteralPath $edge)) { throw 'Microsoft Edge 를 찾지 못함. Edge 설치 후 다시 실행.' }

$lnkPath = Join-Path ([Environment]::GetFolderPath('Desktop')) "$name.lnk"
$lnk = (New-Object -ComObject WScript.Shell).CreateShortcut($lnkPath)
$lnk.TargetPath   = $edge
$lnk.Arguments    = "--app=$url --window-size=1440,900"
$lnk.IconLocation = "$ico,0"
$lnk.Description  = '홍보인쇄물 제작관리규정 기준 부서별 제출 현황과 미이행 공개'
$lnk.Save()
Write-Host "바탕화면에 아이콘을 만들었습니다: $lnkPath"
