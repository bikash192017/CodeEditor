package com.codeeditor.server.controller;

import com.codeeditor.server.dto.ApiResponse;
import com.codeeditor.server.model.Room;
import com.codeeditor.server.repository.RoomRepository;
import com.codeeditor.server.util.RoomIdGenerator;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private static final Logger log = LoggerFactory.getLogger(RoomController.class);
    private final RoomRepository roomRepository;

    @Value("${app.cors.allowed-origins:http://localhost:5173}")
    private String clientUrls;

    public RoomController(RoomRepository roomRepository) {
        this.roomRepository = roomRepository;
    }

    @PostMapping
    public ResponseEntity<ApiResponse> createRoom(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        try {
            if (!isAuth(request)) return unauth();
            String userId = uid(request);
            String username = (String) request.getAttribute("username");

            Boolean isPublic = body.get("isPublic") instanceof Boolean b ? b : false;
            Boolean reqApproval = body.get("requireApproval") instanceof Boolean b ? b : true;

            String roomId;
            do { roomId = RoomIdGenerator.generateRoomId(); } while (roomRepository.existsByRoomId(roomId));

            Room room = new Room();
            room.setRoomId(roomId);
            room.setName(body.getOrDefault("name", "Untitled Room").toString());
            room.setOwnerId(userId);
            room.setLanguage(body.getOrDefault("language", "javascript").toString());
            room.setPublic(isPublic);
            room.setRequireApproval(isPublic ? reqApproval : false);

            Room.RoomUser ownerUser = new Room.RoomUser();
            ownerUser.setUserId(userId);
            ownerUser.setUserName(username != null ? username : "Unknown");
            ownerUser.setRole("owner");
            ownerUser.setJoinedAt(Instant.now());
            room.setUsers(new ArrayList<>(List.of(ownerUser)));
            room = roomRepository.save(room);

            String clientUrl = clientUrls.split(",")[0].trim();
            String shareableLink = clientUrl + "/rooms/" + room.getRoomId();

            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.success("Room created successfully",
                            Map.of("room", room, "roomId", room.getRoomId(), "shareableLink", shareableLink)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<ApiResponse> getRooms(HttpServletRequest request,
            @RequestParam(value = "public", required = false) String pub,
            @RequestParam(value = "owner", required = false) String owner) {
        try {
            List<Room> rooms;
            if ("true".equals(pub)) rooms = roomRepository.findByIsPublicTrueOrderByUpdatedAtDesc();
            else if (isAuth(request) && "me".equals(owner)) rooms = roomRepository.findByOwnerIdOrderByUpdatedAtDesc(uid(request));
            else if (isAuth(request)) rooms = roomRepository.findAccessibleRooms(uid(request));
            else rooms = roomRepository.findByIsPublicTrueOrderByUpdatedAtDesc();
            return ResponseEntity.ok(ApiResponse.success(Map.of("rooms", rooms)));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/{roomId}")
    public ResponseEntity<ApiResponse> getRoomById(HttpServletRequest request, @PathVariable String roomId) {
        try {
            var opt = roomRepository.findByRoomId(roomId);
            if (opt.isEmpty()) return ResponseEntity.status(404).body(ApiResponse.error("Room not found"));
            Room room = opt.get();
            if (!room.isPublic() && isAuth(request)) {
                String userId = uid(request);
                if (!room.getOwnerId().equals(userId) && !room.getCollaborators().contains(userId))
                    return ResponseEntity.status(403).body(ApiResponse.error("Access denied"));
            }
            return ResponseEntity.ok(ApiResponse.success(Map.of("room", room)));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }

    @PutMapping("/{roomId}")
    public ResponseEntity<ApiResponse> updateRoom(HttpServletRequest request, @PathVariable String roomId, @RequestBody Map<String, Object> body) {
        try {
            if (!isAuth(request)) return unauth();
            var opt = roomRepository.findByRoomId(roomId);
            if (opt.isEmpty()) return ResponseEntity.status(404).body(ApiResponse.error("Room not found"));
            Room room = opt.get();
            if (!room.getOwnerId().equals(uid(request))) return ResponseEntity.status(403).body(ApiResponse.error("Only room owner can update"));
            if (body.containsKey("name")) room.setName(body.get("name").toString());
            if (body.containsKey("language")) room.setLanguage(body.get("language").toString());
            if (body.containsKey("code")) room.setCode(body.get("code").toString());
            if (body.containsKey("isPublic")) { boolean p = (Boolean) body.get("isPublic"); room.setPublic(p); if (!p) room.setRequireApproval(false); }
            if (body.containsKey("requireApproval")) room.setRequireApproval(room.isPublic() ? (Boolean) body.get("requireApproval") : false);
            room = roomRepository.save(room);
            return ResponseEntity.ok(ApiResponse.success("Room updated successfully", Map.of("room", room)));
        } catch (Exception e) { return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage())); }
    }

    @PostMapping("/{roomId}/add-collaborator")
    public ResponseEntity<ApiResponse> addCollaborator(HttpServletRequest request, @PathVariable String roomId, @RequestBody Map<String, String> body) {
        try {
            if (!isAuth(request)) return unauth();
            var opt = roomRepository.findByRoomId(roomId);
            if (opt.isEmpty()) return ResponseEntity.status(404).body(ApiResponse.error("Room not found"));
            Room room = opt.get();
            if (!room.getOwnerId().equals(uid(request))) return ResponseEntity.status(403).body(ApiResponse.error("Only room owner can add collaborators"));
            String cId = body.get("userId");
            if (room.getCollaborators().contains(cId)) return ResponseEntity.badRequest().body(ApiResponse.error("User is already a collaborator"));
            room.getCollaborators().add(cId);
            room = roomRepository.save(room);
            return ResponseEntity.ok(ApiResponse.success("Collaborator added successfully", Map.of("room", room)));
        } catch (Exception e) { return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage())); }
    }

    @PostMapping("/{roomId}/join")
    public ResponseEntity<ApiResponse> joinRoom(HttpServletRequest request, @PathVariable String roomId) {
        try {
            if (!isAuth(request)) return unauth();
            String userId = uid(request);
            String username = (String) request.getAttribute("username");
            String nid = RoomIdGenerator.normalizeRoomId(roomId);
            if (!RoomIdGenerator.validateRoomIdFormat(nid)) return ResponseEntity.badRequest().body(ApiResponse.error("Invalid room ID format. Expected format: ABC-123"));
            var opt = roomRepository.findByRoomId(nid);
            if (opt.isEmpty()) return ResponseEntity.status(404).body(ApiResponse.error("Room not found"));
            Room room = opt.get();
            if (!room.isActive()) return ResponseEntity.status(403).body(ApiResponse.error("Room is no longer active"));
            boolean isOwner = room.getOwnerId().equals(userId);
            boolean isCollab = room.getCollaborators().contains(userId);
            boolean existing = room.getUsers().stream().anyMatch(u -> u.getUserId().equals(userId));
            if (existing) return ResponseEntity.ok(ApiResponse.success("Already in room (rejoined successfully)", Map.of("room", room)));
            if (room.getUsers().size() >= room.getMaxUsers()) return ResponseEntity.status(403).body(ApiResponse.error(String.format("Room is full (%d/%d users)", room.getUsers().size(), room.getMaxUsers())));
            if (room.isRequireApproval() && !isOwner && !isCollab) {
                return ResponseEntity.ok(ApiResponse.builder().success(false).requireApproval(true).message("Waiting for owner approval...").data(Map.of("roomId", room.getRoomId(), "roomName", room.getName(), "ownerId", room.getOwnerId())).build());
            }
            if (!isOwner && !isCollab) room.getCollaborators().add(userId);
            Room.RoomUser nu = new Room.RoomUser(); nu.setUserId(userId); nu.setUserName(username != null ? username : "Unknown"); nu.setRole(isOwner ? "owner" : "collaborator"); nu.setJoinedAt(Instant.now());
            room.getUsers().add(nu);
            room = roomRepository.save(room);
            return ResponseEntity.ok(ApiResponse.success("Joined room successfully", Map.of("room", room)));
        } catch (Exception e) { return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage())); }
    }

    @PostMapping("/{roomId}/leave")
    public ResponseEntity<ApiResponse> leaveRoom(HttpServletRequest request, @PathVariable String roomId) {
        try {
            if (!isAuth(request)) return unauth();
            String userId = uid(request);
            var opt = roomRepository.findByRoomId(roomId);
            if (opt.isEmpty()) return ResponseEntity.status(404).body(ApiResponse.error("Room not found"));
            Room room = opt.get();
            if (room.getOwnerId().equals(userId)) return ResponseEntity.badRequest().body(ApiResponse.error("Room owner cannot leave. Delete the room instead."));
            if (!room.getCollaborators().contains(userId)) return ResponseEntity.badRequest().body(ApiResponse.error("You are not a collaborator"));
            room.getCollaborators().remove(userId);
            roomRepository.save(room);
            return ResponseEntity.ok(ApiResponse.builder().success(true).message("Left room successfully").build());
        } catch (Exception e) { return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage())); }
    }

    @DeleteMapping("/{roomId}")
    public ResponseEntity<ApiResponse> deleteRoom(HttpServletRequest request, @PathVariable String roomId) {
        try {
            if (!isAuth(request)) return unauth();
            var opt = roomRepository.findByRoomId(roomId);
            if (opt.isEmpty()) return ResponseEntity.status(404).body(ApiResponse.error("Room not found"));
            Room room = opt.get();
            if (!room.getOwnerId().equals(uid(request))) return ResponseEntity.status(403).body(ApiResponse.error("Only room owner can delete"));
            roomRepository.deleteById(room.getId());
            return ResponseEntity.ok(ApiResponse.builder().success(true).message("Room deleted successfully").build());
        } catch (Exception e) { return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage())); }
    }

    private boolean isAuth(HttpServletRequest r) { return Boolean.TRUE.equals(r.getAttribute("authenticated")); }
    private String uid(HttpServletRequest r) { return (String) r.getAttribute("userId"); }
    private ResponseEntity<ApiResponse> unauth() { return ResponseEntity.status(401).body(ApiResponse.error("Not authenticated")); }
}
