const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

    let script = `CREATE TABLE IF NOT EXISTS public.tbl_petrol_worked_date (
	ptrl_worked_date_code character varying(50) NOT NULL,
	ptrl_code character varying(50) NOT NULL,
	wrk_date_code character varying(2) NOT NULL,
	ptrl_open_tiime character varying(10) NOT NULL,
	ptrl_close_time character varying(10) NOT NULL,
	ptrl_worked_date_flag character varying(2) NOT NULL,
	ist_dt timestamp without time zone NOT NULL,
	mdf_dt timestamp without time zone,
	rm_dt timestamp without time zone,
	PRIMARY KEY(ptrl_worked_date_code)
);`;

    let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
    return !standardTemporary.code;
}