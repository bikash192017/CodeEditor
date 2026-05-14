package com.codeeditor.server.controller;

import com.codeeditor.server.dto.ApiResponse;
import com.codeeditor.server.model.ExecutionHistory;
import com.codeeditor.server.repository.ExecutionHistoryRepository;
import com.codeeditor.server.util.CodeRunner;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.FileWriter;
import java.util.Map;

@RestController
@RequestMapping("/api/execute")
public class ExecuteController {

    private final ExecutionHistoryRepository historyRepo;

    public ExecuteController(ExecutionHistoryRepository historyRepo) {
        this.historyRepo = historyRepo;
    }

    /** POST /api/execute - Execute code (does NOT auto-save) */
    @PostMapping
    public ResponseEntity<ApiResponse> execute(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        try {
            String language = (String) body.get("language");
            String code = (String) body.get("code");
            String stdin = (String) body.getOrDefault("stdin", "");
            if (language == null || code == null) return ResponseEntity.badRequest().body(ApiResponse.error("Language and code are required"));
            var result = CodeRunner.runCode(language, code, stdin);
            return ResponseEntity.ok(ApiResponse.builder().success(true).message("Code executed successfully")
                    .data(Map.of("output", result.output(), "stderr", "", "time", "")).build());
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error("Failed to execute code"));
        }
    }

    /** POST /api/execute/save - Save executed code to file + database */
    @PostMapping("/save")
    public ResponseEntity<ApiResponse> save(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        try {
            String language = (String) body.get("language");
            String code = (String) body.get("code");
            String output = (String) body.getOrDefault("output", "");
            String roomId = (String) body.get("roomId");
            if (language == null || code == null) return ResponseEntity.badRequest().body(ApiResponse.error("Language and code are required"));

            Map<String, String> extMap = Map.of("javascript","js","typescript","ts","python","py","java","java","cpp","cpp","c","c");
            String ext = extMap.getOrDefault(language, "txt");
            File dir = new File("executions");
            if (!dir.exists()) dir.mkdirs();
            String fileName = "run_" + System.currentTimeMillis() + "." + ext;
            try (FileWriter fw = new FileWriter(new File(dir, fileName))) { fw.write(code); }

            ExecutionHistory h = new ExecutionHistory();
            h.setUser(isAuth(request) ? uid(request) : null);
            h.setRoomId(roomId);
            h.setLanguage(language);
            h.setCode(code);
            h.setOutput(output);
            h = historyRepo.save(h);
            return ResponseEntity.status(201).body(ApiResponse.success("Execution saved successfully as file", h));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }

    /** GET /api/execute/history */
    @GetMapping("/history")
    public ResponseEntity<ApiResponse> getHistory(HttpServletRequest request) {
        try {
            var history = historyRepo.findByUserOrderByCreatedAtDesc(uid(request), PageRequest.of(0, 20));
            return ResponseEntity.ok(ApiResponse.builder().success(true).count(history.size()).data(history).build());
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }

    /** GET /api/execute/history/:roomId */
    @GetMapping("/history/{roomId}")
    public ResponseEntity<ApiResponse> getRoomHistory(@PathVariable String roomId) {
        try {
            var history = historyRepo.findByRoomIdOrderByCreatedAtDesc(roomId, PageRequest.of(0, 50));
            return ResponseEntity.ok(ApiResponse.builder().success(true).count(history.size()).data(history).build());
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }

    /** DELETE /api/execute/history */
    @DeleteMapping("/history")
    public ResponseEntity<ApiResponse> clearHistory(HttpServletRequest request) {
        try {
            historyRepo.deleteByUser(uid(request));
            return ResponseEntity.ok(ApiResponse.builder().success(true).message("Saved executions cleared successfully").build());
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }

    /** DELETE /api/execute/history/:id */
    @DeleteMapping("/history/{id}")
    public ResponseEntity<ApiResponse> deleteOne(HttpServletRequest request, @PathVariable String id) {
        try {
            var opt = historyRepo.findByIdAndUser(id, uid(request));
            if (opt.isEmpty()) return ResponseEntity.status(404).body(ApiResponse.error("File not found or unauthorized"));
            historyRepo.deleteById(id);
            return ResponseEntity.ok(ApiResponse.builder().success(true).message("Execution file deleted successfully").build());
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }

    private boolean isAuth(HttpServletRequest r) { return Boolean.TRUE.equals(r.getAttribute("authenticated")); }
    private String uid(HttpServletRequest r) { return (String) r.getAttribute("userId"); }
}
