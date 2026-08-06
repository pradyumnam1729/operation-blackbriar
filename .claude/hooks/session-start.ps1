# SessionStart hook — inject minimum viable context (Master Instructions §5.1)
# Prints the four BRAND-DNA files + current strategy so every session starts grounded.
$root = (Get-Location).Path
$files = @(
    "GTM-War-Room\BRAND-DNA\positioning-and-icp.md",
    "GTM-War-Room\BRAND-DNA\brand-voice.md",
    "GTM-War-Room\BRAND-DNA\our-customer.md",
    "GTM-War-Room\BRAND-DNA\gtm-rules.md",
    "GTM-War-Room\strategy.md"
)

Write-Output "=== PMM AGENT SESSION CONTEXT (injected by SessionStart hook) ==="
foreach ($f in $files) {
    $p = Join-Path $root $f
    if (Test-Path $p) {
        Write-Output ""
        Write-Output "--- $f ---"
        Get-Content $p -Raw
    } else {
        Write-Output ""
        Write-Output "--- $f — MISSING. Populate before producing any output that depends on it. ---"
    }
}
$handover = Join-Path $root "GTM-War-Room\HANDOVER.md"
if (Test-Path $handover) {
    Write-Output ""
    Write-Output "--- GTM-War-Room\HANDOVER.md (previous session) ---"
    Get-Content $handover -Raw
}
Write-Output ""
Write-Output "=== END SESSION CONTEXT ==="
exit 0
