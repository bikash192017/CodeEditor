package com.codeeditor.server.repository;

import com.codeeditor.server.model.ExecutionHistory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExecutionHistoryRepository extends MongoRepository<ExecutionHistory, String> {

    List<ExecutionHistory> findByUserOrderByCreatedAtDesc(String userId, Pageable pageable);

    List<ExecutionHistory> findByRoomIdOrderByCreatedAtDesc(String roomId, Pageable pageable);

    void deleteByUser(String userId);

    Optional<ExecutionHistory> findByIdAndUser(String id, String userId);
}
