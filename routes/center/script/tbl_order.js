const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

	let script = `CREATE TABLE IF NOT EXISTS public.tbl_order (
	ord_code character varying(50) NOT NULL,
	shipments_code character varying(20) NOT NULL,
	transport_code character varying(20),
	tour_code character varying(20),
	pull_code character varying(100),
	number character varying(100),
	document_reference character varying(100),
	plant character varying(50),
	assigned_carrier_id character varying(20),
	assigned_carrier_name character varying(255),
	assigned_creditor_number character varying(50),
	assigned_carrier_number character varying(50),
	ord_dt timestamp without time zone NOT NULL,
	req_dt timestamp without time zone NOT NULL,
	ord_status character varying(2),
	ord_comment character varying(50),
	ord_customer_code character varying(50),
	ord_customer_name character varying(200),
	ord_customer_number character varying(50),
	gsap_order_type_code character varying(10),
	gsap_order_status character varying(2),
	transporeon_status character varying(50),
	off_code character varying(50),
	ord_flag character varying(2),
	ist_dt timestamp without time zone NOT NULL,
	mdf_dt timestamp without time zone,
	rm_dt timestamp without time zone,
	loading_count integer,
	unloading_count integer,
	item_count integer,
	item_quantity double precision,
	ord_type_code character varying(50) DEFAULT NULL::character varying,
	petrol_group_code character varying(50) DEFAULT NULL::character varying,
	dver_code character varying(50) DEFAULT NULL::character varying,
	veh_code character varying(50) DEFAULT NULL::character varying,
	transporeon_result character varying(255) DEFAULT NULL::character varying,
	transporeon_ist_dt timestamp without time zone,
	transporeon_mdf_dt timestamp without time zone,
	transporeon_rm_dt timestamp without time zone,
	PRIMARY KEY(shipments_code)
);`;

	let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
	return !standardTemporary.code;
}