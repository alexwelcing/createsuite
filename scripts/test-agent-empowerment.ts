import { AgentOrchestrator } from '../src/agentOrchestrator';
import * as path from 'path';

async function main() {
    const rootDir = path.resolve(__dirname, '..');
    const orchestrator = new AgentOrchestrator(rootDir);

    console.log("🚀 Initializing Agent Empowerment Demo...");

    // 1. Create Agent
    console.log("Creating Agent 'EmpoweredOne'...");
    const agent = await orchestrator.createAgent("EmpoweredOne", ["python-kernel", "gpu-aware"]);
    console.log(`Agent Created: ${agent.id}`);

    // 2. Spawn Kernel
    console.log("🧠 Spawning Persistent Kernel...");
    await orchestrator.spawnKernel(agent.id);
    console.log("Kernel Spawned.");

    // 3. Execute Code (Hello World)
    console.log("📝 Executing: print('Hello from the Kernel!')");
    let result = await orchestrator.executeAgentCode(agent.id, "print('Hello from the Kernel!')");
    console.log("Result:", result);

    // 4. Execute Code (Persistence Check)
    console.log("📝 Executing: x = 100 + 55");
    await orchestrator.executeAgentCode(agent.id, "x = 100 + 55");
    
    console.log("📝 Executing: print(f'The value of x is {x}')");
    result = await orchestrator.executeAgentCode(agent.id, "print(f'The value of x is {x}')");
    console.log("Result:", result);

    if (result.stdout.trim().includes("155")) {
        console.log("✅ Persistence Verified!");
    } else {
        console.error("❌ Persistence Failed.");
    }

    // 5. Check Compute Capabilities
    console.log("🔍 Checking Compute Capabilities...");
    const caps = await orchestrator.getAgentComputeCapabilities();
    console.log("Capabilities:", caps);

    // 6. Verify Git Access via Kernel
    console.log("twisted_rightwards_arrows Checking Git Access via Kernel...");
    result = await orchestrator.executeAgentCode(agent.id, "import subprocess; print(subprocess.getoutput('git --version'))");
    console.log("Git Version via Agent:", result.stdout.trim());

    // 7. Cleanup
    console.log("🛑 Stopping Agent...");
    await orchestrator.stopAgent(agent.id);
    console.log("Demo Complete.");
}

main().catch(console.error);
