# Copies the non-Flutterwave env vars from the local .env into the linked
# Vercel project (production environment). Flutterwave keys are handled
# separately since those need NEW values, not the old ones.

$carryOverKeys = @(
    "DATABASE_URL",
    "JWT_SECRET",
    "API_FOOTBALL_KEY",
    "API_FOOTBALL_LEAGUE_IDS",
    "ARKESEL_API_KEY",
    "ARKESEL_SENDER_ID",
    "GROQ_API_KEY",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "CRON_SECRET"
)

$envLines = Get-Content .env
$envMap = @{}
foreach ($line in $envLines) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $eq = $trimmed.IndexOf("=")
    if ($eq -lt 0) { continue }
    $key = $trimmed.Substring(0, $eq).Trim()
    $value = $trimmed.Substring($eq + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    $envMap[$key] = $value
}

foreach ($key in $carryOverKeys) {
    if (-not $envMap.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envMap[$key])) {
        Write-Output "SKIP $key (not set locally)"
        continue
    }
    Write-Output "Adding $key to Vercel production..."
    $envMap[$key] | vercel.cmd env add $key production --force --yes
}

Write-Output "`nDone with carry-over vars. FLUTTERWAVE_* and NEXT_PUBLIC_APP_URL still need to be set separately."
