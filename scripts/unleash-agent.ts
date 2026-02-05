import { AgentOrchestrator } from '../src/agentOrchestrator';
import * as path from 'path';

async function main() {
    const rootDir = path.resolve(__dirname, '..');
    const orchestrator = new AgentOrchestrator(rootDir);

    console.log("🚀 Unleashing Empowered Architect on task cs-agj9s...");

    // 1. Create/Get Architect Agent
    const agent = await orchestrator.createAgent("Architect-Prime", ["architecture", "ui-dev", "kernel-exec"]);
    console.log(`Agent 'Architect-Prime' activated: ${agent.id}`);

    // 2. Spawn Kernel
    await orchestrator.spawnKernel(agent.id);
    console.log("🧠 Kernel connected.");

    // 3. System Analysis via Kernel
    console.log("🔍 Analyzing UI architecture for Taskbar integration...");
    const analysisCode = `
import os

def scan_ui_components(path):
    components = []
    for root, dirs, files in os.walk(path):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                components.append(os.path.join(root, file))
    return components

ui_path = 'agent-ui/src/components'
files = scan_ui_components(ui_path)
print(f"Found {len(files)} UI components.")
print("Files to modify for Taskbar indicators:")
for f in files:
    if 'MacOS' in f or 'Terminal' in f:
        print(f" - {f}")
`;
    const analysisResult = await orchestrator.executeAgentCode(agent.id, analysisCode);
    console.log("Analysis Result:\n", analysisResult.stdout);

    // 4. Plan Git Branch
    const branchName = "feature/cs-agj9s-taskbar-indicators";
    console.log(`git Preparing branch: ${branchName}`);
    await orchestrator.executeAgentCode(agent.id, `import subprocess; subprocess.getoutput('git checkout -b ${branchName}')`);
    
    const branchCheck = await orchestrator.executeAgentCode(agent.id, "import subprocess; print(subprocess.getoutput('git branch --show-current'))");
    console.log("Current Branch:", branchCheck.stdout.trim());

    console.log("\n✅ Architect is now in control of the workspace.");
    console.log("Next step: Agent will begin modifying agent-ui/src/components/ui/MacOS.tsx to add resource monitors.");
}

main().catch(console.error);

