const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

    let script = `CREATE TABLE IF NOT EXISTS public.tbl_driver_leave (
	dver_leave_code character varying(50) NOT NULL,
	dver_code character varying(50) NOT NULL,
	dver_leave_date date NOT NULL,
	dver_leave_desc character varying(200),
	dver_leave_type_code character varying(50),
	dver_leave_flag character varying(2) NOT NULL,
	ist_dt timestamp without time zone NOT NULL,
	mdf_dt timestamp without time zone,
	rm_dt timestamp without time zone,
	dver_leave_status character varying(2) DEFAULT NULL::character varying,
	PRIMARY KEY(dver_leave_code)
);`;

    let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
    return !standardTemporary.code;
}