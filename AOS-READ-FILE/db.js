const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

// const pool = new Pool({
//     user: process.env.DB_USER,
//     host: process.env.DB_HOST,
//     database: process.env.DB_NAME,
//     password: process.env.DB_PASSWORD,
//     port: process.env.DB_PORT,
// });

const pool = new Pool({
    user: 'postgres',
    host: '203.150.210.25',
    database: 'tms_aos03',
    password: 'reP@ssw0rd778900',
    port: 5432,
});


module.exports = pool;
