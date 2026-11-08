param([Parameter(Mandatory=$true)][string]$ModelId)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$productRoot = Join-Path $repoRoot 'nodia-gemini-microservice'
$image = 'sha256:a89ae711fc322065ffa2c8b093940ffbd359307c5c9e0b972167a7e88facb578'
$binaryHash = 'f57ad0a04c93e1d13b86bd13c4f35b6577bc0557e6bfd718e9f3a2bdb4504240113f6bbcfefad9f039eb1d5e7e23e0a2623b4b7687882eca86954e485ad9f9c2'
& docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges `
    --memory 768m --cpus 1 --pids-limit 64 --tmpfs /tmp:rw,nosuid,nodev,size=64m `
    --mount "type=bind,source=$PSScriptRoot,target=/probe,readonly" `
    --mount "type=bind,source=$productRoot,target=/product,readonly" `
    --entrypoint python $image /probe/antigravity_offline_catalog.py `
    --source-root /product --binary /opt/nodia/antigravity-cli/1.3.1/agy `
    --sha512 $binaryHash --model-id $ModelId
exit $LASTEXITCODE
