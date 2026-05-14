package com.codeeditor.server.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "rooms")
public class Room {

    @Id
    private String id;

    @Indexed(unique = true)
    private String roomId;

    private String name;

    @Field(targetType = FieldType.OBJECT_ID)
    private String ownerId; // References User._id

    private String language = "javascript"; // javascript, python, java, cpp, typescript, go, rust

    private String code = "// Start coding...";

    @Field(targetType = FieldType.OBJECT_ID)
    private List<String> collaborators = new ArrayList<>(); // List of User._id

    private List<RoomUser> users = new ArrayList<>();

    private int maxUsers = 50;

    private boolean isPublic = false;

    private boolean isActive = true;

    private boolean requireApproval = true;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RoomUser {
        @Field(targetType = FieldType.OBJECT_ID)
        private String userId;
        private String userName;
        private String role; // "owner" or "collaborator"
        private Instant joinedAt = Instant.now();
    }
}
