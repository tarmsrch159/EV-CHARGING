const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

    let script = `CREATE TABLE IF NOT EXISTS public.tbl_vehicle_unavailable (
	veh_unavailable_code character varying(50) NOT NULL,
	veh_code character varying(200) NOT NULL,
	veh_unavailable_date date NOT NULL,
	veh_unavailable_desc character varying(200),
	veh_unavailable_status character varying(2) NOT NULL,
	veh_unavailable_type_code character varying(50),
	veh_unavailable_flag character varying(2) NOT NULL,
	ist_dt timestamp without time zone NOT NULL,
	mdf_dt timestamp without time zone,
	rm_dt timestamp without time zone,
	off_code character varying(50) DEFAULT NULL::character varying,
	PRIMARY KEY(veh_unavailable_code)
);`;

    let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
    return !standardTemporary.code;
}