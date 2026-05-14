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
@Document(collection = "codesessions")
public class CodeSession {

    @Id
    private String id;

    @Indexed(unique = true)
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomId; // References Room._id

    private List<Snapshot> snapshots = new ArrayList<>();

    private List<ChatMessage> chatMessages = new ArrayList<>();

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Snapshot {
        private String code;
        private Instant timestamp = Instant.now();
        @Field(targetType = FieldType.OBJECT_ID)
        private String userId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChatMessage {
        @Field(targetType = FieldType.OBJECT_ID)
        private String userId;
        private String username;
        private String message;
        private Instant timestamp = Instant.now();
    }

    /**
     * Limit snapshots to last 50 entries (mirrors Mongoose pre-save hook)
     */
    public void trimSnapshots() {
        if (this.snapshots.size() > 50) {
            this.snapshots = new ArrayList<>(this.snapshots.subList(this.snapshots.size() - 50, this.snapshots.size()));
        }
    }
}
