const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

    let script = `CREATE TABLE tbl_order_compartment (
	ord_veh_compartment_code character varying(50) NOT NULL,
	ord_code character varying(50) NOT NULL,
	itm_code character varying(50) NOT NULL,
	itm_unit_code character varying(50) NOT NULL,
	item_quantity double precision NOT NULL,
	ord_veh_compartment_flag character varying(2) NOT NULL,
	ist_dt timestamp without time zone NOT NULL,
	mdf_dt timestamp without time zone,
	rm_dt timestamp without time zone,
	veh_compartment_code character varying(50) DEFAULT NULL::character varying,
	PRIMARY KEY(ord_veh_compartment_code)
	);`;

    let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
    return !standardTemporary.code;
}