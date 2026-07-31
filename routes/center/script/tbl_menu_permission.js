const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');

exports.execute = async (databse) => {
	let script = `CREATE TABLE IF NOT EXISTS public.tbl_menu_permission (
		emp_role_code character varying(50) NOT NULL,
		menu_code character varying(50) NOT NULL,
		display smallint NOT NULL DEFAULT 0,
		edit smallint NOT NULL DEFAULT 0,
		ist_dt timestamp without time zone NOT NULL,
		mdf_dt timestamp without time zone,
		rm_dt timestamp without time zone,
		create_perm smallint NOT NULL DEFAULT 0,
		delete_perm smallint NOT NULL DEFAULT 0,
		PRIMARY KEY(emp_role_code, menu_code),
		CONSTRAINT fk_menu_permission_role FOREIGN KEY (emp_role_code) REFERENCES public.tbl_employee_role(emp_role_code),
		CONSTRAINT fk_menu_permission_menu FOREIGN KEY (menu_code) REFERENCES public.tbl_menu(menu_code)
	);`;

	let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
	if (!standardTemporary.code) {
		// Safe alter to add new columns and adjust types for existing tables
		try {
			await pgConn.execute(databse, `ALTER TABLE public.tbl_menu_permission ADD COLUMN IF NOT EXISTS rm_dt timestamp without time zone;`, config.connectionString());
			await pgConn.execute(databse, `ALTER TABLE public.tbl_menu_permission ADD COLUMN IF NOT EXISTS create_perm smallint DEFAULT 0;`, config.connectionString());
			await pgConn.execute(databse, `ALTER TABLE public.tbl_menu_permission ADD COLUMN IF NOT EXISTS delete_perm smallint DEFAULT 0;`, config.connectionString());
			await pgConn.execute(databse, `ALTER TABLE public.tbl_menu_permission ALTER COLUMN display TYPE smallint USING (display::smallint);`, config.connectionString());
			await pgConn.execute(databse, `ALTER TABLE public.tbl_menu_permission ALTER COLUMN edit TYPE smallint USING (edit::smallint);`, config.connectionString());
		} catch (e) {
			// Ignore if errors
		}
	}
	return !standardTemporary.code;
}
