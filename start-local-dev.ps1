$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

$pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
if ($pwsh) {
  $shell = $pwsh.Path
} else {
  $shell = (Get-Command powershell -ErrorAction SilentlyContinue).Path
}

if (-not $shell) {
  Write-Error "PowerShell is not available on this system."
  exit 1
}

function Stop-ProcessesOnPorts {
  param(
    [int[]]$Ports
  )

  $listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $Ports -contains $_.LocalPort }

  if (-not $listeners) {
    Write-Host "No existing listeners found on ports: $($Ports -join ', ')."
    return
  }

  $pids = $listeners |
    Select-Object -ExpandProperty OwningProcess -Unique |
    Where-Object { $_ -gt 0 -and $_ -ne $PID }

  foreach ($procId in $pids) {
    try {
      $proc = Get-Process -Id $procId -ErrorAction Stop
      Stop-Process -Id $procId -Force -ErrorAction Stop
      Write-Host "Stopped $($proc.ProcessName) (PID $procId)."
    } catch {
      Write-Warning "Could not stop PID ${procId}: $($_.Exception.Message)"
    }
  }
}

$portsToClear = @(3000) + (8080..8085)
Stop-ProcessesOnPorts -Ports $portsToClear

$apiServerCommand = "cd `"$repoRoot`"; pnpm --filter @workspace/api-server run dev"
$lcsCommand = "cd `"$repoRoot`"; pnpm --filter @workspace/living-character-sheet run dev"
Start-Process -FilePath $shell -ArgumentList '-NoExit', '-Command', $apiServerCommand -WorkingDirectory $repoRoot -WindowStyle Normal
Start-Process -FilePath $shell -ArgumentList '-NoExit', '-Command', $lcsCommand -WorkingDirectory $repoRoot -WindowStyle Normal
Write-Host 'Started API server and Living Character Sheet in new terminals.'
