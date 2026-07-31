const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

    let script = `CREATE TABLE IF NOT EXISTS public.tbl_transporeon_order (
	tprn_code character varying(50) NOT NULL,
	pull_code character varying(50) NOT NULL,
	tprn_information text,
	tprn_result character varying(2) DEFAULT NULL::character varying,
	tprn_remark character varying(255) DEFAULT NULL::character varying,
	ist_dt timestamp without time zone NOT NULL,
	mdf_dt timestamp without time zone,
	rm_dt timestamp without time zone,
	tprn_flag character varying(2) DEFAULT NULL::character varying,
	PRIMARY KEY(tprn_code)
);`;

    let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
    return !standardTemporary.code;
}