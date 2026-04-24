const pgConn = require('./library/pgConnection');
const config = require('./configuration/connection');

async function migrate() {
    try {
        console.log("Running migration for tms_aos01...");
        const sql = `ALTER TABLE public.tbl_petrol_mail_alert ADD COLUMN IF NOT EXISTS last_alert_dt TIMESTAMP;`;
        
        // Pass the explicit DB name or empty string if it uses the connection string's default DB.
        const dbName = "tms_aos01";
        const result = await pgConn.execute(dbName, sql, config.connectionString());
        console.log(`Migration result:`, result.code === true ? result.message || 'Error' : 'Success');
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
