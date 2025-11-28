const db = require('./db.cjs');

console.log("Starting Database Verification...");

// Wait for DB to initialize (simple timeout for this script)
setTimeout(() => {
    console.log("Checking Message Config...");
    db.get("SELECT * FROM message_config", (err, row) => {
        if (err) console.error(err);
        else console.log("Message Config:", row ? "OK" : "MISSING");
    });

    console.log("Checking Queue Items...");
    db.all("SELECT * FROM queue_items LIMIT 5", (err, rows) => {
        if (err) console.error(err);
        else console.log(`Queue Items: Found ${rows.length} items`);
    });

    console.log("Checking Blocked Clients...");
    db.all("SELECT * FROM blocked_clients", (err, rows) => {
        if (err) console.error(err);
        else console.log(`Blocked Clients: Found ${rows.length} items`);
    });

    // Keep alive briefly to ensure callbacks run
    setTimeout(() => {
        console.log("Verification Complete.");
        process.exit(0);
    }, 1000);

}, 1000);
