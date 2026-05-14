package com.codeeditor.server.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.*;

/**
 * Code Runner utility - executes code in various languages.
 * Mirrors the Node.js codeRunner.ts exactly.
 */
public class CodeRunner {

    private static final Logger log = LoggerFactory.getLogger(CodeRunner.class);

    private static final Map<String, String> FILE_MAP = Map.of(
            "javascript", "Main.js",
            "python", "Main.py",
            "java", "Main.java",
            "c", "main.c",
            "cpp", "main.cpp"
    );

    private static final long TIMEOUT_SECONDS = 10;

    public record RunResult(String output) {}

    public static RunResult runCode(String language, String code, String input) {
        try {
            // Create unique temp directory
            String uniqueId = java.util.UUID.randomUUID().toString();
            Path tempDir = Path.of(System.getProperty("user.dir"), "temp", uniqueId);
            Files.createDirectories(tempDir);

            String filename = FILE_MAP.getOrDefault(language, "Main.txt");
            String mainClassName = "Main";

            if ("java".equals(language)) {
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("class\\s+([a-zA-Z_$][a-zA-Z\\d_$]*)").matcher(code);
                if (m.find()) {
                    mainClassName = m.group(1);
                }
                filename = mainClassName + ".java";
            }

            Path filepath = tempDir.resolve(filename);
            Files.writeString(filepath, code);

            String[] compileCmd = null;
            String[] runCmd = null;

            switch (language) {
                case "javascript":
                    runCmd = new String[]{"node", filepath.toString()};
                    break;
                case "python":
                    runCmd = new String[]{"python", filepath.toString()};
                    break;
                case "java":
                    compileCmd = new String[]{"javac", filepath.toString()};
                    runCmd = new String[]{"java", "-cp", tempDir.toString(), mainClassName};
                    break;
                case "c":
                    compileCmd = new String[]{"gcc", filepath.toString(), "-o", tempDir.resolve("a.out").toString()};
                    runCmd = new String[]{tempDir.resolve("a.out").toString()};
                    break;
                case "cpp":
                    compileCmd = new String[]{"g++", filepath.toString(), "-o", tempDir.resolve("a.out").toString()};
                    runCmd = new String[]{tempDir.resolve("a.out").toString()};
                    break;
                default:
                    return new RunResult("❌ Unsupported language");
            }

            // On Windows, ProcessBuilder needs cmd.exe to resolve commands like node or python
            boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
            
            // Compile step (if applicable)
            if (compileCmd != null) {
                if (isWindows) {
                    String[] newCmd = new String[compileCmd.length + 2];
                    newCmd[0] = "cmd.exe";
                    newCmd[1] = "/c";
                    System.arraycopy(compileCmd, 0, newCmd, 2, compileCmd.length);
                    compileCmd = newCmd;
                }
                ProcessBuilder compilePB = new ProcessBuilder(compileCmd);
                compilePB.directory(tempDir.toFile());
                compilePB.redirectErrorStream(false);
                Process compileProcess = compilePB.start();

                StringBuilder compileErr = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(compileProcess.getErrorStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        compileErr.append(line).append("\n");
                    }
                }

                boolean compileFinished = compileProcess.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);
                if (!compileFinished) {
                    compileProcess.destroyForcibly();
                    return new RunResult("⏱ Compilation timed out");
                }
                if (compileProcess.exitValue() != 0) {
                    return new RunResult(compileErr.toString().trim());
                }
            }

            if (isWindows) {
                String[] newCmd = new String[runCmd.length + 2];
                newCmd[0] = "cmd.exe";
                newCmd[1] = "/c";
                System.arraycopy(runCmd, 0, newCmd, 2, runCmd.length);
                runCmd = newCmd;
            }
            // Run the compiled or interpreted code
            ProcessBuilder runPB = new ProcessBuilder(runCmd);
            runPB.directory(tempDir.toFile());
            runPB.redirectErrorStream(false);
            Process runProcess = runPB.start();

            // Write input to stdin
            if (input != null && !input.trim().isEmpty()) {
                try (OutputStream stdin = runProcess.getOutputStream()) {
                    stdin.write((input + "\n").getBytes());
                    stdin.flush();
                }
            } else {
                runProcess.getOutputStream().close();
            }

            // Capture output
            StringBuilder output = new StringBuilder();
            StringBuilder error = new StringBuilder();

            ExecutorService executor = Executors.newFixedThreadPool(2);
            Future<?> outputFuture = executor.submit(() -> {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(runProcess.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        output.append(line).append("\n");
                    }
                } catch (IOException e) {
                    // ignore
                }
            });
            Future<?> errorFuture = executor.submit(() -> {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(runProcess.getErrorStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        error.append(line).append("\n");
                    }
                } catch (IOException e) {
                    // ignore
                }
            });

            boolean finished = runProcess.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                runProcess.destroyForcibly();
                executor.shutdownNow();
                return new RunResult("⏱ Execution timed out (10s limit)");
            }

            outputFuture.get(2, TimeUnit.SECONDS);
            errorFuture.get(2, TimeUnit.SECONDS);
            executor.shutdown();

            if (runProcess.exitValue() == 0) {
                String result = output.toString().trim();
                return new RunResult(result.isEmpty() ? "(no output)" : result);
            } else {
                String errMsg = error.toString().trim();
                return new RunResult(errMsg.isEmpty() ? "❌ Runtime error" : errMsg);
            }

        } catch (Exception e) {
            log.error("Code execution failed: {}", e.getMessage());
            return new RunResult(e.getMessage() != null ? e.getMessage() : "❌ Execution failed");
        }
    }
}
