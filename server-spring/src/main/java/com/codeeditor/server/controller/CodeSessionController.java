package com.codeeditor.server.controller;

import com.codeeditor.server.dto.ApiResponse;
import com.codeeditor.server.model.CodeSession;
import com.codeeditor.server.repository.CodeSessionRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/sessions")
public class CodeSessionController {

    private final CodeSessionRepository sessionRepo;

    public CodeSessionController(CodeSessionRepository sessionRepo) {
        this.sessionRepo = sessionRepo;
    }

    @PostMapping("/create")
    public ResponseEntity<ApiResponse> createSession(HttpServletRequest request, @RequestBody Map<String, String> body) {
        try {
            if (!isAuth(request)) return unauth();
            CodeSession session = new CodeSession();
            session.setRoomId(body.get("roomId"));
            session = sessionRepo.save(session);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.success("Code session created successfully", Map.of("session", session)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<ApiResponse> getAll(HttpServletRequest request) {
        try {
            var sessions = sessionRepo.findAll();
            return ResponseEntity.ok(ApiResponse.success(Map.of("sessions", sessions)));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<ApiResponse> getById(@PathVariable String sessionId) {
        try {
            var opt = sessionRepo.findById(sessionId);
            if (opt.isEmpty()) return ResponseEntity.status(404).body(ApiResponse.error("Code session not found"));
            return ResponseEntity.ok(ApiResponse.success(Map.of("session", opt.get())));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }

    @PutMapping("/{sessionId}")
    public ResponseEntity<ApiResponse> update(HttpServletRequest request, @PathVariable String sessionId, @RequestBody Map<String, String> body) {
        try {
            var opt = sessionRepo.findById(sessionId);
            if (opt.isEmpty()) return ResponseEntity.status(404).body(ApiResponse.error("Session not found"));
            CodeSession session = opt.get();
            CodeSession.Snapshot snap = new CodeSession.Snapshot();
            snap.setCode(body.get("code"));
            snap.setTimestamp(Instant.now());
            snap.setUserId(isAuth(request) ? uid(request) : null);
            session.getSnapshots().add(snap);
            session.trimSnapshots();
            session = sessionRepo.save(session);
            return ResponseEntity.ok(ApiResponse.success("Code updated successfully", Map.of("session", session)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @DeleteMapping("/{sessionId}")
    public ResponseEntity<ApiResponse> delete(@PathVariable String sessionId) {
        try {
            var opt = sessionRepo.findById(sessionId);
            if (opt.isEmpty()) return ResponseEntity.status(404).body(ApiResponse.error("Session not found"));
            sessionRepo.deleteById(sessionId);
            return ResponseEntity.ok(ApiResponse.builder().success(true).message("Session deleted successfully").build());
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }

    private boolean isAuth(HttpServletRequest r) { return Boolean.TRUE.equals(r.getAttribute("authenticated")); }
    private String uid(HttpServletRequest r) { return (String) r.getAttribute("userId"); }
    private ResponseEntity<ApiResponse> unauth() { return ResponseEntity.status(401).body(ApiResponse.error("Not authenticated")); }
}
