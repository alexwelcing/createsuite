import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

export interface KernelResult {
    stdout: string;
    stderr: string;
    error: string | null;
}

export class KernelManager {
    private process: ChildProcess | null = null;
    private scriptPath: string;

    constructor() {
        this.scriptPath = path.join(__dirname, 'kernel_runner.py');
    }

    /**
     * Starts the persistent Python kernel.
     */
    start(): void {
        if (this.process) return;

        this.process = spawn('python3', [this.scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe'] // stdin, stdout, stderr
        });

        this.process.stderr?.on('data', (data) => {
            console.error(`[Kernel Stderr]: ${data}`);
        });

        this.process.on('close', (code) => {
            console.log(`Kernel exited with code ${code}`);
            this.process = null;
        });
    }

    /**
     * Executes code in the persistent kernel.
     * @param code Python code to execute
     */
    async execute(code: string): Promise<KernelResult> {
        if (!this.process) {
            this.start();
        }

        return new Promise((resolve, reject) => {
            if (!this.process || !this.process.stdin || !this.process.stdout) {
                reject(new Error("Kernel not running"));
                return;
            }

            const payload = JSON.stringify({ code }) + '\n';
            
            // We need to listen for the ONE line of response corresponding to this request.
            // basic implementation: assuming one request = one response line.
            // A more robust one would use IDs, but this works for single-threaded agent interop.
            
            const listener = (data: Buffer) => {
                const responseStr = data.toString().trim();
                // Handle potential multi-chunk data or stray logs? 
                // For this MVP, we assume the python runner flushes one JSON line per request.
                
                try {
                    const result: KernelResult = JSON.parse(responseStr);
                    this.process?.stdout?.removeListener('data', listener);
                    resolve(result);
                } catch (e) {
                    // Might be partial data, ignoring for this simple demo
                    // In production, buffer until newline
                }
            };

            this.process.stdout.on('data', listener);
            this.process.stdin.write(payload);
        });
    }

    /**
     * Stops the kernel.
     */
    stop(): void {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
    }
}
