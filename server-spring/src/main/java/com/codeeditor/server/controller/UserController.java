package com.codeeditor.server.controller;

import com.codeeditor.server.dto.ApiResponse;
import com.codeeditor.server.model.User;
import com.codeeditor.server.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;

    public UserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /** GET /api/users - Fetch all users */
    @GetMapping
    public ResponseEntity<ApiResponse> getAllUsers() {
        try {
            List<User> users = userRepository.findAll();
            // Remove password from response
            users.forEach(u -> u.setPassword(null));
            return ResponseEntity.ok(ApiResponse.success(users));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }

    /** GET /api/users/:userId - Fetch a single user by ID */
    @GetMapping("/{userId}")
    public ResponseEntity<ApiResponse> getUserById(@PathVariable String userId) {
        try {
            var opt = userRepository.findById(userId);
            if (opt.isEmpty()) return ResponseEntity.status(404).body(ApiResponse.error("User not found"));
            User user = opt.get();
            user.setPassword(null);
            return ResponseEntity.ok(ApiResponse.success(user));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }
}
