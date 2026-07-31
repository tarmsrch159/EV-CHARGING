const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

    let script = `CREATE TABLE IF NOT EXISTS public.tbl_position (
	div_code character varying(50) NOT NULL,
	dep_code character varying(50) NOT NULL,
	pos_code character varying(50) NOT NULL,
	pos_desc character varying(50) NOT NULL,
	pos_flag character varying(2) NOT NULL,
	pos_salary double precision,
	pos_allowance double precision,
	pos_hour_working integer,
	pos_hour_overtimes double precision,
	ist_dt timestamp without time zone NOT NULL,
	mdf_dt timestamp without time zone,
	rm_dt timestamp without time zone,
	PRIMARY KEY(pos_code)
);`;

    let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
    return !standardTemporary.code;
}