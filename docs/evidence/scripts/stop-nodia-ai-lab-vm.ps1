param([Parameter(Mandatory = $true)][string]$ResultPath)
$ErrorActionPreference = 'Stop'
$vmName = 'nodia-vps-lab'
try {
    Import-Module Hyper-V
    $machine = Get-VM -Name $vmName -ErrorAction Stop
    if ($machine.Name -ne $vmName -or $machine.Id.ToString() -ne 'b940595d-892f-4235-9b08-59d2e777d696') {
        throw 'Unexpected virtual machine identity'
    }
    if ($machine.State -eq 'Running') {
        # Guest shutdown only. Never force power-off or delete saved state.
        Stop-VM -VM $machine -Confirm:$false -ErrorAction Stop
    } elseif ($machine.State -ne 'Off') {
        throw "Unsupported VM state for graceful shutdown: $($machine.State)"
    }
    $machine = Get-VM -Name $vmName
    @{ success = ($machine.State -eq 'Off'); name = $machine.Name; id = $machine.Id.ToString();
       state = $machine.State.ToString(); checked_at = [DateTime]::UtcNow.ToString('o') } |
        ConvertTo-Json | Set-Content -LiteralPath $ResultPath -Encoding UTF8
} catch {
    @{ success = $false; name = $vmName; error = $_.Exception.Message; checked_at = [DateTime]::UtcNow.ToString('o') } |
        ConvertTo-Json | Set-Content -LiteralPath $ResultPath -Encoding UTF8
    exit 1
}
