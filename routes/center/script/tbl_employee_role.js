const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

	let script = `CREATE TABLE IF NOT EXISTS public.tbl_employee_role (
	emp_role_code character varying(50) NOT NULL,
	emp_role_desc character varying(200) NOT NULL,
	emp_role_flag character varying(2) NOT NULL,
	ist_dt timestamp without time zone NOT NULL,
	mdf_dt timestamp without time zone,
	rm_dt timestamp without time zone,
	PRIMARY KEY(emp_role_code)
	);`;

	let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
	if (!standardTemporary.code) {
		let xscript =
			[
				`INSERT INTO public.tbl_employee_role (emp_role_code, emp_role_desc, emp_role_flag, ist_dt, mdf_dt, rm_dt) VALUES ('erol-9999999999999', 'พนักงานระดับผู้ดูแลระบบ', '1', '2025-04-23 09:41:57', NULL, NULL);`,
				`INSERT INTO public.tbl_employee_role (emp_role_code, emp_role_desc, emp_role_flag, ist_dt, mdf_dt, rm_dt) VALUES ('erol-9999999999998', 'พนักงานระดับผู้จัดการ', '1', '2025-04-23 09:41:57', NULL, NULL);`,
				`INSERT INTO public.tbl_employee_role (emp_role_code, emp_role_desc, emp_role_flag, ist_dt, mdf_dt, rm_dt) VALUES ('erol-9999999999997', 'พนักงานระดับใช้งานทั่วไป', '1', '2025-04-23 09:41:57', NULL, NULL);`
			]

		for (var x = 0; x <= xscript.length - 1; x++) {
			standardTemporary = await pgConn.execute(databse, xscript[x], config.connectionString());

			if (x == xscript.length - 1) {
				//debugger
				return !standardTemporary.code;
			}
		}
	}
	else {
		return !standardTemporary.code;
	}
}