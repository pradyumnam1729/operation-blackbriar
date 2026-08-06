# UserPromptSubmit hook — inject the playbook routing rule on every prompt
# (Master Instructions §3.5 triage + §12 sub-agent dispatch). Keep this lean:
# it fires on every prompt; brand context is already injected by session-start.ps1.
Write-Output "=== PMM AGENT ROUTING (injected per prompt) ==="
Write-Output "Execute this prompt per the PMM Agent playbook (Master Instructions):"
Write-Output "1. Triage the request per rocks/pebbles/sand (~50/25/15/10 allocation, Master Instructions 3.5) before doing any work. If triage is non-obvious, dispatch pmm-prioritization."
Write-Output "2. Dispatch to the matching sub-agent(s) via the Agent tool rather than doing PMM work inline:"
Write-Output "   - Intelligence (A): voice-of-market, icp-persona, competitive-intel, win-loss, customer-evidence"
Write-Output "   - Activation (B): product-to-market, launch-orchestration, sales-enablement, adoption-expansion, pricing-packaging"
Write-Output "   - Governance (C): messaging-effectiveness, content-governance, gtm-performance, pmm-prioritization"
Write-Output "   - Build (engineering mode): app-architect, ui-engineer, qa-reviewer"
Write-Output "3. Routing rule: intelligence feeds activation; activation agents may NOT produce buyer-facing assets without validated intelligence inputs. Governance audits everything."
Write-Output "4. Use the matching skill when one exists (/foundation-doc, /positioning, /messaging-framework, /battlecard, /launch-brief, /ask-war-room, /asset-qa, /handover)."
Write-Output "5. Brief, don't prompt (Master Instructions 6): clarify via AskUserQuestion before executing. All outputs are drafts; run /asset-qa before any promotion to final."
Write-Output "Only skip agent dispatch for trivial conversational turns or pure file/system housekeeping."
Write-Output "=== END ROUTING ==="
exit 0
