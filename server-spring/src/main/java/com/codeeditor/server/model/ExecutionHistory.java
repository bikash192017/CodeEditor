package com.codeeditor.server.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "executionhistories")
@CompoundIndexes({
    @CompoundIndex(name = "user_created_idx", def = "{'user': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "roomId_created_idx", def = "{'roomId': 1, 'createdAt': -1}")
})
public class ExecutionHistory {

    @Id
    private String id;

    @Field(targetType = FieldType.OBJECT_ID)
    private String user; // References User._id (nullable)

    private String roomId; // Optional room ID

    private String language; // javascript, typescript, python, cpp, java, c

    private String code;

    private String stdin = "";

    private String output = "";

    private String stderr = "";

    private Double time; // Execution time in milliseconds

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
