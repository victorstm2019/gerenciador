const db = require('./server/db.cjs');

db.run("UPDATE message_config SET last_auto_run = NULL WHERE id = 1", (err) => {
    if (err) console.error(err);
    else console.log("Data limpa!");
    process.exit(0);
});
