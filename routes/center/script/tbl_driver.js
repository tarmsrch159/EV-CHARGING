const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

    let script = `CREATE TABLE IF NOT EXISTS public.tbl_driver (
	dver_code character varying(50) NOT NULL,
	dver_username character varying(50) NOT NULL,
	dver_userpassword character varying(50) NOT NULL,
	dver_ref_code character varying(50) NOT NULL,
	dver_image_profile character varying(100),
	dver_name character varying(200),
	dver_surname character varying(200),
	dver_mobile_number character varying(200),
	dver_email character varying(200),
	dver_div_code character varying(50),
	dver_dep_code character varying(50),
	dver_pos_code character varying(50),
	dver_group_code character varying(50),
	dver_gender character varying(2),
	dver_role_code character varying(50),
	dver_personal_number character varying(50),
	application_mobile_version character varying(50),
	dver_flag character varying(2) NOT NULL,
	ist_dt timestamp without time zone NOT NULL,
	mdf_dt timestamp without time zone,
	rm_dt timestamp without time zone,
	off_code character varying(50) DEFAULT NULL::character varying,
	PRIMARY KEY(dver_code)
);`;

    let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
    return !standardTemporary.code;
}