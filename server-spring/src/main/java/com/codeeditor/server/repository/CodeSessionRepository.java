package com.codeeditor.server.repository;

import com.codeeditor.server.model.CodeSession;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CodeSessionRepository extends MongoRepository<CodeSession, String> {

    Optional<CodeSession> findByRoomId(String roomId);

    @Query("{ '$or': [ { 'ownerId': ?0 }, { 'isPublic': true } ] }")
    List<CodeSession> findAccessibleSessions(String userId);
}
