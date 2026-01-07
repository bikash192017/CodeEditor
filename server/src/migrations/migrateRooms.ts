/**
 * Migration Script: Add new fields to existing rooms
 * 
 * This script updates all existing rooms in the database to include:
 * - users: array with owner as first user
 * - maxUsers: default 50
 * - isActive: default true
 * 
 * Run this script ONCE with: node server/src/migrations/migrateRooms.js
 */

import mongoose from 'mongoose';
import { Room } from '../models/Room.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function migrateRooms() {
    try {
        console.log('🔄 Starting room migration...');


        // Connect to MongoDB using environment variable
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/codeeditor';

        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Find all rooms that don't have the new fields
        const roomsToMigrate = await Room.find({
            $or: [
                { users: { $exists: false } },
                { maxUsers: { $exists: false } },
                { isActive: { $exists: false } }
            ]
        });

        console.log(`📊 Found ${roomsToMigrate.length} rooms to migrate`);

        if (roomsToMigrate.length === 0) {
            console.log('✅ No rooms need migration. All rooms are up to date!');
            await mongoose.disconnect();
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        // Migrate each room
        for (const room of roomsToMigrate) {
            try {
                // Add users array if missing
                if (!room.users || room.users.length === 0) {
                    room.users = [{
                        userId: room.ownerId,
                        userName: 'Room Owner', // Default name since we can't populate
                        role: 'owner',
                        joinedAt: room.createdAt || new Date()
                    }];
                }

                // Add maxUsers if missing
                if (!room.maxUsers) {
                    room.maxUsers = 50;
                }

                // Add isActive if missing
                if (room.isActive === undefined) {
                    room.isActive = true;
                }

                await room.save();
                successCount++;
                console.log(`✅ Migrated room: ${room.roomId} (${room.name})`);
            } catch (error: any) {
                errorCount++;
                console.error(`❌ Failed to migrate room ${room.roomId}:`, error.message);
            }
        }

        console.log('\n📊 Migration Summary:');
        console.log(`   ✅ Successfully migrated: ${successCount} rooms`);
        console.log(`   ❌ Failed: ${errorCount} rooms`);
        console.log(`   📝 Total processed: ${roomsToMigrate.length} rooms`);

        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('\n✅ Migration complete! Database disconnected.');

    } catch (error: any) {
        console.error('❌ Migration failed:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run migration
migrateRooms();
