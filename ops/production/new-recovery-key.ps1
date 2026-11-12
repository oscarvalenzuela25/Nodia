#requires -Version 7.0
[CmdletBinding()]
param(
    [string]$Directory = [IO.Path]::Combine([Environment]::GetFolderPath('UserProfile'), '.nodia', 'production-recovery'),
    [ValidateSet(3072, 4096)][int]$KeySize = 3072,
    [switch]$FixtureOnly
)
# Local custody: PKCS8 is UNENCRYPTED at file level, protected by Windows DACLs.
# No network operation exists here. Only the public SPKI key may reach the VPS.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
function Stop-RecoveryKey([string]$Code) { throw [InvalidOperationException]::new("nodia_recovery:$Code") }
function Test-Within([string]$Candidate, [string]$Parent) {
    $boundary = $Parent.TrimEnd('\')
    return $Candidate.Equals($boundary, [StringComparison]::OrdinalIgnoreCase) -or
        $Candidate.StartsWith($boundary + '\', [StringComparison]::OrdinalIgnoreCase)
}
function Assert-SafeAncestors([string]$Path) {
    $current = $Path
    while ($current) {
        if ([IO.Directory]::Exists($current) -or [IO.File]::Exists($current)) {
            $attributes = [IO.File]::GetAttributes($current)
            if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
                ($attributes -band [IO.FileAttributes]::Directory) -eq 0) { Stop-RecoveryKey 'unsafe_ancestor' }
            foreach ($sentinel in @('.git', '.obsidian')) {
                $entry = [IO.Path]::Combine($current, $sentinel)
                if ([IO.Directory]::Exists($entry) -or [IO.File]::Exists($entry)) { Stop-RecoveryKey 'repository_or_vault_denied' }
            }
        }
        $parent = [IO.Directory]::GetParent($current)
        $current = if ($parent) { $parent.FullName } else { $null }
    }
}
try {
    if (-not $IsWindows -or -not [IO.Path]::IsPathFullyQualified($Directory) -or
        $Directory -notmatch '^[A-Za-z]:[\\/]' -or $Directory.StartsWith('\\')) { Stop-RecoveryKey 'absolute_local_windows_path_required' }
    foreach ($part in $Directory.Replace('/', '\').Substring(3).Split('\', [StringSplitOptions]::RemoveEmptyEntries)) {
        if ($part -in @('.', '..') -or $part.EndsWith('.') -or $part.EndsWith(' ') -or $part.Contains(':') -or
            $part -match '(?i)obsidian' -or
            $part -match '^(?i:Public|Shared|OneDrive(?: - .+)?|Dropbox(?: .+)?|Google Drive|GoogleDrive|Box|Box Sync|iCloudDrive)$') {
            Stop-RecoveryKey 'unsafe_or_shared_destination'
        }
    }
    $target = [IO.Path]::GetFullPath($Directory).TrimEnd('\')
    $profile = [IO.Path]::GetFullPath([Environment]::GetFolderPath('UserProfile')).TrimEnd('\')
    if (-not (Test-Within $target $profile) -or $target.Equals($profile, [StringComparison]::OrdinalIgnoreCase)) {
        Stop-RecoveryKey 'destination_must_be_inside_current_user_profile'
    }
    foreach ($name in @('OneDrive', 'OneDriveCommercial', 'OneDriveConsumer')) {
        $cloud = [Environment]::GetEnvironmentVariable($name)
        if ($cloud -and (Test-Within $target ([IO.Path]::GetFullPath($cloud)))) { Stop-RecoveryKey 'cloud_destination_denied' }
    }
    Assert-SafeAncestors $target
    if ([IO.Directory]::Exists($target) -or [IO.File]::Exists($target)) { Stop-RecoveryKey 'destination_already_exists_no_regeneration' }
    if ($FixtureOnly -and (-not $PSBoundParameters.ContainsKey('Directory') -or
        -not (Test-Within $target ([IO.Path]::GetFullPath([IO.Path]::GetTempPath()))) -or
        [IO.Path]::GetFileName($target) -notmatch '^nodia-recovery-key-fixture-[a-f0-9]{32}$')) { Stop-RecoveryKey 'fixture_destination_required' }
    if (-not ('Nodia.ProductionRecovery.LocalKeyStore' -as [type])) {
        Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
namespace Nodia.ProductionRecovery {
public sealed class KeyReceipt {
    public string FingerprintSha256 { get; set; }
    public string PublicKeyFile { get; set; }
    public string PrivateKeyFile { get; set; }
}
public static class LocalKeyStore {
    [StructLayout(LayoutKind.Sequential)] struct Attributes {
        public int Length; public IntPtr Descriptor;
        [MarshalAs(UnmanagedType.Bool)] public bool Inherit;
    }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true, ExactSpelling=true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool CreateDirectoryW(string path, ref Attributes attributes);
    static FileSecurity FileAcl(SecurityIdentifier sid) {
        var acl = new FileSecurity(); acl.SetOwner(sid); acl.SetAccessRuleProtection(true, false);
        acl.AddAccessRule(new FileSystemAccessRule(sid, FileSystemRights.FullControl, AccessControlType.Allow)); return acl;
    }
    static void VerifyAcl(FileSystemSecurity acl, SecurityIdentifier sid, bool directory) {
        if (!acl.AreAccessRulesProtected || !sid.Equals(acl.GetOwner(typeof(SecurityIdentifier)))) throw new InvalidOperationException("ACL owner/protection mismatch.");
        var rules = acl.GetAccessRules(true, true, typeof(SecurityIdentifier));
        if (rules.Count != 1) throw new InvalidOperationException("Unexpected ACL rules.");
        var rule = (FileSystemAccessRule)rules[0];
        var inheritance = directory ? InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit : InheritanceFlags.None;
        if (rule.IsInherited || !sid.Equals(rule.IdentityReference) || rule.AccessControlType != AccessControlType.Allow ||
            rule.FileSystemRights != FileSystemRights.FullControl || rule.InheritanceFlags != inheritance || rule.PropagationFlags != PropagationFlags.None)
            throw new InvalidOperationException("ACL rule mismatch.");
    }
    public static void VerifyDirectory(string path, string sid) {
        if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0) throw new InvalidOperationException("Reparse directory.");
        VerifyAcl(FileSystemAclExtensions.GetAccessControl(new DirectoryInfo(path), AccessControlSections.Owner | AccessControlSections.Access), new SecurityIdentifier(sid), true);
    }
    public static void CreateNewPrivateDirectory(string path, string sidText) {
        var sid = new SecurityIdentifier(sidText); var acl = new DirectorySecurity();
        acl.SetOwner(sid); acl.SetAccessRuleProtection(true, false);
        acl.AddAccessRule(new FileSystemAccessRule(sid, FileSystemRights.FullControl,
            InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
        byte[] bytes = acl.GetSecurityDescriptorBinaryForm(); IntPtr descriptor = Marshal.AllocHGlobal(bytes.Length);
        try {
            Marshal.Copy(bytes, 0, descriptor, bytes.Length);
            var attributes = new Attributes { Length=Marshal.SizeOf<Attributes>(), Descriptor=descriptor, Inherit=false };
            if (!CreateDirectoryW(path, ref attributes)) throw new Win32Exception(Marshal.GetLastWin32Error());
        } finally { Marshal.FreeHGlobal(descriptor); Array.Clear(bytes, 0, bytes.Length); }
        VerifyDirectory(path, sidText);
    }
    static void WriteNew(string path, byte[] bytes, SecurityIdentifier sid) {
        using (var stream = FileSystemAclExtensions.Create(new FileInfo(path), FileMode.CreateNew,
            FileSystemRights.FullControl, FileShare.None, 4096, FileOptions.WriteThrough, FileAcl(sid))) {
            VerifyAcl(FileSystemAclExtensions.GetAccessControl(new FileInfo(path), AccessControlSections.Owner | AccessControlSections.Access), sid, false);
            if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0) throw new InvalidOperationException("Reparse file.");
            stream.Write(bytes, 0, bytes.Length); stream.Flush(true);
        }
    }
    public static void WriteMetadata(string path, string json, string sid) {
        WriteNew(path, Encoding.UTF8.GetBytes(json), new SecurityIdentifier(sid));
    }
    static byte[] PemBytes(string label, byte[] der) {
        char[] pem = PemEncoding.Write(label.AsSpan(), der.AsSpan());
        try {
            int size = Encoding.UTF8.GetByteCount(pem.AsSpan()); byte[] result = new byte[size + 1];
            Encoding.UTF8.GetBytes(pem.AsSpan(), result.AsSpan(0, size)); result[size] = 10; return result;
        } finally { Array.Clear(pem, 0, pem.Length); }
    }
    static void Proof(byte[] privateDer, byte[] publicDer) {
        byte[] probe = RandomNumberGenerator.GetBytes(32), wrapped=null, restored=null;
        try {
            using (var secret=RSA.Create()) using (var publicKey=RSA.Create()) {
                int privateRead, publicRead;
                secret.ImportPkcs8PrivateKey(privateDer, out privateRead); publicKey.ImportSubjectPublicKeyInfo(publicDer, out publicRead);
                if (privateRead != privateDer.Length || publicRead != publicDer.Length || secret.KeySize < 3072 || secret.KeySize != publicKey.KeySize) throw new CryptographicException("RSA exports mismatch.");
                wrapped=publicKey.Encrypt(probe, RSAEncryptionPadding.OaepSHA256); restored=secret.Decrypt(wrapped, RSAEncryptionPadding.OaepSHA256);
                if (!CryptographicOperations.FixedTimeEquals(probe, restored)) throw new CryptographicException("RSA pair proof failed.");
            }
        } finally { CryptographicOperations.ZeroMemory(probe); if(wrapped!=null) CryptographicOperations.ZeroMemory(wrapped); if(restored!=null) CryptographicOperations.ZeroMemory(restored); }
    }
    public static KeyReceipt Generate(string directory, int bits, string sidText) {
        if (bits!=3072 && bits!=4096) throw new InvalidOperationException("RSA size rejected.");
        VerifyDirectory(directory, sidText); var sid=new SecurityIdentifier(sidText);
        byte[] privateDer=null, publicDer=null, privatePem=null, publicPem=null;
        try {
            using (var rsa=RSA.Create(bits)) {
                privateDer=rsa.ExportPkcs8PrivateKey(); publicDer=rsa.ExportSubjectPublicKeyInfo(); Proof(privateDer, publicDer);
                var result=new KeyReceipt { FingerprintSha256=Convert.ToHexString(SHA256.HashData(publicDer)).ToLowerInvariant(),
                    PrivateKeyFile=Path.Combine(directory,"recovery-private.pem"), PublicKeyFile=Path.Combine(directory,"recovery-public.pem") };
                privatePem=PemBytes("PRIVATE KEY",privateDer); publicPem=PemBytes("PUBLIC KEY",publicDer);
                WriteNew(result.PrivateKeyFile,privatePem,sid); WriteNew(result.PublicKeyFile,publicPem,sid);
                return result;
            }
        } finally {
            if(privateDer!=null) CryptographicOperations.ZeroMemory(privateDer); if(publicDer!=null) CryptographicOperations.ZeroMemory(publicDer);
            if(privatePem!=null) CryptographicOperations.ZeroMemory(privatePem); if(publicPem!=null) CryptographicOperations.ZeroMemory(publicPem);
        }
    }
}
}
"@
    }
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    try { $sid = $identity.User.Value } finally { $identity.Dispose() }
    $missing = [Collections.Generic.List[string]]::new()
    $current = $target
    while (-not [IO.Directory]::Exists($current)) {
        $missing.Add($current)
        $current = [IO.Directory]::GetParent($current).FullName
    }
    for ($index = $missing.Count - 1; $index -ge 0; $index--) {
        Assert-SafeAncestors $missing[$index]
        [Nodia.ProductionRecovery.LocalKeyStore]::CreateNewPrivateDirectory($missing[$index], $sid)
    }
    Assert-SafeAncestors $target
    $receipt = [Nodia.ProductionRecovery.LocalKeyStore]::Generate($target, $KeySize, $sid)
    $metadataPath = [IO.Path]::Combine($target, 'key-metadata.json')
    $metadata = [ordered]@{
        schema_version=1; purpose=$(if ($FixtureOnly) { 'fixture_only' } else { 'production_recovery' })
        created_at_utc=[DateTimeOffset]::UtcNow.ToString('O'); rsa_bits=$KeySize
        private_format='PKCS8_PEM_UNENCRYPTED'; public_format='SPKI_PEM'; wrapping='RSA-OAEP-SHA256'
        encryption_key_id_sha256_spki_der=$receipt.FingerprintSha256
        private_file_encryption=$false; file_protection='Windows_current_user_only_protected_DACL'
        key_pair_oaep_roundtrip_verified=$true; private_key_exported_to_vps=$false
    }
    $metadataText = ($metadata | ConvertTo-Json).Replace([Environment]::NewLine, [string][char]10) + [char]10
    [Nodia.ProductionRecovery.LocalKeyStore]::WriteMetadata($metadataPath, $metadataText, $sid)
    [pscustomobject]@{ FingerprintSha256=$receipt.FingerprintSha256; PublicKeyFile=$receipt.PublicKeyFile;
        PrivateKeyFile=$receipt.PrivateKeyFile; MetadataFile=$metadataPath }
} catch {
    if ($_.Exception.Message -match '^nodia_recovery:[a-z0-9_]+$') { throw }
    throw [InvalidOperationException]::new('nodia_recovery:operation_failed_partial_protected_store_preserved')
}
