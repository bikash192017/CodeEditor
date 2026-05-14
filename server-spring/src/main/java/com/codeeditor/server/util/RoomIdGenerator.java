package com.codeeditor.server.util;

import java.security.SecureRandom;
import java.util.regex.Pattern;

/**
 * Room ID Generator - generates unique 6-character Room IDs in ABC-123 format.
 * Mirrors the Node.js roomIdGenerator.ts exactly.
 */
public class RoomIdGenerator {

    // Safe character sets (excluding confusing characters: O, I for letters; 0, 1 for numbers)
    private static final String LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final String NUMBERS = "23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    // Flexible format: 3-36 alphanumeric characters with hyphens/underscores
    private static final Pattern FLEXIBLE_FORMAT = Pattern.compile("^[a-zA-Z0-9_-]{3,36}$");
    private static final Pattern CONFUSING_CHARS = Pattern.compile("[OI01]");

    /**
     * Generate a random Room ID in ABC-123 format (e.g., "XYZ-456")
     */
    public static String generateRoomId() {
        StringBuilder sb = new StringBuilder();

        // Generate 3 random letters
        for (int i = 0; i < 3; i++) {
            sb.append(LETTERS.charAt(RANDOM.nextInt(LETTERS.length())));
        }

        sb.append('-');

        // Generate 3 random numbers
        for (int i = 0; i < 3; i++) {
            sb.append(NUMBERS.charAt(RANDOM.nextInt(NUMBERS.length())));
        }

        return sb.toString();
    }

    /**
     * Validate Room ID format.
     * Accepts both ABC-123 (new) and 12-character legacy formats.
     */
    public static boolean validateRoomIdFormat(String roomId) {
        if (roomId == null || roomId.isEmpty()) {
            return false;
        }
        return FLEXIBLE_FORMAT.matcher(roomId).matches();
    }

    /**
     * Normalize Room ID (trim whitespace, preserve case for legacy IDs)
     */
    public static String normalizeRoomId(String roomId) {
        return roomId.trim();
    }

    /**
     * Check if a Room ID contains confusing characters
     */
    public static boolean hasConfusingCharacters(String roomId) {
        return CONFUSING_CHARS.matcher(roomId).find();
    }
}
