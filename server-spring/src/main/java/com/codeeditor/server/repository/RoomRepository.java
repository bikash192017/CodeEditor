package com.codeeditor.server.repository;

import com.codeeditor.server.model.Room;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends MongoRepository<Room, String> {

    Optional<Room> findByRoomId(String roomId);

    List<Room> findByIsPublicTrueOrderByUpdatedAtDesc();

    List<Room> findByOwnerIdOrderByUpdatedAtDesc(String ownerId);

    @Query("{ '$or': [ { 'ownerId': ?0 }, { 'collaborators': ?0 }, { 'isPublic': true } ] }")
    List<Room> findAccessibleRooms(String userId);

    boolean existsByRoomId(String roomId);
}
