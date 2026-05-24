# Creates and publishes v1.0.0 release for josh011604/zoshley-coffee
# Expects $env:GITHUB_TOKEN to be set in the environment when run.

if (-not $env:GITHUB_TOKEN) {
    Write-Error "GITHUB_TOKEN environment variable is not set."
    exit 2
}

# Create annotated tag (overwrite if exists)
git tag -f v1.0.0 -m 'v1.0.0 release'
git push origin v1.0.0 -f

$uri = 'https://api.github.com/repos/josh011604/zoshley-coffee/releases'
$payload = @{ 
    tag_name   = 'v1.0.0'
    name       = 'v1.0.0'
    body       = 'Checkout improvements: Map autocomplete accepts typed address (press Enter) and retries if delivery coordinates are unavailable. See RELEASE_NOTES/v1.0.0.md for full notes.'
    draft      = $false
    prerelease = $false
}

$json = $payload | ConvertTo-Json -Depth 4

try {
    $resp = Invoke-RestMethod -Method Post -Uri $uri -Headers @{ Authorization = "token $($env:GITHUB_TOKEN)"; Accept = 'application/vnd.github+json' } -Body $json -ContentType 'application/json'
    $resp | ConvertTo-Json
}
catch {
    Write-Error "Failed to create release: $($_.Exception.Message)"
    exit 1
}

exit 0
