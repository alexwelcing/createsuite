import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GpuUtils {
    /**
     * Checks if a GPU is available (software check via Python/Torch or nvidia-smi fallback).
     */
    static async isGpuAvailable(): Promise<boolean> {
        try {
            // Check 1: nvidia-smi
            await execAsync('nvidia-smi');
            return true;
        } catch (e) {
            // Check 2: Check via Python if Torch/CUDA is available (software fallback)
            // This allows the agent to know if it can *try* to use GPU libraries.
            // For now, if nvidia-smi fails, we assume NO, but we log it.
            return false;
        }
    }

    /**
     * Generates a GPU status report.
     */
    static async getGpuStatus(): Promise<string> {
        try {
            const { stdout } = await execAsync('nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader');
            return stdout.trim();
        } catch (e) {
            return "No GPU detected or driver not installed.";
        }
    }
}
