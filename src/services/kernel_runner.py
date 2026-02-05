import sys
import json
import io
import traceback
from contextlib import redirect_stdout, redirect_stderr

def execute_code(code, context):
    """
    Executes code within a persistent context (globals).
    """
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()
    
    result = None
    error = None
    
    try:
        with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
            # Compile first to detect syntax errors before execution
            compiled_code = compile(code, "<string>", "exec")
            exec(compiled_code, context)
            
    except Exception:
        error = traceback.format_exc()
    
    return {
        "stdout": stdout_capture.getvalue(),
        "stderr": stderr_capture.getvalue(),
        "error": error
    }

def main():
    # Persistent context for this session
    context = {}
    
    # Simple JSON-line based protocol
    # Input: {"code": "print('hello')"}
    # Output: {"stdout": "hello\n", "stderr": "", "error": null}
    
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            
            request = json.loads(line)
            code = request.get("code", "")
            
            response = execute_code(code, context)
            
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()
            
        except json.JSONDecodeError:
            continue
        except Exception as e:
            # Fatal error in the runner loop
            sys.stderr.write(f"Fatal Kernel Error: {e}\n")
            break

if __name__ == "__main__":
    main()
