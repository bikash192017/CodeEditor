package com.codeeditor.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@SpringBootApplication
public class ServerApplication {
    public static void main(String[] args) {
        loadEnv();
        SpringApplication.run(ServerApplication.class, args);
    }

    private static void loadEnv() {
        Path envPath = Paths.get(System.getProperty("user.dir"), ".env");
        if (!Files.exists(envPath)) {
            envPath = Paths.get(System.getProperty("user.dir"), "..", "server-spring", ".env");
        }

        if (Files.exists(envPath)) {
            try (BufferedReader reader = Files.newBufferedReader(envPath)) {
                String line;
                while ((line = reader.readLine()) != null) {
                    line = line.trim();
                    if (line.isEmpty() || line.startsWith("#")) continue;
                    int eqIdx = line.indexOf('=');
                    if (eqIdx > 0) {
                        String key = line.substring(0, eqIdx).trim();
                        String value = line.substring(eqIdx + 1).trim();
                        if (System.getProperty(key) == null && System.getenv(key) == null) {
                            System.setProperty(key, value);
                        }
                    }
                }
                System.out.println("✅ Loaded .env file from: " + envPath);
            } catch (IOException e) {
                System.err.println("⚠️ Failed to load .env file: " + e.getMessage());
            }
        }
    }
}
