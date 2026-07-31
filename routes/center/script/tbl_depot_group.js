const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

    let script = `CREATE TABLE IF NOT EXISTS public.tbl_depot_group (
	dpo_group_code character varying(50) NOT NULL,
	dpo_group_desc character varying(200) NOT NULL,
	dpo_group_short_desc character varying(100),
	dpo_group_flag character varying(2) NOT NULL,
	off_code character varying(50),
	ist_dt timestamp without time zone NOT NULL,
	mdf_dt timestamp without time zone,
	rm_dt timestamp without time zone,
	PRIMARY KEY(dpo_group_code)
	);`;

    let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
    return !standardTemporary.code;
}