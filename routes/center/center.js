const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//SCRIPT
const tbl_action_logs = require("./script/tbl_action_logs");
const tbl_amphure = require("./script/tbl_amphure");
const tbl_contract_type = require("./script/tbl_contract_type");
const tbl_department = require("./script/tbl_department");
const tbl_depot_group = require("./script/tbl_depot_group");
const tbl_depot_item = require("./script/tbl_depot_item");
const tbl_depot_worked_date = require("./script/tbl_depot_worked_date");
const tbl_depot = require("./script/tbl_depot");
const tbl_division = require("./script/tbl_division");
const tbl_driver_card_license_type = require("./script/tbl_driver_card_license_type");
const tbl_driver_card_license = require("./script/tbl_driver_card_license");
const tbl_driver_card_type = require("./script/tbl_driver_card_type");
const tbl_driver_card = require("./script/tbl_driver_card");
const tbl_driver_group = require("./script/tbl_driver_group");
const tbl_driver_leave_type = require("./script/tbl_driver_leave_type");
const tbl_driver_leave = require("./script/tbl_driver_leave");
const tbl_driver_role = require("./script/tbl_driver_role");
const tbl_driver = require("./script/tbl_driver");
const tbl_employee_group = require("./script/tbl_employee_group");
const tbl_employee_role = require("./script/tbl_employee_role");
const tbl_employee = require("./script/tbl_employee");
const tbl_item_type = require("./script/tbl_item_type");
const tbl_item_unit = require("./script/tbl_item_unit");
const tbl_item = require("./script/tbl_item");
const tbl_office = require("./script/tbl_office");
const tbl_order_type = require("./script/tbl_order_type");
const tbl_order = require("./script/tbl_order");
const tbl_petrol_depot = require("./script/tbl_petrol_depot");
const tbl_petrol_driver_card_type = require("./script/tbl_petrol_driver_card_type");
const tbl_petrol_expenses = require("./script/tbl_petrol_expenses");
const tbl_petrol_group = require("./script/tbl_petrol_group");
const tbl_petrol_item = require("./script/tbl_petrol_item");
const tbl_petrol_tank = require("./script/tbl_petrol_tank");
const tbl_petrol_vehicle_type = require("./script/tbl_petrol_vehicle_type");
const tbl_petrol_vehicle = require("./script/tbl_petrol_vehicle");
const tbl_petrol_worked_date = require("./script/tbl_petrol_worked_date");
const tbl_petrol = require("./script/tbl_petrol");
const tbl_position = require("./script/tbl_position");
const tbl_province = require("./script/tbl_province");
const tbl_tambon = require("./script/tbl_tambon");
const tbl_transporeon_order = require("./script/tbl_transporeon_order");
const tbl_vehicle_compartment_level = require("./script/tbl_vehicle_compartment_level");
const tbl_vehicle_compartment = require("./script/tbl_vehicle_compartment");
const tbl_vehicle_group_depot = require("./script/tbl_vehicle_group_depot");
const tbl_vehicle_group = require("./script/tbl_vehicle_group");
const tbl_vehicle_type = require("./script/tbl_vehicle_type");
const tbl_vehicle_unavailable_type = require("./script/tbl_vehicle_unavailable_type");
const tbl_vehicle_unavailable = require("./script/tbl_vehicle_unavailable");
const tbl_vehicle = require("./script/tbl_vehicle");
const tbl_order_compartment = require("./script/tbl_order_compartment");
const tbl_menu = require("./script/tbl_menu");
const tbl_menu_permission = require("./script/tbl_menu_permission");

const dCreate = async (database) => {

    let xresult = false;

    try {

        debugger;
        database = database.toLowerCase();
        let script = `create database ${database}`;

        let standardTemporary = await pgConn.execute('tmslicense_center', script, config.connectionString());
        debugger
        if (!standardTemporary.code) {
            xresult = await tbl_action_logs.execute(database);

            if (xresult) {
                xresult = await tbl_amphure.execute(database);
            }

            if (xresult) {
                xresult = await tbl_contract_type.execute(database);
            }

            if (xresult) {
                xresult = await tbl_department.execute(database);
            }

            if (xresult) {
                xresult = await tbl_depot_group.execute(database);
            }

            if (xresult) {
                xresult = await tbl_depot_item.execute(database);
            }

            if (xresult) {
                xresult = await tbl_depot_worked_date.execute(database);
            }

            if (xresult) {
                xresult = await tbl_depot.execute(database);
            }

            if (xresult) {
                xresult = await tbl_division.execute(database);
            }

            if (xresult) {
                xresult = await tbl_driver_card_license_type.execute(database);
            }

            if (xresult) {
                xresult = await tbl_driver_card_license.execute(database);
            }

            if (xresult) {
                xresult = await tbl_driver_card_type.execute(database);
            }

            if (xresult) {
                xresult = await tbl_driver_card.execute(database);
            }

            if (xresult) {
                xresult = await tbl_driver_group.execute(database);
            }

            if (xresult) {
                xresult = await tbl_driver_leave_type.execute(database);
            }

            if (xresult) {
                xresult = await tbl_driver_leave.execute(database);
            }

            if (xresult) {
                xresult = await tbl_driver_role.execute(database);
            }

            if (xresult) {
                xresult = await tbl_driver.execute(database);
            }

            if (xresult) {
                xresult = await tbl_employee_group.execute(database);
            }

            if (xresult) {
                xresult = await tbl_employee_role.execute(database);
            }

            if (xresult) {
                xresult = await tbl_employee.execute(database);
            }

            if (xresult) {
                xresult = await tbl_item_type.execute(database);
            }

            if (xresult) {
                xresult = await tbl_item_unit.execute(database);
            }

            if (xresult) {
                xresult = await tbl_item.execute(database);
            }

            if (xresult) {
                xresult = await tbl_office.execute(database);
            }

            if (xresult) {
                xresult = await tbl_order_type.execute(database);
            }

            if (xresult) {
                xresult = await tbl_order.execute(database);
            }

            if (xresult) {
                xresult = await tbl_petrol_depot.execute(database);
            }

            if (xresult) {
                xresult = await tbl_petrol_driver_card_type.execute(database);
            }

            if (xresult) {
                xresult = await tbl_petrol_expenses.execute(database);
            }

            if (xresult) {
                xresult = await tbl_petrol_group.execute(database);
            }

            if (xresult) {
                xresult = await tbl_petrol_item.execute(database);
            }

            if (xresult) {
                xresult = await tbl_petrol_tank.execute(database);
            }

            if (xresult) {
                xresult = await tbl_petrol_vehicle_type.execute(database);
            }

            if (xresult) {
                xresult = await tbl_petrol_vehicle.execute(database);
            }

            if (xresult) {
                xresult = await tbl_petrol_worked_date.execute(database);
            }

            if (xresult) {
                xresult = await tbl_petrol.execute(database);
            }

            if (xresult) {
                xresult = await tbl_position.execute(database);
            }

            if (xresult) {
                xresult = await tbl_province.execute(database);
            }

            if (xresult) {
                xresult = await tbl_tambon.execute(database);
            }

            if (xresult) {
                xresult = await tbl_transporeon_order.execute(database);
            }

            if (xresult) {
                xresult = await tbl_vehicle_compartment_level.execute(database);
            }

            if (xresult) {
                xresult = await tbl_vehicle_compartment.execute(database);
            }

            if (xresult) {
                xresult = await tbl_vehicle_group_depot.execute(database);
            }

            if (xresult) {
                xresult = await tbl_vehicle_group.execute(database);
            }

            if (xresult) {
                xresult = await tbl_vehicle_type.execute(database);
            }

            if (xresult) {
                xresult = await tbl_vehicle_unavailable_type.execute(database);
            }

            if (xresult) {
                xresult = await tbl_vehicle_unavailable.execute(database);
            }

            if (xresult) {
                xresult = await tbl_vehicle.execute(database);
            }

            if (xresult) {
                xresult = await tbl_order_compartment.execute(database);
            }

            if (xresult) {
                xresult = await tbl_menu.execute(database);
            }

            if (xresult) {
                xresult = await tbl_menu_permission.execute(database);
            }
        }
    }
    catch (ex) {
        console.log('dCreate,', ex);
    }
    finally {
        return xresult;
    }

}


exports.addLicenseFuelInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { customer_company_desc, customer_contact_fullname,
            customer_mobilenumber, sale_contact_fullname, sale_contact_mobilenumber, remark, action } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (customer_company_desc == undefined || customer_contact_fullname == undefined
            || customer_mobilenumber == undefined || sale_contact_fullname == undefined
            || sale_contact_mobilenumber == undefined
            || remark == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return
        } else {
            let license_code = 'lic-' + moment().format('x');
            let license_number = await xglobal.generateRandomString(3);
            let license_count = 0;

            //checked
            let script0 = `select count(license_number) as xcount from licenses where license_number like '${license_number}%';`
            let tbl_temporary0 = await pgConn.get('tmslicense_center', script0, config.connectionString());
            debugger
            if (!tbl_temporary0.code) {
                if (tbl_temporary0.data.length > 0) {
                    license_count = parseInt(tbl_temporary0.data[0].xcount) + 1;
                }
            }

            let script = `insert into licenses (license_code, customer_company_desc, customer_contact_fullname, customer_mobilenumber, license_number, license_flag, ist_dt, exp_dt, sale_contact_fullname, sale_contact_mobilenumber, remark) 
            values ('${license_code}', '${customer_company_desc}', '${customer_contact_fullname}', '${customer_mobilenumber}', '${license_number.toLocaleUpperCase() + license_count.toString()}', '1', 
            '${moment().format('YYYY-MM-DD HH:mm:ss')}', '${moment().add(30, 'days').format('YYYY-MM-DD HH:mm:ss')}', '${sale_contact_fullname}', '${sale_contact_mobilenumber}', '${remark}');`;

            let tbl_temporary = await pgConn.execute('tmslicense_center', script, config.connectionString());
            xresult[0].license_number = license_number;

            if (!tbl_temporary.code) {
                //create database
                //debugger
                let xdatabase = dbPrefix + license_number.toLocaleUpperCase() + license_count.toString();
                let xcreate = await dCreate(xdatabase);

                debugger
                if (xcreate == true) {
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: xresult,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'สร้างฐานข้อมูลและ License', JSON.stringify(req.body[0]), 'success', action[0].value);
                    return;
                }
                else {
                    let response = [{
                        status: 'error',
                        invalid_code: '-3',
                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: xresult,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]
                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'สร้างฐานข้อมูลและ License', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                    return;
                }

            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'สร้างฐานข้อมูลและ License', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
        }
    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'สร้างฐานข้อมูลและ License', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}