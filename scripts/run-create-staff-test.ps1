param(
    [string]$ServiceRoleKey
)

function Get-ServiceKey {
    param($provided)
    if ($provided) { return $provided }
    Write-Host "Enter Supabase service_role key (input will be hidden):"
    $ss = Read-Host -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss)
    $key = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    return $key
}

$serviceKey = Get-ServiceKey $ServiceRoleKey
if (-not $serviceKey) {
    Write-Error "No service_role key provided. Exiting."
    exit 1
}

$env:SUPABASE_SERVICE_ROLE_KEY = $serviceKey
$env:ADMIN_API_SECRET = 'local-admin-secret'
$env:REACT_APP_ADMIN_API_SECRET = 'local-admin-secret'

Write-Host "Environment variables set for this session. Starting dev API (npm run dev:api)..."

# Start the dev API in a separate terminal window so it keeps running.
# Ensure the new window sets the same env vars (so the server sees the service_role key).
$cwd = Split-Path -Parent $MyInvocation.MyCommand.Definition
$cmd = "npm run dev:api"

# Build a PowerShell command to run in the new window that sets the env vars then starts the API.
# We escape the $ so the new shell evaluates the assignments itself.
$psCommand = "cd '$cwd'; `$env:SUPABASE_SERVICE_ROLE_KEY='$serviceKey'; `$env:ADMIN_API_SECRET='local-admin-secret'; `$env:REACT_APP_ADMIN_API_SECRET='local-admin-secret'; $cmd"
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit","-Command",$psCommand

# Wait for the server to respond
$uri = "http://localhost:4000"
$maxWait = 60
Write-Host "Waiting up to $maxWait seconds for $uri to become reachable..."
$up = $false
for ($i=0; $i -lt $maxWait; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri $uri -Method Head -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        $up = $true
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}

if (-not $up) {
    Write-Warning "Timed out waiting for $uri. The dev server may still be starting. You can run the POST manually once it is up."
}

# Prepare test body
$body = @{
    username = "teststaff"
    email = "test+api@zoshleycoffee.com"
    password = "TempPass123!"
    role = "staff"
} | ConvertTo-Json

Write-Host "Sending test POST to $uri/api/create-staff..."
try {
    $result = Invoke-RestMethod -Uri ("$uri/api/create-staff") -Method Post -Headers @{ 'x-admin-secret' = 'local-admin-secret' } -Body $body -ContentType 'application/json' -TimeoutSec 30
    Write-Host "--- Response JSON ---"
    $result | ConvertTo-Json -Depth 5
    Write-Host "--- End Response ---"
} catch {
    Write-Error "Request failed: $_"
    Write-Host "If the request failed because the server isn't ready, wait a few seconds and try the POST manually with the PowerShell snippet from the README." 
}
