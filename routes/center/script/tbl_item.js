const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

    let script = `CREATE TABLE IF NOT EXISTS public.tbl_item (
	itm_code character varying(50) NOT NULL,
	itm_desc character varying(200) NOT NULL,
	itm_short_desc character varying(100) NOT NULL,
	itm_type_code character varying(50),
	itm_unit_code character varying(50),
	itm_icon character varying(100),
	itm_image character varying(100),
	itm_material_number character varying(50),
	itm_weight_litr_per_kg double precision,
	itm_flag character varying(2) NOT NULL,
	ist_dt timestamp without time zone NOT NULL,
	mdf_dt timestamp without time zone,
	rm_dt timestamp without time zone,
	PRIMARY KEY(itm_code)
);`;

    let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
    return !standardTemporary.code;
}