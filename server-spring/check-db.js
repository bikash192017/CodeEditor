const mongoose = require('mongoose');

async function check() {
  await mongoose.connect('mongodb+srv://raj9905774_db_user:ExEG66qCo19wF8S9@cluster0.zxmbvwl.mongodb.net/?appName=Cluster0');
  console.log("Connected to DB:", mongoose.connection.db.databaseName);
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log("Collections:", collections.map(c => c.name));
  
  const rooms = await mongoose.connection.db.collection('rooms').find().toArray();
  console.log("Rooms count:", rooms.length);
  if (rooms.length > 0) {
      console.log("First room:", rooms[0]);
  }
  process.exit(0);
}
check().catch(console.error);
