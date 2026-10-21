$portsToClear = @(3000) + (8080..8085)

$listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $portsToClear -contains $_.LocalPort }

if (-not $listeners) {
  Write-Host "No listeners found on ports: $($portsToClear -join ', ')."
  exit 0
}

$currentPid = $PID
$pids = $listeners |
  Select-Object -ExpandProperty OwningProcess -Unique |
  Where-Object { $_ -gt 0 -and $_ -ne $currentPid }

foreach ($procId in $pids) {
  try {
    $proc = Get-Process -Id $procId -ErrorAction Stop
    Stop-Process -Id $procId -Force -ErrorAction Stop
    Write-Host "Stopped $($proc.ProcessName) (PID $procId)."
  } catch {
    Write-Warning "Could not stop PID ${procId}: $($_.Exception.Message)"
  }
}