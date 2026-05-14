const bcrypt = require('bcryptjs');
bcrypt.compare('nandan123', '$2a$10$MhLe9xpkiJa.Zb3lF41nuO9/l/5qs29R79aRjkA4nTaTiqv4i0FK2').then(res => {
    console.log("Match:", res);
});
