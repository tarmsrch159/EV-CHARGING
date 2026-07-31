const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

    let script = `CREATE TABLE IF NOT EXISTS public.tbl_vehicle (
	veh_code character varying(50) NOT NULL,
	veh_number character varying(200) DEFAULT NULL::character varying,
	veh_license_number character varying(100) DEFAULT NULL::character varying,
	veh_license_province character varying(100) DEFAULT NULL::character varying,
	veh_type_code character varying(50) DEFAULT NULL::character varying,
	veh_status character varying(200) DEFAULT NULL::character varying,
	veh_group_code character varying(50) DEFAULT NULL::character varying,
	veh_blackbox_number character varying(200) DEFAULT NULL::character varying,
	veh_brand character varying(200) DEFAULT NULL::character varying,
	veh_model character varying(200) DEFAULT NULL::character varying,
	veh_tank_material character varying(200) DEFAULT NULL::character varying,
	veh_loading_system character varying(2) DEFAULT NULL::character varying,
	veh_maximum_compartment integer,
	veh_capacity_in_compartment integer,
	veh_tare_weight integer,
	veh_gross_weight integer,
	veh_tank_width double precision,
	veh_tank_length double precision,
	veh_tank_height double precision,
	veh_tank_capacity integer,
	veh_maximum_capacity integer,
	veh_discharge_sequence character varying(200) DEFAULT NULL::character varying,
	veh_option_pump character varying(2) DEFAULT NULL::character varying,
	veh_option_doeb character varying(2) DEFAULT NULL::character varying,
	veh_option_m12 character varying(2) DEFAULT NULL::character varying,
	veh_option_ivms character varying(2) DEFAULT NULL::character varying,
	veh_option_afdd character varying(2) DEFAULT NULL::character varying,
	veh_registration_starting_date timestamp without time zone,
	veh_registration_expire_date timestamp without time zone,
	veh_registration_remark character varying(200) DEFAULT NULL::character varying,
	veh_support_product character varying(2) DEFAULT NULL::character varying,
	veh_sticker character varying(200) DEFAULT NULL::character varying,
	veh_braking_system character varying(2) DEFAULT NULL::character varying,
	veh_service_life integer,
	veh_flag character varying(2) DEFAULT NULL::character varying,
	veh_image character varying(200) DEFAULT NULL::character varying,
	veh_sub_license_number character varying(100) DEFAULT NULL::character varying,
	veh_sub_license_province character varying(100) DEFAULT NULL::character varying,
	veh_sub_brand character varying(200) DEFAULT NULL::character varying,
	veh_sub_model character varying(200) DEFAULT NULL::character varying,
	veh_sub_registration_starting_date timestamp without time zone,
	veh_sub_registration_expire_date timestamp without time zone,
	veh_sub_registration_remark character varying(200) DEFAULT NULL::character varying,
	veh_sub_service_life integer,
	veh_sub_braking_system character varying(2) DEFAULT NULL::character varying,
	veh_sub_image character varying(200) DEFAULT NULL::character varying,
	ist_dt timestamp without time zone NOT NULL,
	mdf_dt timestamp without time zone,
	rm_dt timestamp without time zone,
	off_code character varying(50) DEFAULT NULL::character varying,
	veh_support_climb_mountain character varying(2) DEFAULT NULL::character varying,
	veh_maximum_distance integer,
	veh_minimum_distance integer,
	veh_maximum_jobs integer,
	veh_remark character varying(255) DEFAULT NULL::character varying,
	PRIMARY KEY(veh_code)
	);`;

    let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
    return !standardTemporary.code;
}