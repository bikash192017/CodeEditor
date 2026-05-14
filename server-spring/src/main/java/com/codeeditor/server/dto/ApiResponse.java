package com.codeeditor.server.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Standard API response wrapper - mirrors the Node.js { success, message, data } pattern.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse {

    private boolean success;
    private String message;
    private String token;
    private Object data;

    // For room join with approval
    private Boolean requireApproval;

    // For AI analysis
    private Object missing;

    // For error responses
    private Boolean hasApiKey;

    // For execute
    private String output;
    private String stderr;
    private Integer count;

    public static ApiResponse success(Object data) {
        return ApiResponse.builder().success(true).data(data).build();
    }

    public static ApiResponse success(String message, Object data) {
        return ApiResponse.builder().success(true).message(message).data(data).build();
    }

    public static ApiResponse error(String message) {
        return ApiResponse.builder().success(false).message(message).build();
    }

    public static ApiResponse withToken(String token, Object data) {
        return ApiResponse.builder().success(true).token(token).data(data).build();
    }
}
