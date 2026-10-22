param([Parameter(Mandatory = $true)][string]$ResultPath)
$ErrorActionPreference = 'Stop'
$vmName = 'nodia-vps-lab'
try {
    Import-Module Hyper-V
    $machine = Get-VM -Name $vmName -ErrorAction Stop
    if ($machine.Name -ne $vmName) { throw 'Unexpected virtual machine identity' }
    if ($machine.State -eq 'Off' -or $machine.State -eq 'Saved') {
        Start-VM -VM $machine -ErrorAction Stop
    } elseif ($machine.State -eq 'Paused') {
        Resume-VM -VM $machine -ErrorAction Stop
    } elseif ($machine.State -ne 'Running') {
        throw "Unsupported VM state: $($machine.State)"
    }
    $addresses = @()
    for ($attempt = 0; $attempt -lt 45; $attempt++) {
        $machine = Get-VM -Name $vmName
        $addresses = @(Get-VMNetworkAdapter -VM $machine | ForEach-Object IPAddresses | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' -and $_ -notmatch '^169\.254\.' })
        if ($addresses.Count -gt 0) { break }
        Start-Sleep -Seconds 2
    }
    @{ success = $true; name = $machine.Name; id = $machine.Id.ToString(); state = $machine.State.ToString(); ipv4 = $addresses; checked_at = [DateTime]::UtcNow.ToString('o') } |
        ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $ResultPath -Encoding UTF8
} catch {
    @{ success = $false; name = $vmName; error = $_.Exception.Message; checked_at = [DateTime]::UtcNow.ToString('o') } |
        ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $ResultPath -Encoding UTF8
    exit 1
}
