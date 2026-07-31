const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

    let script = `CREATE TABLE IF NOT EXISTS public.tbl_depot_item (
		dpo_item_code character varying(50) NOT NULL,
		dpo_code character varying(50) NOT NULL,
		itm_code character varying(50) NOT NULL,
		dpo_item_flag character varying(2) NOT NULL,
		ist_dt timestamp without time zone NOT NULL,
		mdf_dt timestamp without time zone,
		rm_dt timestamp without time zone,
		PRIMARY KEY(dpo_item_code)
	);`;

    let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
    return !standardTemporary.code;
}