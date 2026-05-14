package com.codeeditor.server.controller;

import com.codeeditor.server.dto.ApiResponse;
import com.codeeditor.server.model.User;
import com.codeeditor.server.repository.UserRepository;
import com.codeeditor.server.security.JwtTokenProvider;
import com.codeeditor.server.util.EmailSender;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;

/**
 * Auth Controller - mirrors Node.js authController.ts exactly.
 * Routes: POST /register, POST /login, GET /me, PUT /profile,
 *         POST /forgotpassword, PUT /resetpassword/:resettoken
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final UserRepository userRepository;
    private final JwtTokenProvider tokenProvider;
    private final PasswordEncoder passwordEncoder;
    private final EmailSender emailSender;

    @Value("${app.cors.allowed-origins}")
    private String clientUrls;

    public AuthController(UserRepository userRepository, JwtTokenProvider tokenProvider,
                          PasswordEncoder passwordEncoder, EmailSender emailSender) {
        this.userRepository = userRepository;
        this.tokenProvider = tokenProvider;
        this.passwordEncoder = passwordEncoder;
        this.emailSender = emailSender;
    }

    /**
     * POST /api/auth/register - Register new user
     */
    @PostMapping("/register")
    public ResponseEntity<ApiResponse> register(@RequestBody Map<String, String> body) {
        try {
            String username = body.get("username");
            String email = body.get("email");
            String password = body.get("password");

            if (username == null || email == null || password == null ||
                username.isBlank() || email.isBlank() || password.isBlank()) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("All fields are required"));
            }

            // Check existing user (mirrors: User.findOne({ $or: [{ email }, { username }] }))
            if (userRepository.findByEmailOrUsername(email.trim().toLowerCase(), username.trim()).isPresent()) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("User already exists"));
            }

            // Hash password (mirrors: bcrypt.genSalt(10) + bcrypt.hash)
            String hashedPassword = passwordEncoder.encode(password);

            User user = new User();
            user.setUsername(username.trim());
            user.setEmail(email.trim().toLowerCase());
            user.setPassword(hashedPassword);
            user = userRepository.save(user);

            String token = tokenProvider.generateToken(user.getId());

            Map<String, Object> userData = buildUserData(user);

            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.withToken(token, Map.of("user", userData)));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(e.getMessage() != null ? e.getMessage() : "Registration failed"));
        }
    }

    /**
     * POST /api/auth/login - Login existing user
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse> login(@RequestBody Map<String, String> body) {
        try {
            String email = body.get("email");
            String password = body.get("password");

            if (email == null || password == null || email.isBlank() || password.isBlank()) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Email and password required"));
            }

            // Find user with password (mirrors: User.findOne({ email }).select('+password'))
            var userOpt = userRepository.findByEmail(email.trim().toLowerCase());
            if (userOpt.isEmpty()) {
                System.out.println("Login Failed: User not found for email: " + email);
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(ApiResponse.error("Invalid credentials"));
            }

            User user = userOpt.get();
            System.out.println("Login: User found, checking password...");

            // Compare password (mirrors: bcrypt.compare)
            if (!passwordEncoder.matches(password, user.getPassword())) {
                System.out.println("Login Failed: Password does not match for email: " + email);
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(ApiResponse.error("Invalid credentials"));
            }
            
            System.out.println("Login Success for email: " + email);

            String token = tokenProvider.generateToken(user.getId());
            Map<String, Object> userData = buildUserData(user);

            return ResponseEntity.ok(ApiResponse.withToken(token, Map.of("user", userData)));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(e.getMessage() != null ? e.getMessage() : "Login failed"));
        }
    }

    /**
     * GET /api/auth/me - Get current authenticated user
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse> getMe(HttpServletRequest request) {
        try {
            if (!isAuthenticated(request)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(ApiResponse.error("Not authenticated"));
            }

            Map<String, Object> user = Map.of(
                    "_id", request.getAttribute("userId"),
                    "id", request.getAttribute("userId"),
                    "username", request.getAttribute("username"),
                    "email", request.getAttribute("userEmail"),
                    "avatar", request.getAttribute("userAvatar") != null ? request.getAttribute("userAvatar") : ""
            );

            return ResponseEntity.ok(ApiResponse.success(Map.of("user", user)));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(e.getMessage() != null ? e.getMessage() : "Failed to get user"));
        }
    }

    /**
     * PUT /api/auth/profile - Update profile
     */
    @PutMapping("/profile")
    public ResponseEntity<ApiResponse> updateProfile(HttpServletRequest request, @RequestBody Map<String, String> body) {
        try {
            if (!isAuthenticated(request)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(ApiResponse.error("Not authenticated"));
            }

            String userId = (String) request.getAttribute("userId");
            var userOpt = userRepository.findById(userId);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("User not found"));
            }

            User user = userOpt.get();

            if (body.containsKey("username")) user.setUsername(body.get("username"));
            if (body.containsKey("email")) user.setEmail(body.get("email"));
            if (body.containsKey("avatar")) user.setAvatar(body.get("avatar"));

            user = userRepository.save(user);
            Map<String, Object> userData = buildUserData(user);

            return ResponseEntity.ok(ApiResponse.success(Map.of("user", userData)));

        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(e.getMessage() != null ? e.getMessage() : "Failed to update profile"));
        }
    }

    /**
     * POST /api/auth/forgotpassword - Forgot Password
     */
    @PostMapping("/forgotpassword")
    public ResponseEntity<ApiResponse> forgotPassword(@RequestBody Map<String, String> body) {
        try {
            String email = body.get("email");
            var userOpt = userRepository.findByEmail(email);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("There is no user with that email"));
            }

            User user = userOpt.get();
            String resetToken = user.generateResetPasswordToken();
            userRepository.save(user);

            // Create reset URL
            String[] urls = clientUrls.split(",");
            String clientUrl = urls.length > 0 ? urls[0].trim() : "http://localhost:5173";
            String resetUrl = clientUrl + "/reset-password/" + resetToken;

            String message = "You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n " + resetUrl;

            try {
                emailSender.sendEmail(user.getEmail(), "Password reset token", message);
                return ResponseEntity.ok(ApiResponse.builder().success(true).data("Email sent").build());
            } catch (Exception err) {
                log.error("Email send failed", err);
                user.setResetPasswordToken(null);
                user.setResetPasswordExpire(null);
                userRepository.save(user);
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(ApiResponse.error("Email could not be sent"));
            }

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(e.getMessage() != null ? e.getMessage() : "Request failed"));
        }
    }

    /**
     * PUT /api/auth/resetpassword/:resettoken - Reset Password
     */
    @PutMapping("/resetpassword/{resettoken}")
    public ResponseEntity<ApiResponse> resetPassword(@PathVariable String resettoken, @RequestBody Map<String, String> body) {
        try {
            // Hash the token to match stored hash
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(resettoken.getBytes());
            String hashedToken = HexFormat.of().formatHex(hash);

            var userOpt = userRepository.findByResetPasswordTokenAndResetPasswordExpireAfter(
                    hashedToken, Instant.now());

            if (userOpt.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Invalid or expired token"));
            }

            User user = userOpt.get();

            // Set new password
            user.setPassword(passwordEncoder.encode(body.get("password")));
            user.setResetPasswordToken(null);
            user.setResetPasswordExpire(null);
            userRepository.save(user);

            String token = tokenProvider.generateToken(user.getId());
            return ResponseEntity.ok(ApiResponse.builder().success(true).token(token).build());

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(e.getMessage() != null ? e.getMessage() : "Request failed"));
        }
    }

    // --- Helper methods ---

    private boolean isAuthenticated(HttpServletRequest request) {
        return Boolean.TRUE.equals(request.getAttribute("authenticated"));
    }

    private Map<String, Object> buildUserData(User user) {
        return Map.of(
                "_id", user.getId(),
                "username", user.getUsername(),
                "email", user.getEmail(),
                "avatar", user.getAvatar() != null ? user.getAvatar() : "",
                "createdAt", user.getCreatedAt() != null ? user.getCreatedAt().toString() : "",
                "updatedAt", user.getUpdatedAt() != null ? user.getUpdatedAt().toString() : ""
        );
    }
    
    @GetMapping("/testbcrypt")
    public ResponseEntity<String> testBcrypt() {
        boolean match = passwordEncoder.matches("nandan123", "$2a$10$MhLe9xpkiJa.Zb3lF41nuO9/l/5qs29R79aRjkA4nTaTiqv4i0FK2");
        return ResponseEntity.ok("Match: " + match);
    }
}
