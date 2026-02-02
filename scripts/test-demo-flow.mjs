#!/usr/bin/env node
/**
 * Demo Flow Verification Script
 * Tests all components working together without requiring Bun test framework
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const log = (msg, status = 'INFO') => {
  const colors = {
    INFO: '\x1b[36m',  // cyan
    PASS: '\x1b[32m',  // green
    FAIL: '\x1b[31m',  // red
    WARN: '\x1b[33m',  // yellow
    END: '\x1b[0m'
  };
  console.log(`${colors[status]}[${status}]${colors.END} ${msg}`);
};

const createTempWorkspace = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'createsuite-test-'));
  spawnSync('git', ['init'], { cwd: tempDir, stdio: 'pipe' });
  spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tempDir, stdio: 'pipe' });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: tempDir, stdio: 'pipe' });
  return tempDir;
};

const cleanupWorkspace = (dir) => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

console.log('\n=== Demo Flow Integration Tests ===\n');

const results = { passed: 0, failed: 0, tests: [] };

// Test 1: Entry point exists
log('Entry point script exists');
if (fs.existsSync('./bin/createsuite.js')) {
  results.passed++;
  log('PASS', 'PASS');
} else {
  results.failed++;
  log('FAIL', 'FAIL');
}

// Test 2: Build succeeds
log('TypeScript build succeeds');
const buildResult = spawnSync('npm', ['run', 'build'], { encoding: 'utf-8' });
if (buildResult.status === 0) {
  results.passed++;
  log('PASS', 'PASS');
} else {
  results.failed++;
  log('FAIL: ' + buildResult.stderr, 'FAIL');
}

// Test 3-6: SmartRouter classification via direct test
log('SmartRouter classifications');
const smartRouterResult = spawnSync('node', ['-e', `
const { analyzeComplexity } = require('./dist/smartRouter');
const tests = [
  analyzeComplexity('fix typo'),
  analyzeComplexity('refactor auth'),
  analyzeComplexity('coordinate team'),
  analyzeComplexity('add feature')
];
console.log(JSON.stringify(tests.map(t => ({r: t.recommended, c: t.confidence}))));
`], { encoding: 'utf-8' });

if (smartRouterResult.status === 0) {
  try {
    const data = JSON.parse(smartRouterResult.stdout);
    const allCorrect = 
      data[0].r === 'trivial' &&
      data[1].r === 'complex' &&
      data[2].r === 'team' &&
      data[3].r === 'simple';
    
    if (allCorrect) {
      results.passed++;
      log('All 4 workflow types classified correctly', 'PASS');
    } else {
      results.failed++;
      log('Classification mismatch: ' + smartRouterResult.stdout, 'FAIL');
    }
  } catch (e) {
    results.failed++;
    log('Parse error: ' + e.message, 'FAIL');
  }
} else {
  results.failed++;
  log('SmartRouter test failed: ' + smartRouterResult.stderr, 'FAIL');
}

// Test 7-10: CLI integration tests
let workspace = null;
try {
  workspace = createTempWorkspace();
  log('\\nCLI Integration Tests');

  // Initialize (use full path to createsuite.js)
  spawnSync('node', [process.cwd() + '/bin/createsuite.js', 'init', '--skip-providers'], {
    cwd: workspace,
    encoding: 'utf-8'
  });

  // Check storage created
  if (fs.existsSync(path.join(workspace, '.createsuite'))) {
    results.passed++;
    log('Unified storage .createsuite/ created', 'PASS');
  } else {
    results.failed++;
    log('Storage not created', 'FAIL');
  }

  // Test trivial task
  let result = spawnSync('node', [process.cwd() + '/dist/cli.js', 'task', 'create', '-t', 'fix typo', '-p', 'low'], {
    cwd: workspace,
    encoding: 'utf-8'
  });
  
  if (result.stdout.includes('TRIVIAL')) {
    results.passed++;
    log('TRIVIAL task shows workflow analysis', 'PASS');
  } else {
    results.failed++;
    log('TRIVIAL not found in output: ' + result.stdout.substring(0, 300), 'FAIL');
  }

  // Test complex task
  result = spawnSync('node', [process.cwd() + '/dist/cli.js', 'task', 'create', '-t', 'refactor auth system', '-p', 'high'], {
    cwd: workspace,
    encoding: 'utf-8'
  });
  
  if (result.stdout.includes('COMPLEX') && result.stdout.includes('planning')) {
    results.passed++;
    log('COMPLEX task shows workflow + planning suggestion', 'PASS');
  } else {
    results.failed++;
    log('COMPLEX not found or missing suggestion: ' + result.stdout.substring(0, 300), 'FAIL');
  }

} catch (error) {
  results.failed++;
  log('CLI tests error: ' + error.message, 'FAIL');
} finally {
  if (workspace) {
    cleanupWorkspace(workspace);
  }
}

// Summary
console.log('\\n=== Test Summary ===\\n');
console.log(`Tests Passed: ${results.passed}`);
console.log(`Tests Failed: ${results.failed}`);
console.log(`Status: ${results.failed === 0 ? 'ALL PASSED ✓' : 'SOME FAILED ✗'}\\n`);

process.exit(results.failed === 0 ? 0 : 1);
