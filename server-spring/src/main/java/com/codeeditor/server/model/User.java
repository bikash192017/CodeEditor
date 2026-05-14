package com.codeeditor.server.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "users")
public class User {

    @Id
    private String id;

    @Indexed(unique = true)
    private String username;

    @Indexed(unique = true)
    private String email;

    private String password;

    private String avatar = "";

    private String resetPasswordToken;

    private Instant resetPasswordExpire;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    /**
     * Generate a reset password token (mirrors Node.js crypto.randomBytes + sha256)
     * @return the raw token to send to the user
     */
    public String generateResetPasswordToken() {
        try {
            // Generate random bytes
            byte[] randomBytes = new byte[20];
            new SecureRandom().nextBytes(randomBytes);
            String resetToken = HexFormat.of().formatHex(randomBytes);

            // Hash the token with SHA-256
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(resetToken.getBytes());
            this.resetPasswordToken = HexFormat.of().formatHex(hash);

            // Set expiry to 10 minutes from now
            this.resetPasswordExpire = Instant.now().plusSeconds(10 * 60);

            return resetToken;
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate reset token", e);
        }
    }
}
