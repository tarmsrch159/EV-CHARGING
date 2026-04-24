const pool = require('../../db');

class ConnectionConfigsService {

    // ดึงข้อมูลทั้งหมด
    async getAll() {
        const result = await pool.query(
            `SELECT * FROM tbl_connection_configs WHERE config_flag = '1' ORDER BY config_id ASC`
        );
        return result.rows;
    }

    // ดึงข้อมูลตาม ID
    async getById(id) {
        const result = await pool.query(
            `SELECT * FROM tbl_connection_configs WHERE config_id = $1 AND config_flag = '1'`,
            [id]
        );
        return result.rows[0] || null;
    }

    // Insert ข้อมูลใหม่
    async create(data) {
        const { config_name, config_type, host_address, port, username, password, config_flag, db_name } = data;

        const result = await pool.query(
            `INSERT INTO tbl_connection_configs 
                (config_name, config_type, host_address, port, username, password, config_flag, db_name, ist_dt)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             RETURNING *`,
            [config_name, config_type, host_address, port, username, password, config_flag || '1', db_name]
        );
        return result.rows[0];
    }

    // Update ข้อมูลตาม ID
    async update(id, data) {
        const { config_name, config_type, host_address, port, username, password, config_flag } = data;

        const result = await pool.query(
            `UPDATE tbl_connection_configs SET
                config_name = COALESCE($1, config_name),
                config_type = COALESCE($2, config_type),
                host_address = COALESCE($3, host_address),
                port = COALESCE($4, port),
                username = COALESCE($5, username),
                password = COALESCE($6, password),
                config_flag = COALESCE($7, config_flag),
                mdf_dt = NOW()
             WHERE config_id = $8
             RETURNING *`,
            [config_name, config_type, host_address, port, username, password, config_flag, id]
        );
        return result.rows[0] || null;
    }

    // ลบข้อมูลตาม ID
    async remove(id) {
        const result = await pool.query(
            `UPDATE tbl_connection_configs SET config_flag = '0', rm_dt = NOW() WHERE config_id = $1 RETURNING *`,
            [id]
        );
        return result.rows[0] || null;
    }
}

module.exports = new ConnectionConfigsService();
