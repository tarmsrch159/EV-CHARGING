const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

    let script = `CREATE TABLE IF NOT EXISTS public.tbl_vehicle_type (
	veh_type_code character varying(50) NOT NULL,
	veh_type_desc character varying(200) NOT NULL,
	veh_type_flag character varying(2) NOT NULL,
	ist_dt timestamp without time zone NOT NULL,
	mdf_dt timestamp without time zone,
	rm_dt timestamp without time zone,
	PRIMARY KEY(veh_type_code)
);`;

    let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
    return !standardTemporary.code;
}