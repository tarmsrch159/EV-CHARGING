const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

    let script = `CREATE TABLE IF NOT EXISTS public.tbl_employee (
	emp_code character varying(50) NOT NULL,
	emp_username character varying(50) NOT NULL,
	emp_userpassword character varying(50) NOT NULL,
	emp_ref_code character varying(50) NOT NULL,
	emp_image_profile character varying(100),
	emp_name character varying(200),
	emp_surname character varying(200),
	emp_mobile_number character varying(200),
	emp_email character varying(200),
	emp_div_code character varying(50),
	emp_dep_code character varying(50),
	emp_pos_code character varying(50),
	emp_group_code character varying(50),
	emp_gender character varying(2),
	emp_role_code character varying(50),
	emp_flag character varying(2) NOT NULL,
	ist_dt timestamp without time zone NOT NULL,
	mdf_dt timestamp without time zone,
	rm_dt timestamp without time zone,
	off_code character varying(50) DEFAULT NULL::character varying,
	PRIMARY KEY(emp_code)
);`;

    let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
    return !standardTemporary.code;
}