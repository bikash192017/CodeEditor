const mongoose = require('mongoose');

async function check() {
  await mongoose.connect('mongodb+srv://raj9905774_db_user:ExEG66qCo19wF8S9@cluster0.zxmbvwl.mongodb.net/test?appName=Cluster0');
  const users = await mongoose.connection.db.collection('users').find().toArray();
  console.log("Users:", users.map(u => ({ email: u.email, pass: u.password })));
  process.exit(0);
}
check().catch(console.error);
