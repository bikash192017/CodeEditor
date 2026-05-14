package com.codeeditor.server.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

/**
 * Email sender utility using Resend API.
 * Mirrors the Node.js sendEmail.ts exactly.
 */
@Component
public class EmailSender {

    private static final Logger log = LoggerFactory.getLogger(EmailSender.class);

    @Value("${app.resend.api-key:}")
    private String resendApiKey;

    private final WebClient webClient;

    public EmailSender() {
        this.webClient = WebClient.builder()
                .baseUrl("https://api.resend.com")
                .build();
    }

    public void sendEmail(String email, String subject, String message) {
        // If no RESEND_API_KEY is found (testing locally), simulate the email
        if (resendApiKey == null || resendApiKey.isEmpty()) {
            log.info("✉️ [DEV MODE] Email to {} skipped.", email);
            log.info("✉️ Subject: {}", subject);
            log.info("✉️ Body: \n{}", message);
            return;
        }

        try {
            Map<String, Object> body = Map.of(
                    "from", "CollabCode Team <onboarding@resend.dev>",
                    "to", new String[]{email},
                    "subject", subject,
                    "text", message
            );

            String response = webClient.post()
                    .uri("/emails")
                    .header("Authorization", "Bearer " + resendApiKey)
                    .header("Content-Type", "application/json")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.info("✅ Resend message accepted: {}", response);
        } catch (Exception e) {
            log.error("❌ Resend API error: {}", e.getMessage());
            throw new RuntimeException("Email sending failed via Resend API");
        }
    }
}
