package com.codeeditor.server.controller;

import com.codeeditor.server.dto.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private static final Logger log = LoggerFactory.getLogger(AiController.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${app.gemini.api-key:}")
    private String geminiApiKey;

    private WebClient geminiClient;

    private WebClient getGeminiClient() {
        if (geminiClient == null) {
            geminiClient = WebClient.builder()
                    .baseUrl("https://generativelanguage.googleapis.com")
                    .build();
        }
        return geminiClient;
    }

    /** POST /api/ai/analyze - Analyze code with Gemini */
    @PostMapping("/analyze")
    public ResponseEntity<?> analyzeCode(@RequestBody Map<String, String> body) {
        if (geminiApiKey == null || geminiApiKey.isEmpty()) {
            return ResponseEntity.status(500).body(ApiResponse.builder()
                    .success(false).message("Gemini API key is not configured.").hasApiKey(false).build());
        }

        try {
            String code = body.get("code");
            String language = body.get("language");

            String prompt = "Analyze the following " + language + " code and identify any function or variable names that are used but not defined in this file. "
                    + "Return the names as a JSON array of strings in the format: {\"missing\": [{\"name\": \"varName\", \"type\": \"variable\"}, {\"name\": \"funcName\", \"type\": \"function\"}]}. "
                    + "If all functions and variables are defined, return an empty array for \"missing\".\n\nCode:\n" + code;

            Map<String, Object> requestBody = Map.of(
                    "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt))))
            );

            String response = getGeminiClient().post()
                    .uri("/v1beta/models/gemini-2.5-flash:generateContent?key=" + geminiApiKey)
                    .header("Content-Type", "application/json")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode root = objectMapper.readTree(response);
            String text = root.path("candidates").path(0).path("content").path("parts").path(0).path("text").asText();

            // Extract JSON from response
            Pattern p = Pattern.compile("\\{[\\s\\S]*\\}");
            Matcher m = p.matcher(text);
            List<?> missing = List.of();
            if (m.find()) {
                JsonNode parsed = objectMapper.readTree(m.group());
                if (parsed.has("missing")) {
                    missing = objectMapper.convertValue(parsed.get("missing"), List.class);
                }
            }
            return ResponseEntity.ok(Map.of("success", true, "missing", missing));
        } catch (Exception e) {
            log.error("Gemini Analysis Error: {}", e.getMessage());
            return ResponseEntity.status(500).body(ApiResponse.builder()
                    .success(false).message(e.getMessage()).hasApiKey(true).build());
        }
    }
}
