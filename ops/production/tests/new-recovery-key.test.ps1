#requires -Version 7.0
# Synthetic temporary keys only. Never uses the default production destination.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'Windows ACL fixture required.' }
$script = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../new-recovery-key.ps1'))
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('nodia-recovery-key-fixture-' + [Guid]::NewGuid().ToString('N'))
$junction = Join-Path ([IO.Path]::GetTempPath()) ('nodia-recovery-key-junction-' + [Guid]::NewGuid().ToString('N'))
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
try { $sid = $identity.User } finally { $identity.Dispose() }
function Assert([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Check-PrivateAcl([string]$Path, [bool]$Directory) {
    $entry = if ($Directory) { [IO.DirectoryInfo]::new($Path) } else { [IO.FileInfo]::new($Path) }
    $acl = [IO.FileSystemAclExtensions]::GetAccessControl($entry, [Security.AccessControl.AccessControlSections]'Owner, Access')
    Assert $acl.AreAccessRulesProtected 'ACL inheritance must be disabled.'
    Assert ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Equals($sid)) 'ACL owner must be current user.'
    $rules = $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
    Assert ($rules.Count -eq 1) 'Only one user ACE may exist.'
    $rule = $rules[0]
    Assert ($rule.IdentityReference.Equals($sid) -and -not $rule.IsInherited -and
        $rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and
        $rule.FileSystemRights -eq [Security.AccessControl.FileSystemRights]::FullControl) 'Unexpected ACE.'
}
function Reject([string]$Path, [string]$Code) {
    $rejected = $false
    try { & $script -Directory $Path -FixtureOnly | Out-Null }
    catch { $rejected = $_.Exception.Message -eq "nodia_recovery:$Code" }
    Assert $rejected 'Unsafe destination was not rejected by its expected guard.'
}
try {
    $receipt = & $script -Directory $fixture -KeySize 3072 -FixtureOnly
    Assert ($receipt.FingerprintSha256 -match '^[a-f0-9]{64}$') 'Fingerprint must be SHA256 SPKI DER.'
    Check-PrivateAcl $fixture $true
    foreach ($path in @($receipt.PrivateKeyFile, $receipt.PublicKeyFile, $receipt.MetadataFile)) { Check-PrivateAcl $path $false }
    $metadata = Get-Content -LiteralPath $receipt.MetadataFile -Raw | ConvertFrom-Json
    Assert ($metadata.purpose -eq 'fixture_only' -and $metadata.rsa_bits -eq 3072 -and
        $metadata.private_format -eq 'PKCS8_PEM_UNENCRYPTED' -and -not $metadata.private_file_encryption -and
        $metadata.wrapping -eq 'RSA-OAEP-SHA256' -and $metadata.key_pair_oaep_roundtrip_verified -and
        -not $metadata.private_key_exported_to_vps) 'Custody metadata contract invalid.'
    Assert (($receipt | ConvertTo-Json) -notmatch '-----BEGIN') 'Receipt must not contain PEM.'
    if (-not ('Nodia.ProductionRecovery.FixtureCrypto' -as [type])) {
        Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
namespace Nodia.ProductionRecovery {
public static class FixtureCrypto {
    public static string Check(string privateFile, string publicFile) {
        byte[] secretBytes=File.ReadAllBytes(privateFile), publicBytes=File.ReadAllBytes(publicFile), payload=RandomNumberGenerator.GetBytes(32), wrapped=null, restored=null;
        char[] secretChars=Encoding.UTF8.GetChars(secretBytes), publicChars=Encoding.UTF8.GetChars(publicBytes);
        try {
            using(var secret=RSA.Create()) using(var pub=RSA.Create()) {
                secret.ImportFromPem(secretChars.AsSpan()); pub.ImportFromPem(publicChars.AsSpan());
                if(secret.KeySize<3072 || pub.KeySize!=secret.KeySize) throw new Exception("Fixture RSA size invalid.");
                wrapped=pub.Encrypt(payload,RSAEncryptionPadding.OaepSHA256); restored=secret.Decrypt(wrapped,RSAEncryptionPadding.OaepSHA256);
                if(!CryptographicOperations.FixedTimeEquals(payload,restored)) throw new Exception("Fixture file pair invalid.");
                return Convert.ToHexString(SHA256.HashData(pub.ExportSubjectPublicKeyInfo())).ToLowerInvariant();
            }
        } finally {
            CryptographicOperations.ZeroMemory(secretBytes); CryptographicOperations.ZeroMemory(publicBytes); CryptographicOperations.ZeroMemory(payload);
            Array.Clear(secretChars,0,secretChars.Length); Array.Clear(publicChars,0,publicChars.Length);
            if(wrapped!=null)CryptographicOperations.ZeroMemory(wrapped); if(restored!=null)CryptographicOperations.ZeroMemory(restored);
        }
    }
}
}
"@
    }
    Assert ([Nodia.ProductionRecovery.FixtureCrypto]::Check($receipt.PrivateKeyFile, $receipt.PublicKeyFile) -eq
        $receipt.FingerprintSha256) 'File pair must interoperate with RSA-OAEP-SHA256 and its fingerprint.'
    $before = @{}
    foreach ($path in @($receipt.PrivateKeyFile, $receipt.PublicKeyFile, $receipt.MetadataFile)) { $before[$path] = (Get-FileHash -LiteralPath $path).Hash }
    Reject $fixture 'destination_already_exists_no_regeneration'
    foreach ($path in $before.Keys) { Assert ((Get-FileHash -LiteralPath $path).Hash -eq $before[$path]) 'Existing key bytes changed.' }
    Reject 'relative-path' 'absolute_local_windows_path_required'
    Reject (Join-Path (Split-Path (Split-Path $PSScriptRoot)) 'rsa-fixture-must-not-exist') 'repository_or_vault_denied'
    Reject (Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Obsidian Vault\rsa-fixture-must-not-exist') 'unsafe_or_shared_destination'
    Reject (Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Shared\rsa-fixture-must-not-exist') 'unsafe_or_shared_destination'
    [void](New-Item -ItemType Junction -Path $junction -Target $fixture)
    Reject (Join-Path $junction ('nodia-recovery-key-fixture-' + [Guid]::NewGuid().ToString('N'))) 'unsafe_ancestor'
} finally {
    if ([IO.Directory]::Exists($junction)) {
        Assert ([IO.Path]::GetFullPath($junction).StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()), [StringComparison]::OrdinalIgnoreCase) -and
            [IO.Path]::GetFileName($junction) -match '^nodia-recovery-key-junction-[a-f0-9]{32}$' -and
            ([IO.File]::GetAttributes($junction) -band [IO.FileAttributes]::ReparsePoint) -ne 0) 'Unsafe junction cleanup.'
        [IO.Directory]::Delete($junction, $false)
    }
    if ([IO.Directory]::Exists($fixture)) {
        $full = [IO.Path]::GetFullPath($fixture)
        Assert ($full.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()), [StringComparison]::OrdinalIgnoreCase) -and
            [IO.Path]::GetFileName($full) -match '^nodia-recovery-key-fixture-[a-f0-9]{32}$' -and
            ([IO.File]::GetAttributes($full) -band [IO.FileAttributes]::ReparsePoint) -eq 0) 'Unsafe fixture cleanup.'
        foreach ($name in @('recovery-private.pem', 'recovery-public.pem', 'key-metadata.json')) {
            $path = [IO.Path]::Combine($full, $name)
            if ([IO.File]::Exists($path)) { [IO.File]::Delete($path) }
        }
        [IO.Directory]::Delete($full, $false)
    }
}
[pscustomobject]@{ status='passed'; windows_acl_verified=$true; key_pair_files_verified=$true;
    overwrite_and_unsafe_paths_rejected=$true; fixtures_removed=$true; production_key_generated=$false }
