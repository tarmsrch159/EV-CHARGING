const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../../middleware/global');

exports.execute = async (databse) => {

	let script = `CREATE TABLE IF NOT EXISTS public.tbl_order_type (
	ord_type_code character varying(50) NOT NULL,
	ord_type_desc character varying(200) NOT NULL,
	ord_type_flag character varying(2) NOT NULL,
	ist_dt timestamp without time zone NOT NULL,
	mdf_dt timestamp without time zone,
	rm_dt timestamp without time zone,
	PRIMARY KEY(ord_type_code)
);`;

	let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
	if (!standardTemporary.code) {
		let xscript =
			[
				`INSERT INTO public.tbl_order_type (ord_type_code, ord_type_desc, ord_type_flag, ist_dt, mdf_dt, rm_dt) VALUES ('otyp-9999999999999', 'No-VMI Orders', '1', '2025-04-21 00:00:00', NULL, NULL);`,
				`INSERT INTO public.tbl_order_type (ord_type_code, ord_type_desc, ord_type_flag, ist_dt, mdf_dt, rm_dt) VALUES ('otyp-9999999999998', 'Pre-event Orders', '1', '2025-04-21 00:00:00', NULL, NULL);`,
				`INSERT INTO public.tbl_order_type (ord_type_code, ord_type_desc, ord_type_flag, ist_dt, mdf_dt, rm_dt) VALUES ('otyp-9999999999997', 'TMS Orders', '1', '2025-04-21 00:00:00', NULL, NULL);`
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