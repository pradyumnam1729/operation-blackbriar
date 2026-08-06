# PostToolUse hook — messaging consistency guard (Master Instructions §5.2)
# Fires after Write/Edit. If the edited file is a war-room or asset markdown file,
# scan it for banned words/phrases from the Voice of Aurigo standards.
# Exit 2 -> feedback is sent back to Claude to fix the violation.

$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }
try { $payload = $raw | ConvertFrom-Json } catch { exit 0 }

$filePath = $payload.tool_input.file_path
if (-not $filePath) { exit 0 }
if ($filePath -notmatch '\.md$') { exit 0 }

# Only guard content areas; skip rule files that legitimately list banned words.
$guarded = ($filePath -match 'GTM-War-Room') -or ($filePath -match 'reference output')
if (-not $guarded) { exit 0 }
if ($filePath -match 'gtm-rules|brand-voice|HANDOVER') { exit 0 }
if (-not (Test-Path $filePath)) { exit 0 }

$listPath = Join-Path $PSScriptRoot "forbidden-words.txt"
if (-not (Test-Path $listPath)) { exit 0 }
$words = Get-Content $listPath | Where-Object { $_.Trim() -ne "" }

$content = Get-Content $filePath -Raw
$hits = @()
foreach ($w in $words) {
    if ($content -imatch [regex]::Escape($w)) { $hits += $w }
}

if ($hits.Count -gt 0) {
    [Console]::Error.WriteLine("VOICE GUARD: '$filePath' contains banned words/phrases: $($hits -join ', '). Per 'Voice of Aurigo - Standards Reference.md': fix these (e.g. 'lifecycle' -> 'life cycle', 'single source of truth' -> 'unified system', 'AI-powered' -> 'AI-native'). Rewrite the flagged lines now. If a term appears only as a quoted example of what NOT to say, you may leave it and note why.")
    exit 2
}
exit 0
