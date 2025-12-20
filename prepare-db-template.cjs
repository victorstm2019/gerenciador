const fs = require('fs');
const path = require('path');
const SqlJsDatabase = require('./server/db-sqljs.cjs');

async function createTemplate() {
    console.log('--- Creating Database Template ---');

    const sourceDb = path.join(__dirname, 'database.sqlite');
    const assetsDir = path.join(__dirname, 'assets');
    const templateDbPath = path.join(assetsDir, 'template.sqlite');

    if (!fs.existsSync(sourceDb)) {
        console.error('Error: Source database.sqlite not found!');
        process.exit(1);
    }

    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }

    // 1. Copy database
    console.log(`Copying ${sourceDb} to ${templateDbPath}...`);
    fs.copyFileSync(sourceDb, templateDbPath);

    // 2. Connect to the copy and sanitize
    console.log('Sanitizing template database...');
    const db = new SqlJsDatabase(templateDbPath);
    await db.init();

    await new Promise((resolve, reject) => {
        db.serialize(() => {
            // Remove W-API config (User must re-configure)
            db.run("DELETE FROM wapi_config", (err) => {
                if (err) console.error('Error clearing wapi_config:', err);
                else console.log('- wapi_config cleared');
            });

            // Remove operational data
            db.run("DELETE FROM queue_items", (err) => {
                if (err) console.error('Error clearing queue_items:', err);
                else console.log('- queue_items cleared');
            });

            db.run("DELETE FROM error_logs", (err) => {
                if (err) console.error('Error clearing error_logs:', err);
                else console.log('- error_logs cleared');
            });

            db.run("DELETE FROM duplicate_logs", (err) => {
                if (err) console.error('Error clearing duplicate_logs:', err);
                else console.log('- duplicate_logs cleared');
            });

            // Reset blocked clients? Maybe keep them.
            // Reset saved queries? Keep them.
            // Reset users? Keep them (as per plan).
            // Reset message_config? Keep them.
            // Reset db_connections? Keep them.

            // Optimize
            db.run("VACUUM", (err) => {
                if (err) reject(err);
                else {
                    console.log('- Database vacuumed');
                    resolve();
                }
            });
        });
    });

    console.log('--- Template Created Successfully ---\n');
}

createTemplate();
