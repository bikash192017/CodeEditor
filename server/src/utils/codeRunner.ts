import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

interface RunResult {
  output: string;
}

export async function runCode(
  language: string,
  code: string,
  input: string = ""
): Promise<RunResult> {
  const tempDir = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  const fileMap: Record<string, string> = {
    javascript: "Main.js",
    python: "Main.py",
    java: "Main.java",
    c: "main.c",
    cpp: "main.cpp",
  };

  const filename = fileMap[language] || "Main.txt";
  const filepath = path.join(tempDir, filename);
  fs.writeFileSync(filepath, code);

  let compileCmd: string[] = [];
  let runCmd: string[] = [];

  switch (language) {
    case "javascript":
      runCmd = ["node", filepath];
      break;
    case "python":
      runCmd = ["python", filepath];
      break;
    case "java":
      compileCmd = ["javac", filepath];
      runCmd = ["java", "-cp", tempDir, "Main"];
      break;
    case "c":
      compileCmd = ["gcc", filepath, "-o", path.join(tempDir, "a.out")];
      runCmd = [path.join(tempDir, "a.out")];
      break;
    case "cpp":
      compileCmd = ["g++", filepath, "-o", path.join(tempDir, "a.out")];
      runCmd = [path.join(tempDir, "a.out")];
      break;
    default:
      return { output: "❌ Unsupported language" };
  }

  try {
    // Compile step (if applicable)
    if (compileCmd.length > 0) {
      await new Promise<void>((resolve, reject) => {
        const compile = spawn(compileCmd[0], compileCmd.slice(1));
        let compileErr = "";
        compile.stderr.on("data", (data) => (compileErr += data.toString()));
        compile.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(compileErr));
        });
      });
    }

    // Run the compiled or interpreted code
    return await new Promise<RunResult>((resolve, reject) => {
      const run = spawn(runCmd[0], runCmd.slice(1), { cwd: tempDir });
      let output = "";
      let error = "";

      // Write input to stdin
      if (input && input.trim().length > 0) {
        run.stdin.write(input + "\n");
      }
      run.stdin.end();

      // Capture output and errors
      run.stdout.on("data", (data) => (output += data.toString()));
      run.stderr.on("data", (data) => (error += data.toString()));

      // Timeout safety (10 seconds)
      const timeout = setTimeout(() => {
        run.kill("SIGTERM");
        reject(new Error("⏱ Execution timed out (10s limit)"));
      }, 10000);

      run.on("close", (code) => {
        clearTimeout(timeout);
        if (code === 0) resolve({ output: output.trim() || "(no output)" });
        else reject(new Error(error || "❌ Runtime error"));
      });
    });
  } catch (err: any) {
    return { output: err.message || "❌ Execution failed" };
  }
}
