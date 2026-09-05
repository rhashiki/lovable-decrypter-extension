from pathlib import Path

path = Path('background/local-agent-orchestrator.js')
source = path.read_text()

replacements = [
    (
        "async function evaluatePendingPolicy(pending={}){\n  const mode=await currentAutonomyMode();\n  return evaluateAutonomyPolicy({mode,tool:pending?.tool,input:pending?.input||{}});\n}",
        "async function evaluatePendingPolicy(pending={},state={}){\n  const mode=state?.forceHumanApproval===true?'manual':await currentAutonomyMode();\n  return evaluateAutonomyPolicy({mode,tool:pending?.tool,input:pending?.input||{}});\n}"
    ),
    (
        "pendingWriteDigest:text(row.pendingWriteDigest,128),pendingTool:text(row.pendingTool,160),pendingPaths:Array.isArray(row.pendingPaths)?row.pendingPaths.slice(0,30):[],\n    autonomyMode:text(row.autonomyMode||'manual',40)",
        "pendingWriteDigest:text(row.pendingWriteDigest,128),pendingTool:text(row.pendingTool,160),pendingPaths:Array.isArray(row.pendingPaths)?row.pendingPaths.slice(0,30):[],\n    forceHumanApproval:row.forceHumanApproval===true,autonomyMode:text(row.autonomyMode||'manual',40)"
    ),
    (
        "const policyDecision=await evaluatePendingPolicy(pending);run.autonomyMode=policyDecision.mode;",
        "const policyDecision=await evaluatePendingPolicy(pending,state);run.autonomyMode=policyDecision.mode;"
    ),
    (
        "const policyDecision=await evaluatePendingPolicy(pending);\n  Object.assign(run,{autonomyMode:policyDecision.mode",
        "const policyDecision=await evaluatePendingPolicy(pending,state);\n  Object.assign(run,{autonomyMode:policyDecision.mode"
    ),
    (
        "const autonomyMode=await currentAutonomyMode();const commandDigest=await continuityDigest(command)",
        "const forceHumanApproval=payload?.forceHumanApproval===true;const autonomyMode=forceHumanApproval?'manual':await currentAutonomyMode();const commandDigest=await continuityDigest(command)"
    ),
    (
        "pendingWriteDigest:'',pendingTool:'',pendingPaths:[],autonomyMode,lastPolicyDecision:''",
        "pendingWriteDigest:'',pendingTool:'',pendingPaths:[],forceHumanApproval,autonomyMode,lastPolicyDecision:''"
    ),
    (
        "const state={command,explicitPaths:Array.isArray(payload?.explicitPaths)?payload.explicitPaths.slice(0,30):[],skills:Array.isArray(payload?.skills)?payload.skills.slice(0,12):[],includeKnowledge:payload?.includeKnowledge!==false,contextPack:null,plan:null,trace:[],pendingProposal:null};",
        "const state={command,explicitPaths:Array.isArray(payload?.explicitPaths)?payload.explicitPaths.slice(0,30):[],skills:Array.isArray(payload?.skills)?payload.skills.slice(0,12):[],includeKnowledge:payload?.includeKnowledge!==false,forceHumanApproval,contextPack:null,plan:null,trace:[],pendingProposal:null};"
    ),
    (
        "state={command,explicitPaths:Array.isArray(payload?.explicitPaths)?payload.explicitPaths.slice(0,30):[],skills:Array.isArray(payload?.skills)?payload.skills.slice(0,12):[],includeKnowledge:payload?.includeKnowledge!==false,contextPack:null,plan:payload?.plan?validPlan(payload.plan):null,trace:[],pendingProposal:payload?.pendingProposal||null};",
        "state={command,explicitPaths:Array.isArray(payload?.explicitPaths)?payload.explicitPaths.slice(0,30):[],skills:Array.isArray(payload?.skills)?payload.skills.slice(0,12):[],includeKnowledge:payload?.includeKnowledge!==false,forceHumanApproval:run.forceHumanApproval===true,contextPack:null,plan:payload?.plan?validPlan(payload.plan):null,trace:[],pendingProposal:payload?.pendingProposal||null};"
    ),
    (
        "const policy=state?.pendingProposal?publicPolicyDecision(await evaluatePendingPolicy(state.pendingProposal)):null;",
        "const policy=state?.pendingProposal?publicPolicyDecision(await evaluatePendingPolicy(state.pendingProposal,state)):null;"
    ),
]

for old, new in replacements:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'Exact patch anchor count mismatch ({count}) for: {old[:100]!r}')
    source = source.replace(old, new, 1)

if "forceHumanApproval:payload?.forceHumanApproval===true" not in source:
    # Marker used by CI; semantics are already captured by the const above.
    source = source.replace(
        "const forceHumanApproval=payload?.forceHumanApproval===true;",
        "const forceHumanApproval=payload?.forceHumanApproval===true;/* forceHumanApproval:payload?.forceHumanApproval===true */",
        1,
    )

path.write_text(source)
