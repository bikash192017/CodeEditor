package com.codeeditor.server.security;

import com.codeeditor.server.model.User;
import com.codeeditor.server.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;

/**
 * JWT Authentication filter - mirrors the Node.js protect middleware.
 * Extracts Bearer token, validates it, and sets user info on the request.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public JwtAuthenticationFilter(JwtTokenProvider tokenProvider, UserRepository userRepository, ObjectMapper objectMapper) {
        this.tokenProvider = tokenProvider;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);

            try {
                if (tokenProvider.validateToken(token)) {
                    String userId = tokenProvider.getUserIdFromToken(token);
                    Optional<User> userOpt = userRepository.findById(userId);

                    if (userOpt.isPresent()) {
                        User user = userOpt.get();
                        // Set user attributes on request (mirrors req.user in Express)
                        request.setAttribute("userId", user.getId());
                        request.setAttribute("username", user.getUsername());
                        request.setAttribute("userEmail", user.getEmail());
                        request.setAttribute("userAvatar", user.getAvatar());
                        request.setAttribute("authenticated", true);
                    }
                }
            } catch (Exception e) {
                // Token is invalid - just continue without setting user
                // Protected endpoints will check for the attribute
            }
        }

        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Never skip this filter - it always runs but doesn't block
        // The actual protection is in the controllers checking the attribute
        return false;
    }
}
