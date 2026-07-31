const config = require('../../../configuration/connection');
const pgConn = require('../../../library/pgConnection');
const moment = require('moment');

exports.execute = async (databse) => {
	let script = `CREATE TABLE IF NOT EXISTS public.tbl_menu (
		menu_code character varying(50) NOT NULL,
		menu_group integer NOT NULL,
		menu_no character varying(50) NOT NULL,
		menu_desc character varying(200) NOT NULL,
		menu_parent_code character varying(50),
		menu_order integer NOT NULL DEFAULT 0,
		menu_flag character varying(2) NOT NULL DEFAULT '1',
		ist_dt timestamp without time zone NOT NULL,
		mdf_dt timestamp without time zone,
		rm_dt timestamp without time zone,
		PRIMARY KEY(menu_code)
	);`;

	let standardTemporary = await pgConn.execute(databse, script, config.connectionString());
	if (!standardTemporary.code) {
		const now = moment().format('YYYY-MM-DD HH:mm:ss');
		let xscript = [
			`INSERT INTO public.tbl_menu (menu_code, menu_group, menu_no, menu_desc, menu_parent_code, menu_order, menu_flag, ist_dt) 
			 VALUES ('menu-3-2', 3, '3.2', 'Tab กลุ่ม /โซน', NULL, 10, '1', '${now}') 
			 ON CONFLICT (menu_code) DO UPDATE SET menu_desc = EXCLUDED.menu_desc, menu_no = EXCLUDED.menu_no, menu_group = EXCLUDED.menu_group;`,

			`INSERT INTO public.tbl_menu (menu_code, menu_group, menu_no, menu_desc, menu_parent_code, menu_order, menu_flag, ist_dt) 
			 VALUES ('menu-4-1-1', 4, '4.1.1', 'เพิ่ม,ลบ,แก้ไขคลังน้ำมัน', NULL, 10, '1', '${now}') 
			 ON CONFLICT (menu_code) DO UPDATE SET menu_desc = EXCLUDED.menu_desc, menu_no = EXCLUDED.menu_no, menu_group = EXCLUDED.menu_group;`,

			`INSERT INTO public.tbl_menu (menu_code, menu_group, menu_no, menu_desc, menu_parent_code, menu_order, menu_flag, ist_dt) 
			 VALUES ('menu-5-1-1', 5, '5.1.1', 'เพิ่ม,ลบ,แก้ไขประเภทรถ', NULL, 10, '1', '${now}') 
			 ON CONFLICT (menu_code) DO UPDATE SET menu_desc = EXCLUDED.menu_desc, menu_no = EXCLUDED.menu_no, menu_group = EXCLUDED.menu_group;`,

			`INSERT INTO public.tbl_menu (menu_code, menu_group, menu_no, menu_desc, menu_parent_code, menu_order, menu_flag, ist_dt) 
			 VALUES ('menu-6-1', 6, '6.1', 'Tab Stock เเละยอดขายรายวัน', NULL, 10, '1', '${now}') 
			 ON CONFLICT (menu_code) DO UPDATE SET menu_desc = EXCLUDED.menu_desc, menu_no = EXCLUDED.menu_no, menu_group = EXCLUDED.menu_group;`,

			`INSERT INTO public.tbl_menu (menu_code, menu_group, menu_no, menu_desc, menu_parent_code, menu_order, menu_flag, ist_dt) 
			 VALUES ('menu-6-2-1', 6, '6.2.1', 'เรียกดู,ตรวจสอบ รายงานการสั่งซื้อแบบ Manual', NULL, 20, '1', '${now}') 
			 ON CONFLICT (menu_code) DO UPDATE SET menu_desc = EXCLUDED.menu_desc, menu_no = EXCLUDED.menu_no, menu_group = EXCLUDED.menu_group;`,

			`INSERT INTO public.tbl_menu (menu_code, menu_group, menu_no, menu_desc, menu_parent_code, menu_order, menu_flag, ist_dt) 
			 VALUES ('menu-6-3-1', 6, '6.3.1', 'เรียกดู,ตรวจสอบรายงานStation Over Day Sales', NULL, 30, '1', '${now}') 
			 ON CONFLICT (menu_code) DO UPDATE SET menu_desc = EXCLUDED.menu_desc, menu_no = EXCLUDED.menu_no, menu_group = EXCLUDED.menu_group;`,

			`INSERT INTO public.tbl_menu (menu_code, menu_group, menu_no, menu_desc, menu_parent_code, menu_order, menu_flag, ist_dt) 
			 VALUES ('menu-6-4', 6, '6.4', 'เรียกดู,ตรวจสอบรายงานความเสี่ยง Runout', NULL, 40, '1', '${now}') 
			 ON CONFLICT (menu_code) DO UPDATE SET menu_desc = EXCLUDED.menu_desc, menu_no = EXCLUDED.menu_no, menu_group = EXCLUDED.menu_group;`,

			`INSERT INTO public.tbl_menu (menu_code, menu_group, menu_no, menu_desc, menu_parent_code, menu_order, menu_flag, ist_dt) 
			 VALUES ('menu-6-5', 6, '6.5', 'เรียกดู,ตรวจสอบรายงานAudit Trail & Logging', NULL, 50, '1', '${now}') 
			 ON CONFLICT (menu_code) DO UPDATE SET menu_desc = EXCLUDED.menu_desc, menu_no = EXCLUDED.menu_no, menu_group = EXCLUDED.menu_group;`,

			`INSERT INTO public.tbl_menu (menu_code, menu_group, menu_no, menu_desc, menu_parent_code, menu_order, menu_flag, ist_dt) 
			 VALUES ('menu-7-2', 7, '7.2', 'เพิ่ม,ลบ,แก้ไขผู้ใช้งานบน Website', NULL, 10, '1', '${now}') 
			 ON CONFLICT (menu_code) DO UPDATE SET menu_desc = EXCLUDED.menu_desc, menu_no = EXCLUDED.menu_no, menu_group = EXCLUDED.menu_group;`,

			`INSERT INTO public.tbl_menu (menu_code, menu_group, menu_no, menu_desc, menu_parent_code, menu_order, menu_flag, ist_dt) 
			 VALUES ('menu-7-3', 7, '7.3', 'เพิ่ม,ลบ,แก้ไขรายการเหตุผล', NULL, 20, '1', '${now}') 
			 ON CONFLICT (menu_code) DO UPDATE SET menu_desc = EXCLUDED.menu_desc, menu_no = EXCLUDED.menu_no, menu_group = EXCLUDED.menu_group;`
		];

		for (var x = 0; x <= xscript.length - 1; x++) {
			standardTemporary = await pgConn.execute(databse, xscript[x], config.connectionString());
			if (x == xscript.length - 1) {
				return !standardTemporary.code;
			}
		}
	} else {
		return !standardTemporary.code;
	}
}
