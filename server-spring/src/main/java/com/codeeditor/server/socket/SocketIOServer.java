package com.codeeditor.server.socket;

import com.codeeditor.server.util.CodeRunner;
import com.corundumstudio.socketio.*;
import com.corundumstudio.socketio.listener.ConnectListener;
import com.corundumstudio.socketio.listener.DataListener;
import com.corundumstudio.socketio.listener.DisconnectListener;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Socket.IO server using netty-socketio.
 * Mirrors the Node.js socketHandler.ts exactly.
 */
@Component
public class SocketIOServer {

    private static final Logger log = LoggerFactory.getLogger(SocketIOServer.class);

    @Value("${app.socketio.port:5001}")
    private int socketPort;

    @Value("${app.cors.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;

    private com.corundumstudio.socketio.SocketIOServer server;

    // In-memory room states (mirrors Node.js roomStates)
    private final Map<String, RoomData> roomStates = new ConcurrentHashMap<>();

    // Map socketId -> user info
    private final Map<UUID, UserInfo> socketUsers = new ConcurrentHashMap<>();

    record RoomData(StringBuilder code, String[] language, List<Map<String, String>> chat) {}
    record UserInfo(String userId, String username, String roomId) {}

    @PostConstruct
    public void start() {
        Configuration config = new Configuration();
        config.setHostname("0.0.0.0");
        config.setPort(socketPort);
        config.setOrigin(String.join(",", allowedOrigins.split(",")));
        config.setAllowCustomRequests(true);

        // Transport settings
        config.setTransports(Transport.WEBSOCKET, Transport.POLLING);

        server = new com.corundumstudio.socketio.SocketIOServer(config);

        // Connection handler
        server.addConnectListener(onConnect());

        // Room events
        server.addEventListener("room:join", Map.class, onRoomJoin());
        server.addEventListener("room:leave", Map.class, onRoomLeave());
        server.addEventListener("room:request-join", Map.class, onRequestJoin());
        server.addEventListener("room:process-join", Map.class, onProcessJoin());

        // Code events
        server.addEventListener("code:change", Map.class, onCodeChange());
        server.addEventListener("code:run", Map.class, onCodeRun());

        // Cursor/Language/Chat events
        server.addEventListener("cursor:move", Map.class, onCursorMove());
        server.addEventListener("language:change", Map.class, onLanguageChange());
        server.addEventListener("chat:send", Map.class, onChatSend());
        server.addEventListener("user:typing", Map.class, onTyping());

        // WebRTC signaling events
        server.addEventListener("webrtc:offer", Map.class, onWebRTCOffer());
        server.addEventListener("webrtc:answer", Map.class, onWebRTCAnswer());
        server.addEventListener("webrtc:ice-candidate", Map.class, onWebRTCIceCandidate());
        server.addEventListener("webrtc:stop-share", Map.class, onWebRTCStopShare());
        server.addEventListener("webrtc:leave-call", Map.class, onWebRTCLeaveCall());

        // Disconnect handler
        server.addDisconnectListener(onDisconnect());

        server.start();
        log.info("⚡ Socket.IO server started on port {}", socketPort);
    }

    @PreDestroy
    public void stop() {
        if (server != null) server.stop();
    }

    private ConnectListener onConnect() {
        return client -> {
            HandshakeData hd = client.getHandshakeData();
            String username = hd.getSingleUrlParam("username");
            String userId = hd.getSingleUrlParam("userId");
            if (username == null || username.isEmpty()) username = "Guest";
            if (userId == null || userId.isEmpty()) userId = client.getSessionId().toString();

            // Try to get from auth headers
            String token = hd.getSingleUrlParam("token");
            if (token != null && !token.isEmpty()) {
                try {
                    String[] parts = token.split("\\.");
                    if (parts.length >= 2) {
                        String payload = new String(Base64.getUrlDecoder().decode(parts[1]));
                        // Simple JSON parsing for username/id
                        if (payload.contains("\"username\"")) {
                            int idx = payload.indexOf("\"username\"");
                            String sub = payload.substring(idx);
                            int start = sub.indexOf(":\"") + 2;
                            int end = sub.indexOf("\"", start);
                            if (start > 1 && end > start) username = sub.substring(start, end);
                        }
                    }
                } catch (Exception e) { log.error("❌ Invalid token: {}", e.getMessage()); }
            }

            socketUsers.put(client.getSessionId(), new UserInfo(userId, username, null));
            log.info("🟢 Connected: {} ({})", username, client.getSessionId());
        };
    }

    @SuppressWarnings("unchecked")
    private DataListener<Map> onRoomJoin() {
        return (client, data, ack) -> {
            String roomId = (String) data.get("roomId");
            if (roomId == null) return;

            client.joinRoom(roomId);
            UserInfo user = socketUsers.get(client.getSessionId());
            if (user != null) socketUsers.put(client.getSessionId(), new UserInfo(user.userId, user.username, roomId));

            log.info("👋 {} joined {}", user != null ? user.username : "?", roomId);

            // Initialize room state if missing
            roomStates.computeIfAbsent(roomId, k ->
                    new RoomData(new StringBuilder("// Start coding..."), new String[]{"javascript"}, Collections.synchronizedList(new ArrayList<>())));

            // Notify others
            RoomData state = roomStates.get(roomId);
            server.getRoomOperations(roomId).sendEvent("room:joined", Map.of(
                    "roomId", roomId,
                    "userId", user != null ? user.userId : "",
                    "username", user != null ? user.username : "Guest"));

            // Send current state to new user
            client.sendEvent("room:state", Map.of(
                    "code", state.code.toString(),
                    "language", state.language[0],
                    "chat", state.chat));

            // Update user list
            broadcastUserList(roomId);
        };
    }

    @SuppressWarnings("unchecked")
    private DataListener<Map> onRoomLeave() {
        return (client, data, ack) -> {
            String roomId = (String) data.get("roomId");
            if (roomId == null) return;
            client.leaveRoom(roomId);
            UserInfo user = socketUsers.get(client.getSessionId());
            log.info("🚪 {} left {}", user != null ? user.username : "?", roomId);
            server.getRoomOperations(roomId).sendEvent("room:left", Map.of("roomId", roomId, "userId", user != null ? user.userId : ""));
            broadcastUserList(roomId);
        };
    }

    @SuppressWarnings("unchecked")
    private DataListener<Map> onRequestJoin() {
        return (client, data, ack) -> {
            log.info("🛎️ {} requested to join {}", data.get("username"), data.get("roomId"));
            Map<String, Object> payload = new HashMap<>(data);
            payload.put("requestSocketId", client.getSessionId().toString());
            server.getBroadcastOperations().sendEvent("room:join-request", payload);
        };
    }

    @SuppressWarnings("unchecked")
    private DataListener<Map> onProcessJoin() {
        return (client, data, ack) -> {
            String requestSocketId = (String) data.get("requestSocketId");
            Boolean approved = (Boolean) data.get("approved");
            String roomId = (String) data.get("roomId");
            log.info("⚖️ Join request for {} was {}", data.get("userId"), Boolean.TRUE.equals(approved) ? "approved" : "denied");
            try {
                UUID targetId = UUID.fromString(requestSocketId);
                var targetClient = server.getClient(targetId);
                if (targetClient != null) {
                    targetClient.sendEvent("room:join-result", Map.of("roomId", roomId, "approved", approved));
                }
            } catch (Exception e) { log.error("Error processing join: {}", e.getMessage()); }
        };
    }

    @SuppressWarnings("unchecked")
    private DataListener<Map> onCodeChange() {
        return (client, data, ack) -> {
            String roomId = (String) data.get("roomId");
            String code = (String) data.get("code");
            if (roomId == null) return;
            RoomData state = roomStates.get(roomId);
            if (state != null) { state.code.setLength(0); state.code.append(code); }
            UserInfo user = socketUsers.get(client.getSessionId());
            // Broadcast to others (not sender)
            for (var c : server.getRoomOperations(roomId).getClients()) {
                if (!c.getSessionId().equals(client.getSessionId())) {
                    c.sendEvent("code:update", Map.of("roomId", roomId, "code", code, "userId", user != null ? user.userId : ""));
                }
            }
        };
    }

    @SuppressWarnings("unchecked")
    private DataListener<Map> onCodeRun() {
        return (client, data, ack) -> {
            String roomId = (String) data.get("roomId");
            String language = (String) data.get("language");
            String code = (String) data.get("code");
            String input = (String) data.getOrDefault("input", "");
            if (roomId == null) return;

            UserInfo user = socketUsers.get(client.getSessionId());
            try {
                var result = CodeRunner.runCode(language, code, input);
                server.getRoomOperations(roomId).sendEvent("code:output", Map.of(
                        "roomId", roomId,
                        "username", user != null ? user.username : "Guest",
                        "language", language,
                        "code", code,
                        "output", result.output(),
                        "timestamp", LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss"))));
                log.info("🚀 Code executed by {} in {}", user != null ? user.username : "?", roomId);
            } catch (Exception e) {
                server.getRoomOperations(roomId).sendEvent("code:output", Map.of(
                        "roomId", roomId,
                        "username", user != null ? user.username : "Guest",
                        "language", language,
                        "code", code,
                        "output", "❌ Error: " + e.getMessage(),
                        "timestamp", LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss"))));
            }
        };
    }

    @SuppressWarnings("unchecked")
    private DataListener<Map> onCursorMove() {
        return (client, data, ack) -> {
            String roomId = (String) data.get("roomId");
            if (roomId == null) return;
            UserInfo user = socketUsers.get(client.getSessionId());
            for (var c : server.getRoomOperations(roomId).getClients()) {
                if (!c.getSessionId().equals(client.getSessionId())) {
                    c.sendEvent("cursor:update", Map.of(
                            "userId", user != null ? user.userId : "",
                            "username", user != null ? user.username : "Guest",
                            "position", data.get("position")));
                }
            }
        };
    }

    @SuppressWarnings("unchecked")
    private DataListener<Map> onLanguageChange() {
        return (client, data, ack) -> {
            String roomId = (String) data.get("roomId");
            String language = (String) data.get("language");
            if (roomId == null) return;
            RoomData state = roomStates.get(roomId);
            if (state != null) state.language[0] = language;
            server.getRoomOperations(roomId).sendEvent("language:update", Map.of("roomId", roomId, "language", language));
        };
    }

    @SuppressWarnings("unchecked")
    private DataListener<Map> onChatSend() {
        return (client, data, ack) -> {
            String roomId = (String) data.get("roomId");
            String message = (String) data.getOrDefault("message", "");
            String username = (String) data.get("username");
            String fileUrl = (String) data.get("fileUrl");
            if (roomId == null) return;
            if ((message == null || message.isEmpty()) && (fileUrl == null || fileUrl.isEmpty())) return;

            Map<String, String> msg = new HashMap<>();
            msg.put("username", username);
            msg.put("message", message != null ? message : "");
            msg.put("at", java.time.Instant.now().toString());
            if (fileUrl != null) { msg.put("fileUrl", fileUrl); msg.put("fileName", (String) data.get("fileName")); msg.put("fileType", (String) data.get("fileType")); }

            RoomData state = roomStates.get(roomId);
            if (state != null) state.chat.add(msg);

            Map<String, Object> payload = new HashMap<>(msg);
            payload.put("roomId", roomId);
            server.getRoomOperations(roomId).sendEvent("chat:new", payload);
        };
    }

    @SuppressWarnings("unchecked")
    private DataListener<Map> onTyping() {
        return (client, data, ack) -> {
            String roomId = (String) data.get("roomId");
            if (roomId == null) return;
            UserInfo user = socketUsers.get(client.getSessionId());
            for (var c : server.getRoomOperations(roomId).getClients()) {
                if (!c.getSessionId().equals(client.getSessionId())) {
                    c.sendEvent("user:typing", Map.of(
                            "roomId", roomId,
                            "userId", user != null ? user.userId : "",
                            "username", user != null ? user.username : "Guest",
                            "isTyping", data.get("isTyping")));
                }
            }
        };
    }

    // WebRTC signaling
    @SuppressWarnings("unchecked")
    private DataListener<Map> onWebRTCOffer() {
        return (client, data, ack) -> {
            String targetUserId = (String) data.get("targetUserId");
            findClientByUserId(targetUserId).ifPresent(c -> c.sendEvent("webrtc:offer", data));
        };
    }

    @SuppressWarnings("unchecked")
    private DataListener<Map> onWebRTCAnswer() {
        return (client, data, ack) -> {
            String targetUserId = (String) data.get("targetUserId");
            findClientByUserId(targetUserId).ifPresent(c -> c.sendEvent("webrtc:answer", data));
        };
    }

    @SuppressWarnings("unchecked")
    private DataListener<Map> onWebRTCIceCandidate() {
        return (client, data, ack) -> {
            String targetUserId = (String) data.get("targetUserId");
            findClientByUserId(targetUserId).ifPresent(c -> c.sendEvent("webrtc:ice-candidate", data));
        };
    }

    @SuppressWarnings("unchecked")
    private DataListener<Map> onWebRTCStopShare() {
        return (client, data, ack) -> {
            String roomId = (String) data.get("roomId");
            if (roomId != null) {
                for (var c : server.getRoomOperations(roomId).getClients()) {
                    if (!c.getSessionId().equals(client.getSessionId())) c.sendEvent("webrtc:stop-share", data);
                }
            }
        };
    }

    @SuppressWarnings("unchecked")
    private DataListener<Map> onWebRTCLeaveCall() {
        return (client, data, ack) -> {
            String roomId = (String) data.get("roomId");
            if (roomId != null) {
                for (var c : server.getRoomOperations(roomId).getClients()) {
                    if (!c.getSessionId().equals(client.getSessionId())) c.sendEvent("webrtc:leave-call", data);
                }
            }
        };
    }

    private DisconnectListener onDisconnect() {
        return client -> {
            UserInfo user = socketUsers.remove(client.getSessionId());
            log.info("❌ Disconnected: {}", user != null ? user.username : client.getSessionId());
            if (user != null && user.roomId != null) {
                server.getRoomOperations(user.roomId).sendEvent("room:left", Map.of("roomId", user.roomId, "userId", user.userId));
                broadcastUserList(user.roomId);
            }
        };
    }

    private void broadcastUserList(String roomId) {
        List<Map<String, String>> users = new ArrayList<>();
        for (var c : server.getRoomOperations(roomId).getClients()) {
            UserInfo u = socketUsers.get(c.getSessionId());
            if (u != null) users.add(Map.of("userId", u.userId, "username", u.username));
        }
        server.getRoomOperations(roomId).sendEvent("room:users", Map.of("roomId", roomId, "users", users));
    }

    private Optional<SocketIOClient> findClientByUserId(String targetUserId) {
        for (var entry : socketUsers.entrySet()) {
            if (entry.getValue().userId.equals(targetUserId)) {
                var client = server.getClient(entry.getKey());
                if (client != null) return Optional.of(client);
            }
        }
        return Optional.empty();
    }
}
