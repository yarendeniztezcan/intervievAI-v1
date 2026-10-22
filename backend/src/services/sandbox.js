const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');

function runProcess(command, args, cwd, input, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', data => { stdout += data.toString(); });
    child.stderr.on('data', data => { stderr += data.toString(); });
    child.on('error', error => {
      clearTimeout(timer);
      resolve({ stdout, stderr: error.message, timedOut });
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code, timedOut });
    });

    child.stdin.write(input == null ? '' : String(input));
    if (!String(input || '').endsWith('\n')) child.stdin.write('\n');
    child.stdin.end();
  });
}

async function executeCode(code, language, testCases) {
  const executionId = randomUUID();
  const tempDir = path.join('/tmp', `sandbox_${executionId}`);

  try {
    const dangerousPatterns = [
      /\beval\s*\(/i, /\bexec\s*\(/i, /\bsystem\s*\(/i,
      /\bos\.system\b/i, /\bsubprocess\b/i, /\bchild_process\b/i,
      /\bfs\./i, /require\s*\(\s*['"]fs/i,
      /\bprocess\.env\b/i, /\bimport\s+os\b/i, /\bimport\s+subprocess\b/i,
      /\brm\s+-rf\b/i, /\bshutdown\b/i
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) throw new Error('Güvenlik: Yasaklanmış kod kalıbı tespit edildi');
    }

    await fs.mkdir(tempDir, { recursive: true });
    const results = [];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      let command;
      let args;
      let input = testCase.input ?? '';

      if (language === 'python') {
        const file = `main_${i}.py`;
        await fs.writeFile(path.join(tempDir, file), code);
        command = 'python3';
        args = [file];
      } else if (language === 'javascript' || language === 'js') {
        const file = `main_${i}.js`;
        await fs.writeFile(path.join(tempDir, file), code);
        command = 'node';
        args = [file];
      } else if (language === 'c') {
        const source = `main_${i}.c`;
        const binary = `main_${i}`;
        await fs.writeFile(path.join(tempDir, source), code);
        const compile = await runProcess('gcc', [source, '-O2', '-std=c11', '-o', binary], tempDir, '', 5000);
        if (compile.code !== 0) {
          results.push({ testCase: i + 1, input, expected: String(testCase.expected ?? '').trim(), actual: '', passed: false, error: compile.stderr });
          continue;
        }
        command = path.join(tempDir, binary);
        args = [];
      } else if (language === 'java') {
        const source = 'Main.java';
        await fs.writeFile(path.join(tempDir, source), code);
        const compile = await runProcess('javac', [source], tempDir, '', 7000);
        if (compile.code !== 0) {
          results.push({ testCase: i + 1, input, expected: String(testCase.expected ?? '').trim(), actual: '', passed: false, error: compile.stderr });
          continue;
        }
        command = 'java';
        args = ['Main'];
      } else {
        throw new Error(`Desteklenmeyen dil: ${language}`);
      }

      const run = await runProcess(command, args, tempDir, input, 5000);
      const actual = run.stdout.trim();
      const expected = String(testCase.expected ?? '').trim();
      results.push({
        testCase: i + 1,
        input,
        expected,
        actual,
        passed: !run.timedOut && run.code === 0 && actual === expected,
        error: run.timedOut ? 'Zaman aşımı (5s)' : (run.stderr || null)
      });
    }

    return {
      success: results.length > 0 && results.every(r => r.passed),
      results,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      total: results.length
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { executeCode };
