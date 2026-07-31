const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

    let script = `
	CREATE TABLE IF NOT EXISTS public.tbl_petrol (
	ptrl_code character varying(50) NOT NULL,
	ptrl_number character varying(50) NOT NULL,
	ptrl_desc character varying(200),
	ptrl_short_desc character varying(100),
	ptrl_address character varying(255),
	ptrl_zip_code character varying(50) NOT NULL,
	ptrl_country_code character varying(50) NOT NULL,
	ptrl_unloading_minute integer,
	ptrl_expenses_per_km double precision,
	ptrl_area double precision,
	ptrl_option_pump character varying(2) NOT NULL,
	ptrl_option_mrge_orders character varying(2) NOT NULL,
	ptrl_lat double precision,
	ptrl_lon double precision,
	ptrl_flag character varying(2) NOT NULL,
	ist_dt timestamp without time zone NOT NULL,
	mdf_dt timestamp without time zone,
	rm_dt timestamp without time zone,
	off_code character varying(50) NOT NULL,
	ptrl_group_code character varying(50) NOT NULL,
	ptrl_city character varying(200) DEFAULT NULL::character varying,
	PRIMARY KEY(ptrl_code)
	);`;

    let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
    return !standardTemporary.code;
}