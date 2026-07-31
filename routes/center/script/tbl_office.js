const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

    let script = `CREATE TABLE IF NOT EXISTS public.tbl_office (
	off_code character varying(50) NOT NULL,
	off_desc character varying(200),
	off_desc_en character varying(200),
	off_number character varying(50),
	off_address character varying(255),
	off_tamb_code character varying(50),
	off_amph_code character varying(50),
	off_prov_code character varying(50),
	off_latitude double precision,
	off_longitude double precision,
	off_area double precision,
	off_flag character varying(2) NOT NULL,
	ist_dt timestamp without time zone NOT NULL,
	mdf_dt timestamp without time zone,
	rm_dt timestamp without time zone,
	PRIMARY KEY(off_code)
);`;

    let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
    return !standardTemporary.code;
}