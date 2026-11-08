param(
    [ValidateSet('check', 'test', 'build', 'release', 'lint', 'format')]
    [string]$Task = 'test'
)
$ErrorActionPreference = 'Stop'
$sourcePath = $PSScriptRoot
$image = 'nodia-teacher-codex-build:0.161.0-bookworm'
& docker build --file (Join-Path $sourcePath 'Dockerfile.build') --tag $image $sourcePath
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$arguments = @(
    'run', '--rm', '--name', 'nodia-teacher-codex-prototype', '--cpus', '2', '--memory', '3g',
    '--mount', "type=bind,source=$sourcePath,target=/source",
    '--mount', 'type=volume,source=nodia-teacher-codex-cargo,target=/usr/local/cargo/registry',
    '--mount', 'type=volume,source=nodia-teacher-codex-git,target=/usr/local/cargo/git',
    '--mount', 'type=volume,source=nodia-teacher-codex-target-bookworm,target=/source/target',
    '-e', 'CARGO_NET_GIT_FETCH_WITH_CLI=true', '-e', 'RUST_MIN_STACK=8388608'
)
$cargoArguments = switch ($Task) {
    'check' { @('check', '--locked', '--tests') }
    'test' { @('test', '--locked', '--offline') }
    'build' { @('build', '--locked', '--offline') }
    'release' { @('build', '--release', '--locked', '--offline') }
    'lint' { @('clippy', '--locked', '--offline', '--all-targets', '--', '-D', 'warnings') }
    'format' { @('fmt', '--check') }
}
if ($Task -in @('test', 'build', 'release', 'lint', 'format')) { $arguments += @('--network', 'none') }
& docker @arguments $image cargo @cargoArguments
exit $LASTEXITCODE
