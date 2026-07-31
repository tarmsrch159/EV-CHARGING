const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

    let script = `CREATE TABLE IF NOT EXISTS public.tbl_driver_card (
	dver_code character varying(50) NOT NULL,
	dver_card_code character varying(50) NOT NULL,
	dver_card_number character varying(50),
	dver_card_type_code character varying(50),
	dver_card_date timestamp without time zone,
	dver_card_expire_date timestamp without time zone,
	dver_card_flag character varying(2) NOT NULL,
	ist_dt timestamp without time zone NOT NULL,
	mdf_dt timestamp without time zone,
	rm_dt timestamp without time zone,
	PRIMARY KEY(dver_card_code)
);`;

    let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
    return !standardTemporary.code;
}