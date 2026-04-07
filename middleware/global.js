const config = require('../configuration/connection');
const pgConn = require('../library/pgConnection');
const moment = require('moment');
const axios = require('axios');
const xproduction = true;
const xurl_prod = ``
const xutl_order_prod = ``

const dbPrefix = config.dbPrefix()

exports.Xor = (s) => {
    //debugger;
    if (s.length % 2 == 0) {
        var sum = 0;
        for (var i = 0; i < s.length; i = i + 2) {
            sum = sum ^ (parseInt(s.substring(i, i + 2), 16));
        }
        var result = parseInt(sum / 256);
        var checksum = ((sum - result * 256));
        return checksum.toString(16);
    } else {
        console.log(moment().format('YYYY-MM-DD HH:mm:ss.SSS'), "Invalid Hex String");
        return "";
    }
}

exports.Hex2bin = (hex) => {
    let chunks = hex.match(/.{1,8}/g), bin = ''
    chunks.forEach(c => (bin += parseInt(c, 16).toString(2)))
    bin = bin.padStart(4, '0')
    return bin
}

exports.Base64 = {
    _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
    encode: function (e) {
        var t = "";
        var n, r, i, s, o, u, a;
        var f = 0;
        e = this._utf8_encode(e);
        while (f < e.length) {
            n = e.charCodeAt(f++);
            r = e.charCodeAt(f++);
            i = e.charCodeAt(f++);
            s = n >> 2;
            o = (n & 3) << 4 | r >> 4;
            u = (r & 15) << 2 | i >> 6;
            a = i & 63;
            if (isNaN(r)) { u = a = 64 } else if (isNaN(i)) { a = 64 }
            t = t + this._keyStr.charAt(s) + this._keyStr.charAt(o) + this._keyStr.charAt(u) + this._keyStr.charAt(a)
        }
        return t
    },
    decode: function (e) {
        var t = "";
        var n, r, i;
        var s, o, u, a;
        var f = 0;
        e = e.replace(/[^A-Za-z0-9+/=]/g, "");
        while (f < e.length) {
            s = this._keyStr.indexOf(e.charAt(f++));
            o = this._keyStr.indexOf(e.charAt(f++));
            u = this._keyStr.indexOf(e.charAt(f++));
            a = this._keyStr.indexOf(e.charAt(f++));
            n = s << 2 | o >> 4;
            r = (o & 15) << 4 | u >> 2;
            i = (u & 3) << 6 | a;
            t = t + String.fromCharCode(n);
            if (u != 64) { t = t + String.fromCharCode(r) }
            if (a != 64) { t = t + String.fromCharCode(i) }
        }
        t = Base64._utf8_decode(t);
        return t
    },
    _utf8_encode: function (e) {
        e = e.replace(/rn/g, "n");
        var t = "";
        for (var n = 0; n < e.length; n++) {
            var r = e.charCodeAt(n);
            if (r < 128) { t += String.fromCharCode(r) } else if (r > 127 && r < 2048) {
                t += String.fromCharCode(r >> 6 | 192);
                t += String.fromCharCode(r & 63 | 128)
            } else {
                t += String.fromCharCode(r >> 12 | 224);
                t += String.fromCharCode(r >> 6 & 63 | 128);
                t += String.fromCharCode(r & 63 | 128)
            }
        }
        return t
    },
    _utf8_decode: function (e) {
        var t = "";
        var n = 0;
        var r = c1 = c2 = 0;
        while (n < e.length) {
            r = e.charCodeAt(n);
            if (r < 128) {
                t += String.fromCharCode(r);
                n++
            } else if (r > 191 && r < 224) {
                c2 = e.charCodeAt(n + 1);
                t += String.fromCharCode((r & 31) << 6 | c2 & 63);
                n += 2
            } else {
                c2 = e.charCodeAt(n + 1);
                c3 = e.charCodeAt(n + 2);
                t += String.fromCharCode((r & 15) << 12 | (c2 & 63) << 6 | c3 & 63);
                n += 3
            }
        }
        return t
    }
}

exports.action_logs = async (lic_code, action_code, action_desc, action_body, action_result, off_code) => {

    try {
        //debugger
        let action_log_code = 'xlog-' + moment().format('x');
        let script = `insert into tbl_action_logs (action_log_code, action_code, action_desc, action_body, action_result, off_code, ist_dt) values 
        ('${action_log_code}', '${action_code}', '${action_desc}', '${action_body}', '${action_result}', '${off_code}', '${moment().format('YYYY-MM-DD HH:mm:ss')}');`

        if (lic_code != 'center') {
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            return !tbl_temporary.code;
        }
        else {
            let tbl_temporary = await pgConn.execute('tmslicense_center', script, config.connectionString());
            return !tbl_temporary.code;
        }

    } catch (error) {
        return false;
    }
}

const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
exports.generateRandomString = async (length) => {
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

exports.postOrder2Tmp = async (lic_code, ord_code) => {

    try {

        var script1 = `select 
        tbl_order.ord_code, tbl_order.shipments_code,tbl_driver.dver_code, tbl_driver.dver_name, tbl_driver.dver_surname,
        tbl_vehicle.veh_number , tbl_vehicle.veh_type_code,tbl_vehicle.veh_license_number, tbl_vehicle.veh_license_province, tbl_vehicle.veh_sub_license_number, tbl_vehicle.veh_sub_license_province,
        tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc, 
        case when tbl_order_depot.dpo_address is null then tbl_depot.dpo_address else tbl_order_depot.dpo_address end as dpo_address,
        case when tbl_order_depot.dpo_zip_code is null then tbl_depot.dpo_zip_code else tbl_order_depot.dpo_zip_code end as dpo_zip_code,
        case when tbl_order_depot.dpo_country_code is null then tbl_depot.dpo_country_code else tbl_order_depot.dpo_country_code end as dpo_country_code,
        case when tbl_order_depot.dpo_lat is null then tbl_depot.dpo_lat else tbl_order_depot.dpo_lat end as dpo_lat,
        case when tbl_order_depot.dpo_lon is null then tbl_depot.dpo_lon else tbl_order_depot.dpo_lon end as dpo_lon,
        case when tbl_order_depot.dpo_city is null then tbl_depot.dpo_city else tbl_order_depot.dpo_city end as dpo_city,
        tbl_order_depot.loading_start_dt, tbl_order_depot.loading_end_dt, tbl_depot.dpo_loading_minute,
        tbl_order_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc, 
        case when tbl_order_petrol.ptrl_address is null then tbl_petrol.ptrl_address else tbl_order_petrol.ptrl_address end as ptrl_address,
        case when tbl_order_petrol.ptrl_zip_code is null then tbl_petrol.ptrl_zip_code else tbl_order_petrol.ptrl_zip_code end as ptrl_zip_code,
        case when tbl_order_petrol.ptrl_country_code is null then tbl_petrol.ptrl_country_code else tbl_order_petrol.ptrl_country_code end as ptrl_country_code,
        case when tbl_order_petrol.ptrl_lat is null then tbl_petrol.ptrl_lat else tbl_order_petrol.ptrl_lat end as ptrl_lat,
        case when tbl_order_petrol.ptrl_lon is null then tbl_petrol.ptrl_lon else tbl_order_petrol.ptrl_lon end as ptrl_lon,
        case when tbl_order_petrol.ptrl_city is null then tbl_petrol.ptrl_city else tbl_order_petrol.ptrl_city end as ptrl_city,
        tbl_order_petrol.unloading_start_dt, tbl_order_petrol.unloading_end_dt,
        tbl_petrol.ptrl_unloading_minute, tbl_order.gsap_order_status, tbl_order.gsap_order_type_code, tbl_order.ord_type_code 
        from tbl_order 
        left join tbl_order_type 
        on tbl_order.ord_type_code = tbl_order_type.ord_type_code 
        left join tbl_driver on tbl_order.dver_code = tbl_driver.dver_code 
        left join tbl_vehicle on tbl_order.veh_code = tbl_vehicle.veh_code 
        left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code
        left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code            
        left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
        left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
        where tbl_order.ord_code = '${ord_code}' and tbl_order.ord_flag = '1' and tbl_order.ord_status = '2' and tbl_order_depot.ord_depot_flag = '1' and tbl_order_petrol.ord_petrol_flag = '1' `
        let tbl_temporary1 = await pgConn.get(dbPrefix + lic_code, script1, config.connectionString());

        if (!tbl_temporary1.code) {
            console.log('postOrder2Tmp: order number', ord_code);
            debugger
            if (tbl_temporary1.data.length > 0) {
                var xlicense_plate_truck = tbl_temporary1.data[0].veh_license_number.replace('-', '');
                var xlicense_plate_trailer = '';
                var xlicence_plate_second_trailer = '';
                var xtruck_id = tbl_temporary1.data[0].veh_number.replace('-', '');;
                var xshipments_code = '';
                var xnumber = '';
                var xvehicle_id = 'vehicleSingletruckNoTrailer';
                var xgsap_order_status = tbl_temporary1.data[0].gsap_order_status;
                var xgsap_order_type_code = tbl_temporary1.data[0].gsap_order_type_code;

                if (tbl_temporary1.data[0].ord_type_code == 'otyp-9999999999999') {
                    xshipments_code = tbl_temporary1.data[0].shipments_code;
                    xnumber = tbl_temporary1.data[0].ord_code.toString().replace('odr-', '').substr(0, 9)
                }
                else {
                    xshipments_code = '888' + tbl_temporary1.data[0].shipments_code;
                    xnumber = '999' + tbl_temporary1.data[0].shipments_code;
                    xgsap_order_status = '';
                    xgsap_order_type_code = '';
                }

                if (tbl_temporary1.data[0].veh_type_code == 'veht-1749028886915') {
                    xvehicle_id = 'vehicleTruckTrailerCombination';

                    if (tbl_temporary1.data[0].veh_sub_license_number != '') {
                        if (tbl_temporary1.data[0].veh_sub_license_number != 'N/A') {
                            xlicence_plate_second_trailer = tbl_temporary1.data[0].veh_sub_license_number.replace('-', '');
                            xlicense_plate_trailer = tbl_temporary1.data[0].veh_sub_license_number.replace('-', '');
                        }
                    }
                }
                else {
                    xlicense_plate_trailer = xlicense_plate_truck;
                    xlicence_plate_second_trailer = '';
                }

                //vehicleSingletruckNoTrailer
                //vehicleRigidTruckWithTrailer
                //vehicleTruckTrailerCombination
                //loading
                var xlcompany_name = tbl_temporary1.data[0].dpo_desc;
                var xladdress = tbl_temporary1.data[0].dpo_address;
                var xlzip = tbl_temporary1.data[0].dpo_zip_code;
                var xlcity = tbl_temporary1.data[0].dpo_city;
                var xlloading_name = tbl_temporary1.data[0].dpo_number;
                var xlstart = moment(tbl_temporary1.data[0].loading_start_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');
                var xlend = moment(tbl_temporary1.data[0].loading_end_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');

                //unloading
                var xuncompany_name = tbl_temporary1.data[0].ptrl_desc;
                var xunaddress = tbl_temporary1.data[0].ptrl_address;
                var xunzip = tbl_temporary1.data[0].ptrl_zip_code;
                var xuncity = tbl_temporary1.data[0].ptrl_city;
                var xunloading_name = tbl_temporary1.data[0].ptrl_number;
                var xunstart = moment(tbl_temporary1.data[0].unloading_start_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');
                var xunend = moment(tbl_temporary1.data[0].unloading_end_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');

                var script2 = `	select tbl_order_item.itm_code,
                case when tbl_order_item.pos_number is null then '' else tbl_order_item.pos_number end as pos_number,
                case when tbl_order_item.itm_desc is null then tbl_item.itm_desc else tbl_order_item.itm_desc end as itm_desc, 
                case when tbl_order_item.itm_short_desc is null then tbl_item.itm_short_desc else tbl_order_item.itm_short_desc end as itm_short_desc, 
                tbl_order_item.itm_unit_code, tbl_order_item.item_quantity, tbl_item.itm_material_number,
                tbl_order_compartment.veh_compartment_code, tbl_vehicle_compartment.veh_compartment_number 
                
                from tbl_order
                left join tbl_order_item on tbl_order.ord_code = tbl_order_item.ord_code 
                and tbl_order_item.ord_item_flag = '1'
                left join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
                and tbl_item.itm_flag = '1'
                left join tbl_order_compartment on tbl_order_item.itm_code = tbl_order_compartment.itm_code
                and tbl_order_compartment.ord_code = tbl_order.ord_code 
                and tbl_order_compartment.ord_veh_compartment_flag = '1'
                
                left join tbl_vehicle_compartment  
                on tbl_order_compartment.veh_compartment_code = tbl_vehicle_compartment.veh_compartment_code
                and tbl_vehicle_compartment.veh_compartment_flag = '1'
                
                where tbl_order_item.ord_code = '${ord_code}'
                and tbl_order_item.ord_item_flag = '1'
                
                group by tbl_order_item.itm_code, pos_number, tbl_order_item.itm_desc, tbl_order_item.itm_short_desc, 
                tbl_item.itm_desc, tbl_item.itm_short_desc, tbl_order_item.itm_unit_code, tbl_order_item.item_quantity,
                tbl_item.itm_material_number, tbl_order_compartment.veh_compartment_code, tbl_vehicle_compartment.veh_compartment_number`

                let tbl_temporary2 = await pgConn.get(dbPrefix + lic_code, script2, config.connectionString());

                if (!tbl_temporary2.code) {
                    if (tbl_temporary2.data.length > 0) {
                        var xitem = ``;
                        debugger

                        var xtankuse = [];
                        for (var itm = 0; itm <= tbl_temporary2.data.length - 1; itm++) {
                            var xtemplate_id = tbl_temporary2.data[itm].itm_material_number;
                            var xpos_number = tbl_temporary2.data[itm].pos_number;
                            var xpos_index = itm + 1;

                            if (xpos_index.length == 1) {
                                xpos_index = '0' + xpos_index;
                            }

                            if (xpos_number == '') {
                                try {
                                    xpos_number = '0000' + ((itm + 1) * 10)
                                }
                                catch (ex) {
                                    xpos_number = '000001';
                                }
                            }

                            var xshort_description = tbl_temporary2.data[itm].itm_desc;
                            var xdescription = tbl_temporary2.data[itm].itm_desc;
                            var xmaterial_number = tbl_temporary2.data[itm].itm_material_number;
                            var xquantity = tbl_temporary2.data[itm].item_quantity;
                            var xcompartment_number = tbl_temporary2.data[itm].veh_compartment_number

                            var script3 = ``;

                            if (xtankuse.length > 0) {
                                script3 = `select tbl_order_petrol.ptrl_tank_code, tbl_petrol_tank.tnk_number from tbl_order_petrol 
                                left join tbl_petrol_tank on tbl_order_petrol.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
                                where tbl_order_petrol.ord_code = '${ord_code}' and tbl_order_petrol.itm_code = '${tbl_temporary2.data[itm].itm_code}' 
                                and tbl_petrol_tank.ptrl_tank_flag = '1' and tbl_petrol_tank.ptrl_tank_code not in (${xtankuse.map(number => `'${number}'`).toString()})
                                order by tbl_petrol_tank.tnk_number asc`
                            }
                            else {
                                script3 = `select tbl_order_petrol.ptrl_tank_code, tbl_petrol_tank.tnk_number from tbl_order_petrol 
                                left join tbl_petrol_tank on tbl_order_petrol.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
                                where tbl_order_petrol.ord_code = '${ord_code}' and tbl_order_petrol.itm_code = '${tbl_temporary2.data[itm].itm_code}' 
                                and tbl_petrol_tank.ptrl_tank_flag = '1'
                                order by tbl_petrol_tank.tnk_number asc`
                            }

                            console.log('script3', script3)
                            let tbl_temporary3 = await pgConn.get(dbPrefix + lic_code, script3, config.connectionString());

                            var xtank_number = ``;

                            if (!tbl_temporary3.code) {
                                if (tbl_temporary3.data.length > 0) {
                                    console.log(tbl_temporary3.data[0].tnk_number);
                                    console.log(tbl_temporary3.data[0].ptrl_tank_code);
                                    console.log(xtankuse);
                                    xtank_number = tbl_temporary3.data[0].tnk_number;
                                    xtankuse.push(tbl_temporary3.data[0].ptrl_tank_code)
                                }
                                else {
                                    console.log('tbl_temporary3 length = 0');
                                }
                            }
                            else {
                                console.log('tbl_temporary3 is error.');
                            }

                            xitem += `
                            <item>
                                <template_id>${xtemplate_id}</template_id>
                                <pos_number>${xpos_number}</pos_number>
                                <pos_index>${xpos_index}</pos_index>
                                <description>${xdescription}</description>
                                <short_description>${xshort_description}</short_description>
                                <material_number>${xmaterial_number}</material_number>
                                <quantities>
                                    <quantity>
                                        <qualifier>dimension.volume</qualifier>
                                        <unit>l</unit>
                                        <value>${xquantity}</value>
                                    </quantity>
                                </quantities>
                                <parameters>
                                    <parameter>
                                        <qualifier>bol</qualifier>
                                    </parameter>
                                    <parameter>
                                        <qualifier>tank.number</qualifier>
                                        <value>T${xtank_number}</value>
                                    </parameter>
                                    <parameter>
                                        <qualifier>compartment.number</qualifier>
                                        <value>${xcompartment_number}</value>
                                    </parameter>
                                    <parameter>
                                        <qualifier>depot</qualifier>
                                        <!-- Filled in case of multipickup scenario, otherwise empty -->
                                        <value>${xlloading_name}</value>
                                    </parameter>
                                    <parameter>
                                        <qualifier>trailer_plate_number</qualifier>
                                        <value>${xlicense_plate_trailer}</value>
                                    </parameter>
                                </parameters>
                            </item>`
                        }

                        var xdata = `<transport>
                        <number>${xnumber}</number>
                        <shipper_id>454692</shipper_id>
                        <plant>TH Pongrawe CO LTD</plant>
                        <vehicle_id>${xvehicle_id}</vehicle_id>
                        <license_plate_truck>${xlicense_plate_truck}</license_plate_truck>
                        <license_plate_trailer>${xlicence_plate_second_trailer}</license_plate_trailer>
                        <comment>-</comment>
                        <shipments>
                            <shipment>
                                <number>${xshipments_code}</number>
                                <shipper_id>454692</shipper_id>
                                <plant>TH Pongrawe CO LTD</plant>
                                <vehicle_id>${xvehicle_id}</vehicle_id>
                                <parameter>
                                    <qualifier>gsap_order_number</qualifier>
                                    <value></value>
                                </parameter>
                                <comment></comment>
                                <station type="loading">
                                    <company_name>${xlcompany_name}</company_name>
                                    <address>${xladdress}</address>
                                    <zip>${xlzip}</zip>
                                    <city>${xlcity}</city>
                                    <country_id>TH</country_id>
                                    <loading_name>${xlloading_name}</loading_name>
                                    <date_time_period>
                                        <start>${xlstart}</start>
                                        <end>${xlend}</end>
                                        <timezone>Asia/Bangkok</timezone>
                                    </date_time_period>
                                    <comment></comment>
                                </station>
                                <station type="unloading">
                                    <company_name>${xuncompany_name}</company_name>
                                    <address>${xunaddress}</address>
                                    <zip>${xunzip}</zip>
                                    <city>${xuncity}</city>
                                    <country_id>TH</country_id>
                                    <loading_name>${xunloading_name}</loading_name>
                                    <date_time_period>
                                        <start>${xunstart}</start>
                                        <end>${xunend}</end>
                                        <timezone>Asia/Bangkok</timezone>
                                    </date_time_period>
                                    <comment></comment>
                                </station>
                                <items>${xitem}</items>
                                <parameters>
                                    <parameter>
                                        <qualifier>gsap_order_number</qualifier>
                                        <value></value>
                                    </parameter>
                                    <parameter>
                                        <qualifier>gsap_status</qualifier>
                                        <value>${xgsap_order_status}</value>
                                    </parameter>
                                    <parameter>
                                        <qualifier>order_type</qualifier>
                                        <value>${xgsap_order_type_code}</value>
                                    </parameter>
                                </parameters>
                            </shipment>
                        </shipments>
                        <parameters>
                            <parameter>
                                <qualifier>gsap_shipment_number</qualifier>
                                <value></value>
                            </parameter>
                            <parameter>
                                <qualifier>fuel_type</qualifier>
                                <value>Diesel</value>
                            </parameter>
                            <parameter>
                                <qualifier>is_discharged</qualifier>
                                <value>false</value>
                            </parameter>
                            <parameter>
                                <qualifier>is_redirect</qualifier>
                                <value>false</value>
                            </parameter>
                            <parameter>
                                <qualifier>truck_id</qualifier>
                                <value>${xtruck_id}</value>
                            </parameter>
                            <parameter>
                                <qualifier>licence_plate_second_trailer</qualifier>
                                <value></value>
                            </parameter>
                        </parameters>
                        </transport>`

                        console.log('xproduction', xproduction);
                        console.log(xdata);
                        if (xproduction && lic_code == 'prw02') {
                            debugger
                            let xconfig = {
                                method: 'post',
                                maxBodyLength: Infinity,
                                url: 'xxxxx',
                                headers: {
                                    'Content-Type': 'application/xml',
                                    'Authorization': 'Basic SW50ZXJmYWNlQDYyNDc0NTpXc0A2NTQzMjE='
                                },
                                data: xdata
                            };

                            console.log(xconfig.url);
                            await axios.request(xconfig)
                                .then((response) => {
                                    console.log(JSON.stringify(response.data));
                                    if (response.data.success == true) {
                                        console.log(ord_code, 'TMP Complete');
                                        return true;
                                    }
                                    else {
                                        console.log(ord_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP, TMP Reject');
                                        return false;
                                    }
                                })
                                .catch((error) => {
                                    console.log(error);
                                    console.log(ord_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP');
                                    return false;
                                });
                        }
                        else {
                            return true;
                        }

                    }
                    else {
                        console.log(ord_code, 'ไม่พบข้อมูล Item ใน Order เพื่อส่งไปยัง TMP');
                        return false;
                    }
                }
                else {
                    console.log(ord_code, 'ไม่สามารถดึง Item ใน Order เพื่อส่งไปยัง TMP');
                    return false;
                }

            }
            else {
                console.log(ord_code, 'ไม่พบข้อมูล Order เพื่อส่งไปยัง TMP');
                return false;
            }
        }
        else {
            console.log(ord_code, 'ไม่สามารถดึงข้อมูลเพื่อส่งไปยัง TMP');
            return false;
        }

    } catch (err) {
        console.log(err);
        return false;
    }

}

exports.postAcceptOrder2Tmp = async (lic_code, ord_code) => {

    try {

        var script1 = `select transport_code FROM public.tbl_order 
        where ord_code = '${ord_code}' and ord_flag = '1' and transport_code is not null and transport_code != '' `

        let tbl_temporary1 = await pgConn.get(dbPrefix + lic_code, script1, config.connectionString());

        if (!tbl_temporary1.code) {
            console.log('postAcceptOrder2Tmp: order number', ord_code);
            debugger
            if (tbl_temporary1.data.length > 0) {
                var transport_code = tbl_temporary1.data[0].transport_code;

                var xdata = `<?xml version="1.0" encoding="UTF-8"?>
                <nto_accept_transport>
                    <scheduler_email>amnart_pg@dtc.co.th</scheduler_email>
                    <transport_id>${transport_code}</transport_id>
                </nto_accept_transport>`

                debugger
                console.log('xproduction', xproduction);
                console.log(xdata);
                if (xproduction && lic_code == 'prw02') {
                    let xconfig = {
                        method: 'post',
                        maxBodyLength: Infinity,
                        url: 'xxxxx',
                        headers: {
                            'Content-Type': 'application/xml',
                            'Authorization': 'Basic SW50ZXJmYWNlQDYyNDc0NTpXc0A2NTQzMjE='
                        },
                        data: xdata
                    };

                    console.log(xconfig.url);
                    await axios.request(xconfig)
                        .then((response) => {
                            console.log(JSON.stringify(response.data));
                            if (response.data.success == true) {
                                console.log(ord_code, 'Accept TMP Complete');
                                return true;
                            }
                            else {
                                console.log(ord_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP, Accept TMP Reject');
                                return false;
                            }

                        })
                        .catch((error) => {
                            console.log(error);
                            console.log(ord_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP');
                            return false;
                        });
                }
                else {
                    return true;
                }
            }
            else {
                console.log(ord_code, 'ไม่พบข้อมูล Transport code เพื่อส่งไปยัง TMP');
                return false;
            }
        }
        else {
            console.log(ord_code, 'ไม่สามารถดึงข้อมูลเพื่อส่งไปยัง TMP');
            return false;
        }

    } catch (err) {
        console.log(err);
        return false;
    }

}

exports.postDeclineOrder2Tmp = async (lic_code, ord_code) => {

    try {

        var script1 = `select transport_code FROM public.tbl_order 
        where ord_code = '${ord_code}' and ord_flag = '1' and transport_code is not null and transport_code != '' `

        let tbl_temporary1 = await pgConn.get(dbPrefix + lic_code, script1, config.connectionString());

        if (!tbl_temporary1.code) {
            console.log('postDeclineOrder2Tmp: order number', ord_code);
            debugger
            if (tbl_temporary1.data.length > 0) {
                var transport_code = tbl_temporary1.data[0].transport_code;

                var xdata = `<?xml version="1.0" encoding="UTF-8"?>
                <nto_accept_transport>
                    <scheduler_email>amnart_pg@dtc.co.th</scheduler_email>
                    <transport_id>${transport_code}</transport_id>
                </nto_accept_transport>`

                debugger
                console.log('xproduction', xproduction);
                console.log(xdata);
                if (xproduction && lic_code == 'prw02') {
                    let xconfig = {
                        method: 'post',
                        maxBodyLength: Infinity,
                        url: 'xxx',
                        headers: {
                            'Content-Type': 'application/xml',
                            'Authorization': 'Basic SW50ZXJmYWNlQDYyNDc0NTpXc0A2NTQzMjE='
                        },
                        data: xdata
                    };

                    console.log(xconfig.url);
                    await axios.request(xconfig)
                        .then((response) => {
                            console.log(JSON.stringify(response.data));
                            if (response.data.success == true) {
                                console.log(ord_code, 'Decline TMP Complete');
                                return true;
                            }
                            else {
                                console.log(ord_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP, Decline TMP Reject');
                                return false;
                            }

                        })
                        .catch((error) => {
                            console.log(error);
                            console.log(ord_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP');
                            return false;
                        });
                }
                else {
                    return true;
                }
            }
            else {
                console.log(ord_code, 'ไม่พบข้อมูล Transport code เพื่อส่งไปยัง TMP');
                return false;
            }
        }
        else {
            console.log(ord_code, 'ไม่สามารถดึงข้อมูลเพื่อส่งไปยัง TMP');
            return false;
        }

    } catch (err) {
        console.log(err);
        return false;
    }

}

exports.postCloseRedirectOrder2Tmp = async (lic_code, ord_code) => {

    try {

        var script1 = `select 
        tbl_order.ord_code, tbl_order.shipments_code,tbl_driver.dver_code, tbl_driver.dver_name, tbl_driver.dver_surname,
        tbl_vehicle.veh_license_number, tbl_vehicle.veh_number, tbl_vehicle.veh_type_code, tbl_vehicle.veh_license_province, tbl_vehicle.veh_sub_license_number, tbl_vehicle.veh_sub_license_province,
        tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc, 
        case when tbl_order_depot.dpo_address is null then tbl_depot.dpo_address else tbl_order_depot.dpo_address end as dpo_address,
        case when tbl_order_depot.dpo_zip_code is null then tbl_depot.dpo_zip_code else tbl_order_depot.dpo_zip_code end as dpo_zip_code,
        case when tbl_order_depot.dpo_country_code is null then tbl_depot.dpo_country_code else tbl_order_depot.dpo_country_code end as dpo_country_code,
        case when tbl_order_depot.dpo_lat is null then tbl_depot.dpo_lat else tbl_order_depot.dpo_lat end as dpo_lat,
        case when tbl_order_depot.dpo_lon is null then tbl_depot.dpo_lon else tbl_order_depot.dpo_lon end as dpo_lon,
        case when tbl_order_depot.dpo_city is null then tbl_depot.dpo_city else tbl_order_depot.dpo_city end as dpo_city,
        tbl_order_depot.loading_start_dt, tbl_order_depot.loading_end_dt, tbl_depot.dpo_loading_minute,
        tbl_order_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc, 
        case when tbl_order_petrol.ptrl_address is null then tbl_petrol.ptrl_address else tbl_order_petrol.ptrl_address end as ptrl_address,
        case when tbl_order_petrol.ptrl_zip_code is null then tbl_petrol.ptrl_zip_code else tbl_order_petrol.ptrl_zip_code end as ptrl_zip_code,
        case when tbl_order_petrol.ptrl_country_code is null then tbl_petrol.ptrl_country_code else tbl_order_petrol.ptrl_country_code end as ptrl_country_code,
        case when tbl_order_petrol.ptrl_lat is null then tbl_petrol.ptrl_lat else tbl_order_petrol.ptrl_lat end as ptrl_lat,
        case when tbl_order_petrol.ptrl_lon is null then tbl_petrol.ptrl_lon else tbl_order_petrol.ptrl_lon end as ptrl_lon,
        case when tbl_order_petrol.ptrl_city is null then tbl_petrol.ptrl_city else tbl_order_petrol.ptrl_city end as ptrl_city,
        tbl_order_petrol.unloading_start_dt, tbl_order_petrol.unloading_end_dt,
        tbl_petrol.ptrl_unloading_minute,tbl_order.gsap_order_status, tbl_order.gsap_order_type_code, tbl_order.ord_type_code,
        case when tbl_order.gsap_order_number is null then '' else tbl_order.gsap_order_number end as gsap_order_number,
        case when tbl_order.gsap_shipments_number is null then '' else tbl_order.gsap_shipments_number end as gsap_shipments_number 
        from tbl_order 
        left join tbl_order_type 
        on tbl_order.ord_type_code = tbl_order_type.ord_type_code 
        left join tbl_driver on tbl_order.dver_code = tbl_driver.dver_code 
        left join tbl_vehicle on tbl_order.veh_code = tbl_vehicle.veh_code 
        left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code
        left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code            
        left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
        left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
        where tbl_order.ord_code = '${ord_code}' and tbl_order.ord_flag = '1' and tbl_order.ord_status = '4' and tbl_order_depot.ord_depot_flag = '1' and tbl_order_petrol.ord_petrol_flag = '1' `
        let tbl_temporary1 = await pgConn.get(dbPrefix + lic_code, script1, config.connectionString());

        if (!tbl_temporary1.code) {
            debugger
            if (tbl_temporary1.data.length > 0) {
                // await this.postCloseRedirectOrder2Tmp(lic_code, ord_code);
                console.log('postCloseDischargedOrder2Tmp: order number', ord_code);
                var xlicense_plate_truck = tbl_temporary1.data[0].veh_license_number.replace('-', '');
                var xlicense_plate_trailer = '';
                var xlicence_plate_second_trailer = '';
                var xtruck_id = tbl_temporary1.data[0].veh_number.replace('-', '');;
                var xvehicle_id = 'vehicleSingletruckNoTrailer';
                var xgsap_order_status = tbl_temporary1.data[0].gsap_order_status;
                var xgsap_order_number = tbl_temporary1.data[0].gsap_order_number;
                var xgsap_shipments_number = tbl_temporary1.data[0].gsap_shipments_number;
                var xgsap_order_type_code = tbl_temporary1.data[0].gsap_order_type_code;
                //vehicleSingletruckNoTrailer
                //vehicleRigidTruckWithTrailer
                //vehicleTruckTrailerCombination
                var xshipments_code = '';
                var xnumber = '';

                if (tbl_temporary1.data[0].ord_type_code == 'otyp-9999999999999') {
                    xshipments_code = tbl_temporary1.data[0].shipments_code;
                    xnumber = tbl_temporary1.data[0].ord_code.toString().replace('odr-', '').substr(0, 9)
                    xgsap_order_number = '';
                    // xgsap_shipments_number = '';
                }
                else {
                    xshipments_code = '888' + tbl_temporary1.data[0].shipments_code;
                    xnumber = '999' + tbl_temporary1.data[0].shipments_code;
                    xgsap_order_status = '';
                    xgsap_order_type_code = '';
                }

                if (tbl_temporary1.data[0].veh_type_code == 'veht-1749028886915') {
                    xvehicle_id = 'vehicleTruckTrailerCombination';

                    if (tbl_temporary1.data[0].veh_sub_license_number != '') {
                        if (tbl_temporary1.data[0].veh_sub_license_number != 'N/A') {
                            xlicence_plate_second_trailer = tbl_temporary1.data[0].veh_sub_license_number.replace('-', '');
                        }
                    }
                }
                else {
                    xlicence_plate_second_trailer = '';
                }

                //loading
                var xlcompany_name = tbl_temporary1.data[0].dpo_desc;
                var xladdress = tbl_temporary1.data[0].dpo_address;
                var xlzip = tbl_temporary1.data[0].dpo_zip_code;
                var xlcity = tbl_temporary1.data[0].dpo_city;
                var xlloading_name = tbl_temporary1.data[0].dpo_number;
                var xlstart = moment(tbl_temporary1.data[0].loading_start_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');
                var xlend = moment(tbl_temporary1.data[0].loading_end_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');

                var script2 = `select 
                ord_close_code, ord_code, itm_code, itm_unit_code, item_quantity, ord_close_flag, tbl_order_close.veh_compartment_code, 
                tbl_vehicle_compartment.veh_compartment_number, ptrl_code, ptrl_tank_code, delivery_flag
                from tbl_order_close 
                left join tbl_vehicle_compartment on tbl_order_close.veh_compartment_code = tbl_vehicle_compartment.veh_compartment_code
                where tbl_order_close.ord_code = '${ord_code}' 
                and ord_close_flag = '1'
                and delivery_flag in ('2','3')`

                let tbl_temporary2 = await pgConn.get(dbPrefix + lic_code, script2, config.connectionString());

                if (!tbl_temporary2.code) {
                    if (tbl_temporary2.data.length > 0) {
                        var xitem = ``;
                        debugger

                        for (var itm = 0; itm <= tbl_temporary2.data.length - 1; itm++) {

                            var xcompartment_number = tbl_temporary2.data[itm].veh_compartment_number
                            var xuncompany_name = '';
                            var xunaddress = '';
                            var xunzip = '';
                            var xuncity = '';
                            var xunloading_name = '';
                            var xtank_number = '';

                            if (tbl_temporary2.data[itm].delivery_flag == '3') {
                                //back to loading
                                xuncompany_name = xlcompany_name;
                                xunaddress = xladdress;
                                xunzip = xlzip;
                                xuncity = xlcity;
                                xunloading_name = xlloading_name;
                                xtank_number = '';
                            }
                            else {
                                var script4 = `select ptrl_desc, ptrl_address, ptrl_zip_code, ptrl_city, ptrl_number, tnk_number from tbl_petrol 
                                left join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code
                                where tbl_petrol.ptrl_code = '${tbl_temporary2.data[itm].ptrl_code}' 
                                and ptrl_tank_code = '${tbl_temporary2.data[itm].ptrl_tank_code}'`

                                let tbl_temporary4 = await pgConn.get(dbPrefix + lic_code, script4, config.connectionString());
                                if (!tbl_temporary4.code) {
                                    if (tbl_temporary4.data.length > 0) {
                                        xuncompany_name = tbl_temporary4.data[0].ptrl_desc;
                                        xunaddress = tbl_temporary4.data[0].ptrl_address;
                                        xunzip = tbl_temporary4.data[0].ptrl_zip_code;
                                        xuncity = tbl_temporary4.data[0].ptrl_city;
                                        xunloading_name = tbl_temporary4.data[0].ptrl_number;
                                        xtank_number = tbl_temporary4.data[itm].tnk_number;
                                    }
                                }
                            }

                            var xunstart = moment(tbl_temporary1.data[0].unloading_start_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');
                            var xunend = moment(tbl_temporary1.data[0].unloading_end_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');
                            var xtemplate_id = '';
                            var xshort_description = '';
                            var xdescription = '';
                            var xmaterial_number = '';
                            var xquantity = tbl_temporary2.data[itm].item_quantity;

                            var script5 = `select 
                            case when tbl_order_item.pos_number is null then '' else tbl_order_item.pos_number end as pos_number,
                            case when tbl_order_item.itm_desc is null then tbl_item.itm_desc else tbl_order_item.itm_desc end as itm_desc, 
                            case when tbl_order_item.itm_short_desc is null then tbl_item.itm_short_desc else tbl_order_item.itm_short_desc end as itm_short_desc,
                            tbl_item.itm_material_number
                            from tbl_order_item 
                            left join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code 
                            where tbl_order_item.ord_code = '${ord_code}' 
                            and tbl_order_item.ord_item_flag = '1'`

                            let tbl_temporary5 = await pgConn.get(dbPrefix + lic_code, script5, config.connectionString());
                            if (!tbl_temporary5.code) {
                                if (tbl_temporary5.data.length > 0) {
                                    xtemplate_id = tbl_temporary5.data[0].itm_material_number;
                                    xshort_description = tbl_temporary5.data[0].itm_desc;
                                    xdescription = tbl_temporary5.data[0].itm_desc;
                                    xmaterial_number = tbl_temporary5.data[0].itm_material_number;
                                }
                            }

                            var xpos_number = '';
                            var xpos_index = itm + 1;
                            if (xpos_index.length == 1) {
                                xpos_index = '0' + xpos_index;
                            }
                            //No-VMI
                            if (tbl_temporary1.data[0].ord_type_code == 'otyp-9999999999999') {
                                var script3 = `select case when tbl_order_item.pos_number is null then '' else tbl_order_item.pos_number end as pos_number,
                                case when tbl_order_item.itm_desc is null then tbl_item.itm_desc else tbl_order_item.itm_desc end as itm_desc, 
                                case when tbl_order_item.itm_short_desc is null then tbl_item.itm_short_desc else tbl_order_item.itm_short_desc end as itm_short_desc 

                                from tbl_order_item 
                                left join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
                                where ord_code = '${ord_code}' and tbl_order_item.itm_code = '${tbl_temporary2.data[itm].itm_code}'`

                                let tbl_temporary3 = await pgConn.get(dbPrefix + lic_code, script3, config.connectionString());

                                if (!tbl_temporary3.code) {
                                    if (tbl_temporary3.data.length > 0) {
                                        xpos_number = tbl_temporary3.data[0].xpos_number;
                                        if (xpos_number == '') {
                                            try {
                                                xpos_number = '0000' + ((itm + 1) * 10)
                                            }
                                            catch (ex) {
                                                xpos_number = '000001';
                                            }
                                        }
                                    }
                                    else {
                                        console.log('tbl_temporary3 length = 0');
                                    }
                                }
                                else {
                                    console.log('tbl_temporary3 is error.');
                                }
                            }
                            else {
                                if (xpos_number == '') {
                                    try {
                                        xpos_number = '0000' + ((itm + 1) * 10)
                                    }
                                    catch (ex) {
                                        xpos_number = '000001';
                                    }
                                }
                            }


                            xitem += `
                            <item>
                                <template_id>${xtemplate_id}</template_id>
                                <pos_number>${xpos_number}</pos_number>
                                <pos_index>${xpos_index}</pos_index>
                                <description>${xdescription}</description>
                                <short_description>${xshort_description}</short_description>
                                <material_number>${xmaterial_number}</material_number>
                                <quantities>
                                    <quantity>
                                        <qualifier>dimension.volume</qualifier>
                                        <unit>l</unit>
                                        <value>${xquantity}</value>
                                    </quantity>
                                </quantities>
                                <parameters>
                                    <parameter>
                                        <qualifier>bol</qualifier>
                                    </parameter>
                                    <parameter>
                                        <qualifier>tank.number</qualifier>
                                        <value>T${xtank_number}</value>
                                    </parameter>
                                    <parameter>
                                        <qualifier>compartment.number</qualifier>
                                        <value>${xcompartment_number}</value>
                                    </parameter>
                                    <parameter>
                                        <qualifier>depot</qualifier>
                                        <!-- Filled in case of multipickup scenario, otherwise empty -->
                                        <value>${xlloading_name}</value>
                                    </parameter>
                                    <parameter>
                                        <qualifier>trailer_plate_number</qualifier>
                                        <value>${xlicence_plate_second_trailer}</value>
                                    </parameter>
                                </parameters>
                            </item>`
                        }

                        var xdata = `<transport>
                        <number>${xnumber}</number>
                        <shipper_id>454692</shipper_id>
                        <plant>TH Pongrawe CO LTD</plant>
                        <vehicle_id>${xvehicle_id}</vehicle_id>
                        <license_plate_truck>${xlicense_plate_truck}</license_plate_truck>
                        <license_plate_trailer>${xlicence_plate_second_trailer}</license_plate_trailer>
                        <comment>-</comment>
                        <shipments>
                            <shipment>
                                <number>${xshipments_code}</number>
                                <shipper_id>454692</shipper_id>
                                <plant>TH Pongrawe CO LTD</plant>
                                <vehicle_id>${xvehicle_id}</vehicle_id>
                                <parameter>
                                    <qualifier>gsap_order_number</qualifier>
                                    <value></value>
                                </parameter>
                                <comment></comment>
                                <station type="loading">
                                    <company_name>${xlcompany_name}</company_name>
                                    <address>${xladdress}</address>
                                    <zip>${xlzip}</zip>
                                    <city>${xlcity}</city>
                                    <country_id>TH</country_id>
                                    <loading_name>${xlloading_name}</loading_name>
                                    <date_time_period>
                                        <start>${xlstart}</start>
                                        <end>${xlend}</end>
                                        <timezone>Asia/Bangkok</timezone>
                                    </date_time_period>
                                    <comment></comment>
                                </station>
                                <station type="unloading">
                                    <company_name>${xuncompany_name}</company_name>
                                    <address>${xunaddress}</address>
                                    <zip>${xunzip}</zip>
                                    <city>${xuncity}</city>
                                    <country_id>TH</country_id>
                                    <loading_name>${xunloading_name}</loading_name>
                                    <date_time_period>
                                        <start>${xunstart}</start>
                                        <end>${xunend}</end>
                                        <timezone>Asia/Bangkok</timezone>
                                    </date_time_period>
                                    <comment></comment>
                                </station>
                                <items>${xitem}</items>
                                <parameters>
                                    <parameter>
                                        <qualifier>gsap_order_number</qualifier>
                                        <value>${xgsap_order_number}</value>
                                    </parameter>
                                    <parameter>
                                        <qualifier>gsap_status</qualifier>
                                        <value>${xgsap_order_status}</value>
                                    </parameter>
                                    <parameter>
                                        <qualifier>order_type</qualifier>
                                        <value>${xgsap_order_type_code}</value>
                                    </parameter>
                                </parameters>
                            </shipment>
                        </shipments>
                        <parameters>
                            <parameter>
                                <qualifier>gsap_shipment_number</qualifier>
                                <value>${xgsap_shipments_number}</value>
                            </parameter>
                            <parameter>
                                <qualifier>fuel_type</qualifier>
                                <value>Diesel</value>
                            </parameter>
                            <parameter>
                                <qualifier>is_discharged</qualifier>
                                <value>false</value>
                            </parameter>
                            <parameter>
                                <qualifier>is_redirect</qualifier>
                                <value>true</value>
                            </parameter>
                            <parameter>
                                <qualifier>truck_id</qualifier>
                                <value>${xtruck_id}</value>
                            </parameter>
                            <parameter>
                                <qualifier>licence_plate_second_trailer</qualifier>
                                <value></value>
                            </parameter>
                        </parameters>
                        </transport>`

                        debugger
                        console.log('xproduction', xproduction);
                        console.log(xdata);
                        if (xproduction && lic_code == 'prw02') {
                            let xconfig = {
                                method: 'post',
                                maxBodyLength: Infinity,
                                url: 'xxxxx',
                                headers: {
                                    'Content-Type': 'application/xml',
                                    'Authorization': 'Basic SW50ZXJmYWNlQDYyNDc0NTpXc0A2NTQzMjE='
                                },
                                data: xdata
                            };

                            console.log(xconfig.url);
                            console.log(xdata);
                            await axios.request(xconfig)
                                .then((response) => {
                                    console.log(JSON.stringify(response.data));
                                    if (response.data.success == true) {
                                        console.log(ord_code, 'postCloseRedirectOrder2Tmp TMP Complete');
                                        return true;
                                    }
                                    else {
                                        console.log(ord_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP, TMP Reject');
                                        return false;
                                    }

                                })
                                .catch((error) => {
                                    console.log(error);
                                    console.log(ord_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP');
                                    return false;
                                });
                        }
                        else {
                            return true;
                        }
                    }
                    else {
                        console.log(ord_code, 'ไม่พบข้อมูล Redirect ใน Order เพื่อส่งไปยัง TMP');
                        return false;
                    }
                }
                else {
                    console.log(ord_code, 'ไม่สามารถดึง Item ใน Order เพื่อส่งไปยัง TMP');
                    return false;
                }

            }
            else {
                console.log(ord_code, 'ไม่พบข้อมูล Order เพื่อส่งไปยัง TMP');
                return false;
            }
        }
        else {
            console.log(ord_code, 'ไม่สามารถดึงข้อมูลเพื่อส่งไปยัง TMP');
            return false;
        }

    } catch (err) {
        console.log(err);
        return false;
    }

}

exports.postCloseDischargedOrder2Tmp = async (lic_code, ord_code) => {

    try {

        var script1 = `select 
        tbl_order.ord_code, tbl_order.shipments_code,tbl_driver.dver_code, tbl_driver.dver_name, tbl_driver.dver_surname,
        tbl_vehicle.veh_license_number, tbl_vehicle.veh_number, tbl_vehicle.veh_type_code, tbl_vehicle.veh_license_province, tbl_vehicle.veh_sub_license_number, tbl_vehicle.veh_sub_license_province,
        tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc, 
        case when tbl_order_depot.dpo_address is null then tbl_depot.dpo_address else tbl_order_depot.dpo_address end as dpo_address,
        case when tbl_order_depot.dpo_zip_code is null then tbl_depot.dpo_zip_code else tbl_order_depot.dpo_zip_code end as dpo_zip_code,
        case when tbl_order_depot.dpo_country_code is null then tbl_depot.dpo_country_code else tbl_order_depot.dpo_country_code end as dpo_country_code,
        case when tbl_order_depot.dpo_lat is null then tbl_depot.dpo_lat else tbl_order_depot.dpo_lat end as dpo_lat,
        case when tbl_order_depot.dpo_lon is null then tbl_depot.dpo_lon else tbl_order_depot.dpo_lon end as dpo_lon,
        case when tbl_order_depot.dpo_city is null then tbl_depot.dpo_city else tbl_order_depot.dpo_city end as dpo_city,
        tbl_order_depot.loading_start_dt, tbl_order_depot.loading_end_dt, tbl_depot.dpo_loading_minute,
        tbl_order_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc, 
        case when tbl_order_petrol.ptrl_address is null then tbl_petrol.ptrl_address else tbl_order_petrol.ptrl_address end as ptrl_address,
        case when tbl_order_petrol.ptrl_zip_code is null then tbl_petrol.ptrl_zip_code else tbl_order_petrol.ptrl_zip_code end as ptrl_zip_code,
        case when tbl_order_petrol.ptrl_country_code is null then tbl_petrol.ptrl_country_code else tbl_order_petrol.ptrl_country_code end as ptrl_country_code,
        case when tbl_order_petrol.ptrl_lat is null then tbl_petrol.ptrl_lat else tbl_order_petrol.ptrl_lat end as ptrl_lat,
        case when tbl_order_petrol.ptrl_lon is null then tbl_petrol.ptrl_lon else tbl_order_petrol.ptrl_lon end as ptrl_lon,
        case when tbl_order_petrol.ptrl_city is null then tbl_petrol.ptrl_city else tbl_order_petrol.ptrl_city end as ptrl_city,
        tbl_order_petrol.unloading_start_dt, tbl_order_petrol.unloading_end_dt,
        tbl_petrol.ptrl_unloading_minute,tbl_order.gsap_order_status, tbl_order.gsap_order_type_code, tbl_order.ord_type_code,
        case when tbl_order.gsap_order_number is null then '' else tbl_order.gsap_order_number end as gsap_order_number,
        case when tbl_order.gsap_shipments_number is null then '' else tbl_order.gsap_shipments_number end as gsap_shipments_number 
        from tbl_order 
        left join tbl_order_type 
        on tbl_order.ord_type_code = tbl_order_type.ord_type_code 
        left join tbl_driver on tbl_order.dver_code = tbl_driver.dver_code 
        left join tbl_vehicle on tbl_order.veh_code = tbl_vehicle.veh_code 
        left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code
        left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code            
        left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
        left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
        where tbl_order.ord_code = '${ord_code}' and tbl_order.ord_flag = '1' and tbl_order.ord_status = '4' and tbl_order_depot.ord_depot_flag = '1' and tbl_order_petrol.ord_petrol_flag = '1' `
        let tbl_temporary1 = await pgConn.get(dbPrefix + lic_code, script1, config.connectionString());

        if (!tbl_temporary1.code) {
            debugger
            if (tbl_temporary1.data.length > 0) {
                await this.postCloseRedirectOrder2Tmp(lic_code, ord_code);
                console.log('postCloseDischargedOrder2Tmp: order number', ord_code);
                var xlicense_plate_truck = tbl_temporary1.data[0].veh_license_number.replace('-', '');
                var xlicense_plate_trailer = '';
                var xlicence_plate_second_trailer = '';
                var xtruck_id = tbl_temporary1.data[0].veh_number.replace('-', '');;
                var xvehicle_id = 'vehicleSingletruckNoTrailer';
                var xgsap_order_status = tbl_temporary1.data[0].gsap_order_status;
                var xgsap_order_number = tbl_temporary1.data[0].gsap_order_number;
                var xgsap_shipments_number = tbl_temporary1.data[0].gsap_shipments_number;
                var xgsap_order_type_code = tbl_temporary1.data[0].gsap_order_type_code;
                //vehicleSingletruckNoTrailer
                //vehicleRigidTruckWithTrailer
                //vehicleTruckTrailerCombination
                var xshipments_code = '';
                var xnumber = '';

                if (tbl_temporary1.data[0].ord_type_code == 'otyp-9999999999999') {
                    xshipments_code = tbl_temporary1.data[0].shipments_code;
                    xnumber = tbl_temporary1.data[0].ord_code.toString().replace('odr-', '').substr(0, 9)
                    xgsap_order_number = '';
                }
                else {
                    xshipments_code = '888' + tbl_temporary1.data[0].shipments_code;
                    xnumber = '999' + tbl_temporary1.data[0].shipments_code;
                    xgsap_order_status = '';
                    xgsap_order_type_code = '';
                }

                if (tbl_temporary1.data[0].veh_type_code == 'veht-1749028886915') {
                    xvehicle_id = 'vehicleTruckTrailerCombination';

                    if (tbl_temporary1.data[0].veh_sub_license_number != '') {
                        if (tbl_temporary1.data[0].veh_sub_license_number != 'N/A') {
                            xlicence_plate_second_trailer = tbl_temporary1.data[0].veh_sub_license_number.replace('-', '');
                            xlicense_plate_trailer = tbl_temporary1.data[0].veh_sub_license_number.replace('-', '');
                        }
                    }
                }
                else {
                    xlicense_plate_trailer = xlicense_plate_truck;
                    xlicence_plate_second_trailer = '';
                }

                //loading
                var xlcompany_name = tbl_temporary1.data[0].dpo_desc;
                var xladdress = tbl_temporary1.data[0].dpo_address;
                var xlzip = tbl_temporary1.data[0].dpo_zip_code;
                var xlcity = tbl_temporary1.data[0].dpo_city;
                var xlloading_name = tbl_temporary1.data[0].dpo_number;
                var xlstart = moment(tbl_temporary1.data[0].loading_start_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');
                var xlend = moment(tbl_temporary1.data[0].loading_end_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');

                var script2 = `select 
                ord_close_code, ord_code, itm_code, itm_unit_code, item_quantity, ord_close_flag, tbl_order_close.veh_compartment_code, 
                tbl_vehicle_compartment.veh_compartment_number, ptrl_code, ptrl_tank_code, delivery_flag
                from tbl_order_close 
                left join tbl_vehicle_compartment on tbl_order_close.veh_compartment_code = tbl_vehicle_compartment.veh_compartment_code
                where tbl_order_close.ord_code = '${ord_code}' 
                and ord_close_flag = '1'
                and delivery_flag in ('1','2','3')`

                let tbl_temporary2 = await pgConn.get(dbPrefix + lic_code, script2, config.connectionString());

                if (!tbl_temporary2.code) {
                    if (tbl_temporary2.data.length > 0) {
                        var xitem = ``;
                        debugger

                        for (var itm = 0; itm <= tbl_temporary2.data.length - 1; itm++) {

                            var xcompartment_number = tbl_temporary2.data[itm].veh_compartment_number
                            var xuncompany_name = '';
                            var xunaddress = '';
                            var xunzip = '';
                            var xuncity = '';
                            var xunloading_name = '';
                            var xtank_number = '';

                            if (tbl_temporary2.data[itm].delivery_flag == '3') {
                                //back to loading
                                xuncompany_name = xlcompany_name;
                                xunaddress = xladdress;
                                xunzip = xlzip;
                                xuncity = xlcity;
                                xunloading_name = xlloading_name;
                                xtank_number = '';
                            }
                            else {
                                var script4 = `select ptrl_desc, ptrl_address, ptrl_zip_code, ptrl_city, ptrl_number, tnk_number from tbl_petrol 
                                left join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code
                                where tbl_petrol.ptrl_code = '${tbl_temporary2.data[itm].ptrl_code}' 
                                and ptrl_tank_code = '${tbl_temporary2.data[itm].ptrl_tank_code}'`

                                let tbl_temporary4 = await pgConn.get(dbPrefix + lic_code, script4, config.connectionString());
                                if (!tbl_temporary4.code) {
                                    if (tbl_temporary4.data.length > 0) {
                                        xuncompany_name = tbl_temporary4.data[0].ptrl_desc;
                                        xunaddress = tbl_temporary4.data[0].ptrl_address;
                                        xunzip = tbl_temporary4.data[0].ptrl_zip_code;
                                        xuncity = tbl_temporary4.data[0].ptrl_city;
                                        xunloading_name = tbl_temporary4.data[0].ptrl_number;
                                        xtank_number = tbl_temporary4.data[0].tnk_number;
                                    }
                                }
                            }

                            var xunstart = moment(tbl_temporary1.data[0].unloading_start_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');
                            var xunend = moment(tbl_temporary1.data[0].unloading_end_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');
                            var xtemplate_id = '';
                            var xshort_description = '';
                            var xdescription = '';
                            var xmaterial_number = '';
                            var xquantity = tbl_temporary2.data[itm].item_quantity;

                            var script5 = `select 
                            case when tbl_order_item.pos_number is null then '' else tbl_order_item.pos_number end as pos_number,
                            case when tbl_order_item.itm_desc is null then tbl_item.itm_desc else tbl_order_item.itm_desc end as itm_desc, 
                            case when tbl_order_item.itm_short_desc is null then tbl_item.itm_short_desc else tbl_order_item.itm_short_desc end as itm_short_desc,
                            tbl_item.itm_material_number
                            from tbl_order_item 
                            left join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code 
                            where tbl_order_item.ord_code = '${ord_code}' and tbl_order_item.itm_code = '${tbl_temporary2.data[itm].itm_code}'
                            and tbl_order_item.ord_item_flag = '1'`

                            let tbl_temporary5 = await pgConn.get(dbPrefix + lic_code, script5, config.connectionString());
                            if (!tbl_temporary5.code) {
                                if (tbl_temporary5.data.length > 0) {
                                    xtemplate_id = tbl_temporary5.data[0].itm_material_number;
                                    xshort_description = tbl_temporary5.data[0].itm_desc;
                                    xdescription = tbl_temporary5.data[0].itm_desc;
                                    xmaterial_number = tbl_temporary5.data[0].itm_material_number;
                                }
                            }

                            var xpos_number = '';
                            var xpos_index = itm + 1;
                            if (xpos_index.length == 1) {
                                xpos_index = '0' + xpos_index;
                            }
                            //No-VMI
                            if (tbl_temporary1.data[0].ord_type_code == 'otyp-9999999999999') {
                                var script3 = `select case when tbl_order_item.pos_number is null then '' else tbl_order_item.pos_number end as pos_number,
                                case when tbl_order_item.itm_desc is null then tbl_item.itm_desc else tbl_order_item.itm_desc end as itm_desc, 
                                case when tbl_order_item.itm_short_desc is null then tbl_item.itm_short_desc else tbl_order_item.itm_short_desc end as itm_short_desc 

                                from tbl_order_item 
                                left join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
                                where ord_code = '${ord_code}' and tbl_order_item.itm_code = '${tbl_temporary2.data[itm].itm_code}'`

                                let tbl_temporary3 = await pgConn.get(dbPrefix + lic_code, script3, config.connectionString());

                                if (!tbl_temporary3.code) {
                                    if (tbl_temporary3.data.length > 0) {
                                        xpos_number = tbl_temporary3.data[0].xpos_number;

                                        if (xpos_number == undefined) {
                                            xpos_number = '';
                                        }

                                        if (xpos_number == '') {
                                            try {
                                                xpos_number = '0000' + ((itm + 1) * 10)
                                            }
                                            catch (ex) {
                                                xpos_number = '000001';
                                            }
                                        }
                                    }
                                    else {
                                        console.log('tbl_temporary3 length = 0');
                                    }
                                }
                                else {
                                    console.log('tbl_temporary3 is error.');
                                }
                            }
                            else {
                                if (xpos_number == '') {
                                    try {
                                        xpos_number = '0000' + ((itm + 1) * 10)
                                    }
                                    catch (ex) {
                                        xpos_number = '000001';
                                    }
                                }
                            }


                            xitem += `
                            <item>
                                <template_id>${xtemplate_id}</template_id>
                                <pos_number>${xpos_number}</pos_number>
                                <pos_index>${xpos_index}</pos_index>
                                <description>${xdescription}</description>
                                <short_description>${xshort_description}</short_description>
                                <material_number>${xmaterial_number}</material_number>
                                <quantities>
                                    <quantity>
                                        <qualifier>dimension.volume</qualifier>
                                        <unit>l</unit>
                                        <value>${xquantity}</value>
                                    </quantity>
                                </quantities>
                                <parameters>
                                    <parameter>
                                        <qualifier>bol</qualifier>
                                    </parameter>
                                    <parameter>
                                        <qualifier>tank.number</qualifier>
                                        <value>T${xtank_number}</value>
                                    </parameter>
                                    <parameter>
                                        <qualifier>compartment.number</qualifier>
                                        <value>${xcompartment_number}</value>
                                    </parameter>
                                    <parameter>
                                        <qualifier>depot</qualifier>
                                        <!-- Filled in case of multipickup scenario, otherwise empty -->
                                        <value>${xlloading_name}</value>
                                    </parameter>
                                    <parameter>
                                        <qualifier>trailer_plate_number</qualifier>
                                        <value>${xlicence_plate_second_trailer}</value>
                                    </parameter>
                                </parameters>
                            </item>`
                        }

                        var xdata = `<transport>
                        <number>${xnumber}</number>
                        <shipper_id>454692</shipper_id>
                        <plant>TH Pongrawe CO LTD</plant>
                        <vehicle_id>${xvehicle_id}</vehicle_id>
                        <license_plate_truck>${xlicense_plate_truck}</license_plate_truck>
                        <license_plate_trailer>${xlicense_plate_trailer}</license_plate_trailer>
                        <comment>-</comment>
                        <shipments>
                            <shipment>
                                <number>${xshipments_code}</number>
                                <shipper_id>454692</shipper_id>
                                <plant>TH Pongrawe CO LTD</plant>
                                <vehicle_id>${xvehicle_id}</vehicle_id>
                                <parameter>
                                    <qualifier>gsap_order_number</qualifier>
                                    <value></value>
                                </parameter>
                                <comment></comment>
                                <station type="loading">
                                    <company_name>${xlcompany_name}</company_name>
                                    <address>${xladdress}</address>
                                    <zip>${xlzip}</zip>
                                    <city>${xlcity}</city>
                                    <country_id>TH</country_id>
                                    <loading_name>${xlloading_name}</loading_name>
                                    <date_time_period>
                                        <start>${xlstart}</start>
                                        <end>${xlend}</end>
                                        <timezone>Asia/Bangkok</timezone>
                                    </date_time_period>
                                    <comment></comment>
                                </station>
                                <station type="unloading">
                                    <company_name>${xuncompany_name}</company_name>
                                    <address>${xunaddress}</address>
                                    <zip>${xunzip}</zip>
                                    <city>${xuncity}</city>
                                    <country_id>TH</country_id>
                                    <loading_name>${xunloading_name}</loading_name>
                                    <date_time_period>
                                        <start>${xunstart}</start>
                                        <end>${xunend}</end>
                                        <timezone>Asia/Bangkok</timezone>
                                    </date_time_period>
                                    <comment></comment>
                                </station>
                                <items>${xitem}</items>
                                <parameters>
                                    <parameter>
                                        <qualifier>gsap_order_number</qualifier>
                                        <value>${xgsap_order_number}</value>
                                    </parameter>
                                    <parameter>
                                        <qualifier>gsap_status</qualifier>
                                        <value>${xgsap_order_status}</value>
                                    </parameter>
                                    <parameter>
                                        <qualifier>order_type</qualifier>
                                        <value>${xgsap_order_type_code}</value>
                                    </parameter>
                                </parameters>
                            </shipment>
                        </shipments>
                        <parameters>
                            <parameter>
                                <qualifier>gsap_shipment_number</qualifier>
                                <value>${xgsap_shipments_number}</value>
                            </parameter>
                            <parameter>
                                <qualifier>fuel_type</qualifier>
                                <value>Diesel</value>
                            </parameter>
                            <parameter>
                                <qualifier>is_discharged</qualifier>
                                <value>true</value>
                            </parameter>
                            <parameter>
                                <qualifier>is_redirect</qualifier>
                                <value>false</value>
                            </parameter>
                            <parameter>
                                <qualifier>truck_id</qualifier>
                                <value>${xtruck_id}</value>
                            </parameter>
                            <parameter>
                                <qualifier>licence_plate_second_trailer</qualifier>
                                <value></value>
                            </parameter>
                        </parameters>
                        </transport>`

                        debugger
                        console.log('xproduction', xproduction);
                        console.log(xdata);
                        if (xproduction && lic_code == 'prw02') {
                            let xconfig = {
                                method: 'post',
                                maxBodyLength: Infinity,
                                url: 'xxxxx',
                                headers: {
                                    'Content-Type': 'application/xml',
                                    'Authorization': 'Basic SW50ZXJmYWNlQDYyNDc0NTpXc0A2NTQzMjE='
                                },
                                data: xdata
                            };

                            console.log(xconfig.url);
                            console.log(xdata);
                            await axios.request(xconfig)
                                .then((response) => {
                                    console.log(JSON.stringify(response.data));
                                    if (response.data.success == true) {
                                        console.log(ord_code, 'postCloseDischargedOrder2Tmp TMP Complete');
                                        return true;
                                    }
                                    else {
                                        console.log(ord_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP, TMP Reject');
                                        return false;
                                    }

                                })
                                .catch((error) => {
                                    console.log(error);
                                    console.log(ord_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP');
                                    return false;
                                });
                        }
                        else {
                            return true;
                        }
                    }
                    else {
                        console.log(ord_code, 'ไม่พบข้อมูล Item ใน Order เพื่อส่งไปยัง TMP');
                        return false;
                    }
                }
                else {
                    console.log(ord_code, 'ไม่สามารถดึง Item ใน Order เพื่อส่งไปยัง TMP');
                    return false;
                }

            }
            else {
                console.log(ord_code, 'ไม่พบข้อมูล Order เพื่อส่งไปยัง TMP');
                return false;
            }
        }
        else {
            console.log(ord_code, 'ไม่สามารถดึงข้อมูลเพื่อส่งไปยัง TMP');
            return false;
        }

    } catch (err) {
        console.log(err);
        return false;
    }

}

exports.getItemInformation = async (lic_code, itm_material_number) => {

    var xresult = [{
        itm_code: "",
        itm_desc: "",
        itm_short_desc: "",
        itm_type_code: "",
        itm_unit_code: "",
        itm_material_number: ""
    }]

    try {
        ////debugger
        let script = `select itm_code, itm_desc, itm_short_desc, itm_type_code, itm_unit_code, itm_material_number  from tbl_item 
        where itm_material_number = '${itm_material_number}' and itm_flag = '1';`
        let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

        if (!tbl_temporary.code) {
            if (tbl_temporary.data.length > 0) {
                xresult[0].itm_code = tbl_temporary.data[0].itm_code;
                xresult[0].itm_desc = tbl_temporary.data[0].itm_desc;
                xresult[0].itm_short_desc = tbl_temporary.data[0].itm_short_desc;
                xresult[0].itm_type_code = tbl_temporary.data[0].itm_type_code;
                xresult[0].itm_unit_code = tbl_temporary.data[0].itm_unit_code;
                xresult[0].itm_material_number = tbl_temporary.data[0].itm_material_number;
                return xresult;
            }
            else {
                return xresult;
            }
        }
        else {
            return xresult;
        }

    } catch (error) {
        return xresult;
    }
}

exports.getDepotInformation = async (lic_code, dpo_number) => {

    var xresult = [{
        dpo_code: "",
        dpo_number: "",
        off_code: ""
    }]

    try {
        ////debugger
        let script = `select dpo_code, dpo_number, off_code from tbl_depot where dpo_number = '${dpo_number}' and dpo_flag = '1';`
        let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

        if (!tbl_temporary.code) {
            if (tbl_temporary.data.length > 0) {
                xresult[0].dpo_code = tbl_temporary.data[0].dpo_code;
                xresult[0].dpo_number = tbl_temporary.data[0].dpo_number;
                xresult[0].off_code = tbl_temporary.data[0].off_code;
                return xresult;
            }
            else {
                return xresult;
            }
        }
        else {
            return xresult;
        }

    } catch (error) {
        return xresult;
    }
}

exports.getDepotFromPetrolInformation = async (lic_code, petrol_code) => {

    var xresult = [{
        dpo_code: "",
        dpo_number: "",
        off_code: ""
    }]

    try {
        ////debugger
        let script = `select tbl_petrol_depot.dpo_code, dpo_number, tbl_depot.off_code from tbl_petrol_depot 
        left join tbl_depot
        on tbl_petrol_depot.dpo_code = tbl_depot.dpo_code
        where tbl_petrol_depot.ptrl_code = '${petrol_code}' 
        and dpo_flag = '1' and tbl_petrol_depot.ptrl_depot_flag = '1' 
        order by ptrl_depot_status asc;`
        let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

        if (!tbl_temporary.code) {
            if (tbl_temporary.data.length > 0) {
                xresult[0].dpo_code = tbl_temporary.data[0].dpo_code;
                xresult[0].dpo_number = tbl_temporary.data[0].dpo_number;
                xresult[0].off_code = tbl_temporary.data[0].off_code;
                return xresult;
            }
            else {
                return xresult;
            }
        }
        else {
            return xresult;
        }

    } catch (error) {
        return xresult;
    }
}

exports.getCustomerInformation = async (lic_code, ptrl_number, tnk_number) => {

    var xresult = [{
        ptrl_number: "",
        ptrl_code: "",
        ptrl_desc: "",
        ptrl_address: "",
        ptrl_zip_code: "",
        ptrl_city: "",
        ptrl_group_code: "",
        ptrl_tank_code: "",
    }]

    try {
        ////debugger
        let script = `select ptrl_number, tbl_petrol.ptrl_code, ptrl_desc, ptrl_address, ptrl_zip_code, ptrl_city, ptrl_group_code, 
        tbl_petrol_tank.ptrl_tank_code, tbl_petrol_tank.tnk_number
        from public.tbl_petrol 
        left join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code
        where ptrl_number = '${ptrl_number}' and tbl_petrol_tank.tnk_number = '${tnk_number}' and ptrl_flag = '1' and tbl_petrol_tank.ptrl_tank_flag = '1';`
        let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

        if (!tbl_temporary.code) {
            if (tbl_temporary.data.length > 0) {
                xresult[0].ptrl_number = tbl_temporary.data[0].ptrl_number;
                xresult[0].ptrl_code = tbl_temporary.data[0].ptrl_code;
                xresult[0].ptrl_desc = tbl_temporary.data[0].ptrl_desc;
                xresult[0].ptrl_address = tbl_temporary.data[0].ptrl_address;
                xresult[0].ptrl_zip_code = tbl_temporary.data[0].ptrl_zip_code;
                xresult[0].ptrl_city = tbl_temporary.data[0].ptrl_city;
                xresult[0].ptrl_group_code = tbl_temporary.data[0].ptrl_group_code;
                xresult[0].ptrl_tank_code = tbl_temporary.data[0].ptrl_tank_code;
                return xresult;
            }
            else {
                return xresult;
            }
        }
        else {
            return xresult;
        }

    } catch (error) {
        return xresult;
    }
}

exports.getCustomerInformationWithItem = async (lic_code, ptrl_number, itm_material_number) => {

    var xresult = [{
        ptrl_number: "",
        ptrl_code: "",
        ptrl_desc: "",
        ptrl_address: "",
        ptrl_zip_code: "",
        ptrl_city: "",
        ptrl_group_code: "",
        ptrl_tank_code: "",
    }]

    try {
        ////debugger
        let script = `select ptrl_number, tbl_petrol.ptrl_code, ptrl_desc, ptrl_address, ptrl_zip_code, ptrl_city, ptrl_group_code, 
        tbl_petrol_tank.ptrl_tank_code, tbl_petrol_tank.tnk_number, tbl_petrol_tank.itm_code, tbl_item.itm_material_number
        from public.tbl_petrol 
        left join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code 
        left join tbl_item on tbl_petrol_tank.itm_code = tbl_item.itm_code 
        where ptrl_number = '${ptrl_number}' and tbl_item.itm_material_number = '${itm_material_number}' and ptrl_flag = '1';`

        let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

        if (!tbl_temporary.code) {
            if (tbl_temporary.data.length > 0) {
                xresult[0].ptrl_number = tbl_temporary.data[0].ptrl_number;
                xresult[0].ptrl_code = tbl_temporary.data[0].ptrl_code;
                xresult[0].ptrl_desc = tbl_temporary.data[0].ptrl_desc;
                xresult[0].ptrl_address = tbl_temporary.data[0].ptrl_address;
                xresult[0].ptrl_zip_code = tbl_temporary.data[0].ptrl_zip_code;
                xresult[0].ptrl_city = tbl_temporary.data[0].ptrl_city;
                xresult[0].ptrl_group_code = tbl_temporary.data[0].ptrl_group_code;
                xresult[0].ptrl_tank_code = tbl_temporary.data[0].ptrl_tank_code;
                return xresult;
            }
            else {
                return xresult;
            }
        }
        else {
            return xresult;
        }

    } catch (error) {
        return xresult;
    }
}

exports.postSyncNonVMIOrder = async (lic_code) => {

    try {

        var xresult = false;
        let xconfig = {
            method: 'get',
            maxBodyLength: Infinity,
            url: 'xxxxx?transactional=true',
            headers: {
                'Content-Type': 'application/xml',
                'Authorization': 'Basic SW50ZXJmYWNlQDYyNDc0NTpXc0A2NTQzMjE='
            }
        };

        console.log(xconfig.url);
        await axios.request(xconfig)
            .then(async (response) => {


                var script0043 = `update tbl_order set ord_flag = '1', ord_status = '0' 
                where ord_flag = '0' and ord_type_code = 'otyp-9999999999999';`
                let tbl_temporary0043 = await pgConn.execute(dbPrefix + lic_code, script0043, config.connectionString());

                //update gsap_order_number
                var script0044 = `update tbl_order set gsap_order_number = shipments_code 
                where ord_type_code = 'otyp-9999999999999' and (gsap_order_number is null or gsap_order_number = '');`
                let tbl_temporary0044 = await pgConn.execute(dbPrefix + lic_code, script0044, config.connectionString());

                console.log('Order count:', response.data.transport.length)
                var ord_code = '';
                if (response.data.transport.length > 0) {

                    for (var xshipment = 0; xshipment <= response.data.transport.length - 1; xshipment++) {

                        console.log(xshipment, response.data.transport.length - 1, response.data.transport[xshipment].number, response.data.transport[xshipment].owner);
                        //get only non-vmi
                        if (response.data.transport[xshipment].owner == 'No-VMI orders') {
                            debugger
                            //insert to temporary
                            try {
                                var tprn_code = response.data.transport[xshipment].id;
                                var pull_code = response.data.transport[xshipment].number;
                                var tprn_information = JSON.stringify(response.data.transport[xshipment]);
                                var tprn_result = '';
                                var tprn_remark = response.data.transport[xshipment].owner;
                                var ist_dt = moment(response.data.transport[xshipment].timestamp).format('YYYY-MM-DD HH:mm:ss');
                                var tprn_flag = '1';

                                let script0r = `insert into tbl_transporeon_order 
                                (tprn_code, pull_code, tprn_information, tprn_result, tprn_remark, ist_dt, tprn_flag) 
                                values ('${tprn_code}', '${pull_code}', '${tprn_information}', '${tprn_result}', 
                                '${tprn_remark}', '${ist_dt}', '${tprn_flag}')`
                                let tbl_temporary0xxr = await pgConn.execute(dbPrefix + lic_code, script0r, config.connectionString());
                                debugger
                            } catch (err) {
                                debugger
                                console.log(err);
                                console.log(moment().format('YYYY-MM-DD HH:mm:ss'), 'save log Non-VMI-Order is error.');
                            }

                            //qualifier
                            if (response.data.transport[xshipment].qualifier == 'tour.assigned.cancelled') {
                                let script0 = ``
                                script0 = `update tbl_order set ord_status = '-1' where shipments_code = '${response.data.transport[xshipment].number}'`
                                let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script0, config.connectionString());
                                xresult = true;
                            }
                            else {
                                let script0 = `select ord_code, ord_status, ord_flag from tbl_order 
                                where shipments_code = '${response.data.transport[xshipment].number}'`
                                let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script0, config.connectionString());

                                if (!tbl_temporary0.code) {
                                    if (tbl_temporary0.data.length > 0) {
                                        ord_code = tbl_temporary0.data[0].ord_code.toString();
                                        ord_status = tbl_temporary0.data[0].ord_status.toString();
                                        var ord_flag = tbl_temporary0.data[0].ord_flag.toString();

                                        if (ord_flag == '0') {
                                            var script001 = `update tbl_order set ord_flag = '1' 
                                            where ord_code = '${tbl_temporary0.data[0].ord_code}' `
                                            let tbl_temporary001 = await pgConn.execute(dbPrefix + lic_code, script001, config.connectionString());
                                        }

                                        console.log(moment().format('YYYY-MM-DD HH:mm:ss'), 'Checked Order', response.data.transport[xshipment].number, 'is duplicate.');
                                        //checked for change
                                        try {
                                            gsap_order_status = response.data.transport[xshipment].shipments[0].parameters.filter(x => x.qualifier == 'gsap_status')[0].value

                                            if (gsap_order_status.toString().toUpperCase() == 'C' || response.data.transport[xshipment].status == 'C') {
                                                if (response.data.transport[xshipment].qualifier == "tour.assigned.change") {
                                                    if (tbl_temporary0.data[0].ord_code != '') {

                                                        if (ord_status == '-1') {
                                                            var script001 = `update tbl_order set ord_flag = '1', ord_status = '0' 
                                                            where ord_code = '${tbl_temporary0.data[0].ord_code}' `
                                                            let tbl_temporary001 = await pgConn.execute(dbPrefix + lic_code, script001, config.connectionString());
                                                        }

                                                        if (response.data.transport[xshipment].shipments.length > 0) {
                                                            var shipments = response.data.transport[xshipment].shipments;
                                                            let transportOrderId = response.data.transport[xshipment].number;
                                                            let comment = shipments[0].comment;
                                                            let document_reference = response.data.transport[xshipment].document_reference;
                                                            let ord_dt = moment(response.data.transport[xshipment].timestamp).add('Hours', 0).format('YYYY-MM-DD HH:mm:ss');
                                                            let req_dt = moment(response.data.transport[xshipment].end_date + ' ' + response.data.transport[xshipment].end_time).add('Hours', 0).format('YYYY-MM-DD HH:mm:ss');
                                                            let gsap_order_type_code = 'ZOR';
                                                            let gsap_order_status = 'N';
                                                            let transporeon_status = 'N';
                                                            let quantityAmountWhiteOil = 0;

                                                            for (var xpr = 0; xpr <= shipments[0].parameters.length - 1; xpr++) {
                                                                //debugger
                                                                if (shipments[0].parameters[xpr].qualifier == 'order_type') {
                                                                    gsap_order_type_code = shipments[0].parameters[xpr].value;
                                                                } else if (shipments[0].parameters[xpr].qualifier == 'gsap_status') {
                                                                    gsap_order_status = shipments[0].parameters[xpr].value;
                                                                }

                                                                if (xpr == shipments[0].parameters.length - 1) {

                                                                    for (var xsh = 0; xsh <= shipments.length - 1; xsh++) {

                                                                        if (shipments[0].station.length >= 2) {
                                                                            var dpo_number = '';
                                                                            var xdpo_information = '';
                                                                            var dpo_code = '';
                                                                            var itm_material_number = '';
                                                                            var xcustomer_information = '';
                                                                            var ptrl_code = '';
                                                                            var ord_customer_code = '';
                                                                            var ord_customer_name = '';
                                                                            var ord_customer_number = '';
                                                                            var petrol_group_code = '';
                                                                            var ptrl_tank_code = '';
                                                                            var ptrl_number = '';

                                                                            for (var xss = 0; xss <= shipments[0].station.length - 1; xss++) {

                                                                                if (shipments[0].station[xss].type == 'loading') {
                                                                                    dpo_number = shipments[0].station[xss].loading_name;
                                                                                    xdpo_information = await this.getDepotInformation(lic_code, dpo_number);
                                                                                    dpo_code = xdpo_information[0].dpo_code;
                                                                                    debugger
                                                                                } else if (shipments[0].station[xss].type == 'unloading') {

                                                                                    ptrl_number = shipments[0].station[xss].loading_name

                                                                                    for (var xitm = 0; xitm <= shipments[0].items.length - 1; xitm++) {
                                                                                        itm_material_number = shipments[0].items[xitm].material_number;
                                                                                        xcustomer_information = await this.getCustomerInformationWithItem(lic_code, ptrl_number, itm_material_number);
                                                                                        //insert item information
                                                                                        let itm_code = '';
                                                                                        let itm_unit_code = '';
                                                                                        let item_quantity = 0;
                                                                                        let pos_number = shipments[0].items[xitm].pos_number;
                                                                                        let itm_desc = shipments[0].items[xitm].description;
                                                                                        let itm_short_desc = shipments[0].items[xitm].short_description;
                                                                                        let xitm_information = await this.getItemInformation(lic_code, itm_material_number);
                                                                                        itm_code = xitm_information[0].itm_code;
                                                                                        itm_unit_code = xitm_information[0].itm_unit_code;
                                                                                        itm_material_number = xitm_information[0].itm_material_number;

                                                                                        try {
                                                                                            if (shipments[0].items[xitm].quantities[0].qualifier == 'dimension.volume') {
                                                                                                item_quantity = parseFloat(shipments[0].items[xitm].quantities[0].value);
                                                                                            }
                                                                                        } catch (error) {
                                                                                            item_quantity = 0;
                                                                                        }

                                                                                        if (itm_code != '') {

                                                                                            try {
                                                                                                if (shipments[0].items[xitm].quantities[0].qualifier == 'dimension.volume') {
                                                                                                    item_quantity = parseFloat(shipments[0].items[xitm].quantities[0].value);
                                                                                                }
                                                                                            } catch (error) {
                                                                                                item_quantity = 0;
                                                                                            }

                                                                                            script0 = `update tbl_order_item 
                                                                                            set pos_number = '${pos_number}', item_quantity = ${item_quantity}, itm_desc = '${itm_desc}', itm_short_desc = '${itm_short_desc}' where 
                                                                                            ord_code = '${tbl_temporary0.data[0].ord_code}' and itm_code = '${itm_code}'`
                                                                                            let tbl_temporary00 = await pgConn.execute(dbPrefix + lic_code, script0, config.connectionString());
                                                                                            debugger

                                                                                        }

                                                                                        if (xitm == shipments[0].items.length - 1) {
                                                                                            var script001 = `update tbl_order
                                                                                            set gsap_order_status = '${gsap_order_status}', ord_comment = '${comment}'
                                                                                            where ord_code = '${tbl_temporary0.data[0].ord_code}' `
                                                                                            let tbl_temporary001 = await pgConn.execute(dbPrefix + lic_code, script001, config.connectionString());
                                                                                        }
                                                                                    }
                                                                                }

                                                                            }
                                                                        }

                                                                    }
                                                                }
                                                            }

                                                        }
                                                        else {
                                                            console.log(moment().format('YYYY-MM-DD HH:mm:ss'), 'Checked Order', response.data.transport[xshipment].number, 'shipments is empty.');
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        catch (ex) {
                                            debugger
                                        }
                                    }
                                    else {
                                        //insert to tbl_order
                                        if (response.data.transport[xshipment].shipments.length > 0) {
                                            debugger
                                            var shipments = response.data.transport[xshipment].shipments;
                                            let transportOrderId = response.data.transport[xshipment].number;
                                            let comment = shipments[0].comment;
                                            let document_reference = response.data.transport[xshipment].document_reference;
                                            let ord_dt = moment(response.data.transport[xshipment].timestamp).add('Hours', 0).format('YYYY-MM-DD HH:mm:ss');
                                            let req_dt = moment(response.data.transport[xshipment].end_date + ' ' + response.data.transport[xshipment].end_time).add('Hours', 0).format('YYYY-MM-DD HH:mm:ss');
                                            let gsap_order_type_code = 'ZOR';
                                            let gsap_order_status = 'N';
                                            let transporeon_status = 'N';
                                            let quantityAmountWhiteOil = 0;

                                            for (var xpr = 0; xpr <= shipments[0].parameters.length - 1; xpr++) {
                                                //debugger
                                                if (shipments[0].parameters[xpr].qualifier == 'order_type') {
                                                    gsap_order_type_code = shipments[0].parameters[xpr].value;
                                                } else if (shipments[0].parameters[xpr].qualifier == 'gsap_status') {
                                                    gsap_order_status = shipments[0].parameters[xpr].value;
                                                }

                                                if (xpr == shipments[0].parameters.length - 1) {
                                                    for (var xsh = 0; xsh <= shipments.length - 1; xsh++) {
                                                        let ord_type_code = 'otyp-9999999999999';
                                                        let off_code = 'off-1747276087326';
                                                        ord_code = 'odr-' + moment().format('x');
                                                        debugger

                                                        if (shipments[0].station.length >= 2) {
                                                            var dpo_number = '';
                                                            var xdpo_information = '';
                                                            var dpo_code = '';
                                                            var itm_material_number = '';
                                                            var xcustomer_information = '';
                                                            var ptrl_code = '';
                                                            var ord_customer_code = '';
                                                            var ord_customer_name = '';
                                                            var ord_customer_number = '';
                                                            var petrol_group_code = '';
                                                            var ptrl_tank_code = '';
                                                            var ptrl_number = '';

                                                            for (var xss = 0; xss <= shipments[0].station.length - 1; xss++) {

                                                                if (shipments[0].station[xss].type == 'loading') {

                                                                    dpo_number = shipments[0].station[xss].loading_name;
                                                                    xdpo_information = await this.getDepotInformation(lic_code, dpo_number);
                                                                    dpo_code = xdpo_information[0].dpo_code;
                                                                    debugger

                                                                } else if (shipments[0].station[xss].type == 'unloading') {

                                                                    ptrl_number = shipments[0].station[xss].loading_name

                                                                    for (var xitm = 0; xitm <= shipments[0].items.length - 1; xitm++) {
                                                                        itm_material_number = shipments[0].items[xitm].material_number;
                                                                        xcustomer_information = await this.getCustomerInformationWithItem(lic_code, ptrl_number, itm_material_number);
                                                                        ptrl_code = xcustomer_information[0].ptrl_code;
                                                                        ord_customer_code = xcustomer_information[0].ptrl_code;
                                                                        ord_customer_name = xcustomer_information[0].ptrl_desc;
                                                                        ord_customer_number = xcustomer_information[0].ptrl_number;
                                                                        petrol_group_code = xcustomer_information[0].ptrl_group_code;
                                                                        ptrl_tank_code = xcustomer_information[0].ptrl_tank_code;

                                                                        if (xitm == 0) {

                                                                            if (ord_customer_code == '') {
                                                                                ord_customer_code = '-';
                                                                                ord_customer_name = 'ไม่พบข้อมูลบนระบบ';
                                                                                ord_customer_number = '-';
                                                                            }

                                                                            let script1 = `insert into tbl_order 
                                                                            (ord_code, shipments_code, transport_code, tour_code, 
                                                                            pull_code, number, document_reference, plant, assigned_carrier_id, 
                                                                            assigned_carrier_name, assigned_creditor_number, assigned_carrier_number, 
                                                                            ord_dt, req_dt, ord_status, ord_comment, ord_customer_code, ord_customer_name, 
                                                                            ord_customer_number, gsap_order_type_code, gsap_order_status, transporeon_status, 
                                                                            off_code, ord_flag, ist_dt, mdf_dt, rm_dt, loading_count, unloading_count, item_count, 
                                                                            item_quantity, ord_type_code, petrol_group_code, dver_code, veh_code, transporeon_result, 
                                                                            transporeon_ist_dt, transporeon_mdf_dt, transporeon_rm_dt, gsap_order_number) 
                                                                            VALUES ('${ord_code}', '${transportOrderId}', '', '', '', '${transportOrderId}', 
                                                                            '${document_reference}', 'Non-VMI orders', '624745', 'PONGRAWE Co.,Ltd', '', '', '${ord_dt}', 
                                                                            '${req_dt}', '0', '${comment}', '${ord_customer_code}', 
                                                                            '${ord_customer_name}', '${ord_customer_number}', '${gsap_order_type_code}', '${gsap_order_status}', '${transporeon_status}', 
                                                                            '${off_code}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}', 
                                                                            NULL, NULL, 0, 0, 0, 0.0, '${ord_type_code}', '${petrol_group_code}', NULL, 
                                                                            NULL, NULL, NULL, NULL, NULL, '${transportOrderId}');`;

                                                                            let tbl_temporary1 = await pgConn.execute(dbPrefix + lic_code, script1, config.connectionString());
                                                                            //debugger
                                                                            if (!tbl_temporary1.code) {
                                                                                //debugger
                                                                            }
                                                                            else {
                                                                                console.log(moment().format('YYYY-MM-DD HH:mm:ss'), 'Insert Order', ord_code, 'Order is error.');
                                                                            }
                                                                        }

                                                                        //insert item information
                                                                        let itm_code = '';
                                                                        let itm_unit_code = '';
                                                                        let item_quantity = 0;
                                                                        let pos_number = shipments[0].items[xitm].pos_number;
                                                                        let itm_desc = shipments[0].items[xitm].description;
                                                                        let itm_short_desc = shipments[0].items[xitm].short_description;
                                                                        let xitm_information = await this.getItemInformation(lic_code, itm_material_number);
                                                                        itm_code = xitm_information[0].itm_code;
                                                                        itm_unit_code = xitm_information[0].itm_unit_code;
                                                                        itm_material_number = xitm_information[0].itm_material_number;

                                                                        try {
                                                                            if (shipments[0].items[xitm].quantities[0].qualifier == 'dimension.volume') {
                                                                                item_quantity = parseFloat(shipments[0].items[xitm].quantities[0].value);
                                                                            }
                                                                        } catch (error) {
                                                                            item_quantity = 0;
                                                                        }

                                                                        if (itm_code != '') {
                                                                            var ord_item_code = 'oitm-' + moment().format('x');
                                                                            let script2 = `INSERT INTO public.tbl_order_item 
                                                                            (ord_item_code, ord_code, itm_code, itm_unit_code, item_quantity, ord_item_flag, ist_dt, pos_number, itm_desc, itm_short_desc, ptrl_tank_code) 
                                                                            values ('${ord_item_code}', '${ord_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                                                                            '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '${pos_number}', '${itm_desc}', '${itm_short_desc}', '${ptrl_tank_code}')`

                                                                            let tbl_temporary2 = await pgConn.execute(dbPrefix + lic_code, script2, config.connectionString());
                                                                            //debugger;
                                                                            if (!tbl_temporary2.code) {
                                                                                //insert loading information
                                                                                var ord_depot_code = 'odpo-' + moment().format('x');

                                                                                if (dpo_code != '') {
                                                                                    let script3 = `INSERT INTO public.tbl_order_depot 
                                                                                    (ord_depot_code, ord_code, dpo_code, itm_code, itm_unit_code, item_quantity, ord_depot_flag, ist_dt) 
                                                                                    values ('${ord_depot_code}', '${ord_code}', '${dpo_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                                                                                    '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                                                                                    let tbl_temporary3 = await pgConn.execute(dbPrefix + lic_code, script3, config.connectionString());
                                                                                    //debugger;
                                                                                    if (!tbl_temporary3.code) {
                                                                                        //insert unloading information
                                                                                        if (ptrl_code != '') {
                                                                                            var ord_petrol_code = 'optrl-' + moment().format('x');
                                                                                            let script4 = `INSERT INTO public.tbl_order_petrol 
                                                                                            (ord_petrol_code, ord_code, ptrl_code, ptrl_tank_code, itm_code, itm_unit_code, item_quantity, req_dt, ord_petrol_flag, ist_dt) 
                                                                                            values ('${ord_petrol_code}', '${ord_code}', '${ptrl_code}', '${ptrl_tank_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity},
                                                                                            '${req_dt}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                                                                                            let tbl_temporary4 = await pgConn.execute(dbPrefix + lic_code, script4, config.connectionString());
                                                                                            //debugger
                                                                                            if (!tbl_temporary4.code) {
                                                                                                console.log('sync shipments_code', transportOrderId, 'done.')
                                                                                            }
                                                                                        }

                                                                                    }
                                                                                }
                                                                                else {
                                                                                    if (ptrl_code != '') {
                                                                                        var ord_petrol_code = 'optrl-' + moment().format('x');
                                                                                        let script4 = `INSERT INTO public.tbl_order_petrol 
                                                                                    (ord_petrol_code, ord_code, ptrl_code, ptrl_tank_code, itm_code, itm_unit_code, item_quantity, req_dt, ord_petrol_flag, ist_dt) 
                                                                                    values ('${ord_petrol_code}', '${ord_code}', '${ptrl_code}', '${ptrl_tank_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity},
                                                                                    '${req_dt}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                                                                                        let tbl_temporary4 = await pgConn.execute(dbPrefix + lic_code, script4, config.connectionString());
                                                                                        //debugger
                                                                                        if (!tbl_temporary4.code) {
                                                                                            console.log('sync shipments_code', transportOrderId, 'done.')
                                                                                        }
                                                                                    }
                                                                                }

                                                                            }
                                                                        }
                                                                        else {
                                                                            var ord_depot_code = 'odpo-' + moment().format('x');

                                                                            if (dpo_code != '') {
                                                                                let script3 = `INSERT INTO public.tbl_order_depot 
                                                                                (ord_depot_code, ord_code, dpo_code, itm_code, itm_unit_code, item_quantity, ord_depot_flag, ist_dt) 
                                                                                values ('${ord_depot_code}', '${ord_code}', '${dpo_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                                                                                '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                                                                                let tbl_temporary3 = await pgConn.execute(dbPrefix + lic_code, script3, config.connectionString());
                                                                                //debugger;
                                                                                if (!tbl_temporary3.code) {
                                                                                    //insert unloading information
                                                                                    if (ptrl_code != '') {
                                                                                        var ord_petrol_code = 'optrl-' + moment().format('x');
                                                                                        let script4 = `INSERT INTO public.tbl_order_petrol 
                                                                                        (ord_petrol_code, ord_code, ptrl_code, ptrl_tank_code, itm_code, itm_unit_code, item_quantity, req_dt, ord_petrol_flag, ist_dt) 
                                                                                        values ('${ord_petrol_code}', '${ord_code}', '${ptrl_code}', '${ptrl_tank_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity},
                                                                                        '${req_dt}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                                                                                        let tbl_temporary4 = await pgConn.execute(dbPrefix + lic_code, script4, config.connectionString());
                                                                                        //debugger
                                                                                        if (!tbl_temporary4.code) {
                                                                                            console.log('sync shipments_code', transportOrderId, 'done.')
                                                                                        }
                                                                                    }

                                                                                }
                                                                            }
                                                                            else {
                                                                                if (ptrl_code != '') {
                                                                                    var ord_petrol_code = 'optrl-' + moment().format('x');
                                                                                    let script4 = `INSERT INTO public.tbl_order_petrol 
                                                                                    (ord_petrol_code, ord_code, ptrl_code, ptrl_tank_code, itm_code, itm_unit_code, item_quantity, req_dt, ord_petrol_flag, ist_dt) 
                                                                                    values ('${ord_petrol_code}', '${ord_code}', '${ptrl_code}', '${ptrl_tank_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity},
                                                                                    '${req_dt}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                                                                                    let tbl_temporary4 = await pgConn.execute(dbPrefix + lic_code, script4, config.connectionString());
                                                                                    //debugger
                                                                                    if (!tbl_temporary4.code) {
                                                                                        console.log('sync shipments_code', transportOrderId, 'done.')
                                                                                    }
                                                                                }
                                                                            }

                                                                        }
                                                                    }
                                                                }

                                                            }
                                                        }

                                                    }
                                                }
                                            }

                                        }
                                        else {
                                            console.log(moment().format('YYYY-MM-DD HH:mm:ss'), 'Checked Order', response.data.transport[xshipment].number, 'shipments is empty.');
                                        }
                                    }
                                }
                                else {
                                    console.log(moment().format('YYYY-MM-DD HH:mm:ss'), 'Checked Order', response.data.transport[xshipment].number, 'is error.');
                                }

                                if (ord_code != undefined && ord_code != '') {
                                    //debugger
                                    let script5 = `update tbl_order 
                                    set item_count = (select count(itm_code) from tbl_order_item where ord_code = '${ord_code}' and ord_item_flag = '1'),
                                    item_quantity = (select sum(item_quantity) from tbl_order_item where ord_code = '${ord_code}' and ord_item_flag = '1'), 
                                    loading_count = (select count(distinct dpo_code) from tbl_order_depot where ord_code = '${ord_code}' and ord_depot_flag = '1'),
                                    unloading_count = (select count(distinct ptrl_code) from tbl_order_petrol where ord_code = '${ord_code}' and ord_petrol_flag = '1')
                                    where ord_code = '${ord_code}'`

                                    let tbl_temporary5 = await pgConn.execute(dbPrefix + lic_code, script5, config.connectionString());
                                    console.log('update order code ', ord_code, 'done.')
                                }
                            }


                        }
                        //let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                        //debugger
                        if (xshipment == response.data.transport.length - 1) {
                            console.log(moment().format('YYYY-MM-DD HH:mm:ss'), 'Non-VMI-Order is complete.');
                            xresult = true;
                        }
                    }

                }
                else {
                    console.log(moment().format('YYYY-MM-DD HH:mm:ss'), 'Non-VMI-Order is empty.');
                    xresult = true;
                }


            })
            .catch(async (error) => {
                console.log(error);
                console.log(moment().format('YYYY-MM-DD HH:mm:ss'), 'Non-VMI-Order is error.');
                xresult = false;
            });

    } catch (err) {
        console.log(err);
        console.log(moment().format('YYYY-MM-DD HH:mm:ss'), 'Non-VMI-Order is error.');
        xresult = false;
    }
    finally {
        return xresult;
    }

}

exports.postSyncNonVMIOrderWithNumber = async (lic_code, order_no) => {

    try {

        var xresult = true;
        if (order_no == '') {
            xresult = true;
        }
        else {
            var script = `select tprn_code, pull_code, tprn_information, tprn_result, tprn_remark, ist_dt, mdf_dt, rm_dt, tprn_flag
            from tbl_transporeon_order where pull_code = '${order_no}' order by ist_dt asc;`

            let tbl_temporary0xx = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary0xx.code) {
                debugger
                if (tbl_temporary0xx.data.length > 0) {
                    console.log('Order count:', order_no, tbl_temporary0xx.data.length - 1);

                    var script0043 = `delete from tbl_order where shipments_code = '${order_no}';`
                    await pgConn.execute(dbPrefix + lic_code, script0043, config.connectionString());

                    for (var xshipment = 0; xshipment <= tbl_temporary0xx.data.length - 1; xshipment++) {
                        var transport = [];
                        transport = JSON.parse(tbl_temporary0xx.data[xshipment].tprn_information);
                        //qualifier
                        if (transport.qualifier == 'tour.assigned.cancelled') {
                            let script0 = ``
                            script0 = `update tbl_order set ord_status = '-1' where shipments_code = '${transport.number}'`
                            let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script0, config.connectionString());
                            xresult = true;
                        }
                        else {
                            let script0 = `select ord_code, ord_status, ord_flag from tbl_order 
                            where shipments_code = '${transport.number}'`
                            let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script0, config.connectionString());

                            if (!tbl_temporary0.code) {
                                if (tbl_temporary0.data.length > 0) {
                                    ord_code = tbl_temporary0.data[0].ord_code.toString();
                                    ord_status = tbl_temporary0.data[0].ord_status.toString();
                                    var ord_flag = tbl_temporary0.data[0].ord_flag.toString();

                                    if (ord_flag == '0') {
                                        var script001 = `update tbl_order set ord_flag = '1' 
                                        where ord_code = '${tbl_temporary0.data[0].ord_code}' `
                                        let tbl_temporary001 = await pgConn.execute(dbPrefix + lic_code, script001, config.connectionString());
                                    }

                                    console.log(moment().format('YYYY-MM-DD HH:mm:ss'), 'Checked Order', transport.number, 'is duplicate.');
                                    //checked for change
                                    try {
                                        gsap_order_status = transport.shipments[0].parameters.filter(x => x.qualifier == 'gsap_status')[0].value

                                        if (gsap_order_status.toString().toUpperCase() == 'C' || transport.status == 'C') {
                                            if (transport.qualifier == "tour.assigned.change") {
                                                if (tbl_temporary0.data[0].ord_code != '') {

                                                    if (ord_status == '-1') {
                                                        var script001 = `update tbl_order set ord_flag = '1', ord_status = '0' 
                                                            where ord_code = '${tbl_temporary0.data[0].ord_code}' `
                                                        let tbl_temporary001 = await pgConn.execute(dbPrefix + lic_code, script001, config.connectionString());
                                                    }

                                                    if (transport.shipments.length > 0) {
                                                        var shipments = transport.shipments;
                                                        let transportOrderId = transport.number;
                                                        let comment = shipments[0].comment;
                                                        let document_reference = transport.document_reference;
                                                        let ord_dt = moment(transport.timestamp).add('Hours', 0).format('YYYY-MM-DD HH:mm:ss');
                                                        let req_dt = moment(transport.end_date + ' ' + transport.end_time).add('Hours', 0).format('YYYY-MM-DD HH:mm:ss');
                                                        let gsap_order_type_code = 'ZOR';
                                                        let gsap_order_status = 'N';
                                                        let transporeon_status = 'N';
                                                        let quantityAmountWhiteOil = 0;

                                                        for (var xpr = 0; xpr <= shipments[0].parameters.length - 1; xpr++) {
                                                            //debugger
                                                            if (shipments[0].parameters[xpr].qualifier == 'order_type') {
                                                                gsap_order_type_code = shipments[0].parameters[xpr].value;
                                                            } else if (shipments[0].parameters[xpr].qualifier == 'gsap_status') {
                                                                gsap_order_status = shipments[0].parameters[xpr].value;
                                                            }

                                                            if (xpr == shipments[0].parameters.length - 1) {

                                                                for (var xsh = 0; xsh <= shipments.length - 1; xsh++) {

                                                                    if (shipments[0].station.length >= 2) {
                                                                        var dpo_number = '';
                                                                        var xdpo_information = '';
                                                                        var dpo_code = '';
                                                                        var itm_material_number = '';
                                                                        var xcustomer_information = '';
                                                                        var ptrl_code = '';
                                                                        var ord_customer_code = '';
                                                                        var ord_customer_name = '';
                                                                        var ord_customer_number = '';
                                                                        var petrol_group_code = '';
                                                                        var ptrl_tank_code = '';
                                                                        var ptrl_number = '';

                                                                        for (var xss = 0; xss <= shipments[0].station.length - 1; xss++) {

                                                                            if (shipments[0].station[xss].type == 'loading') {

                                                                                dpo_number = shipments[0].station[xss].loading_name;
                                                                                xdpo_information = await this.getDepotInformation(lic_code, dpo_number);
                                                                                dpo_code = xdpo_information[0].dpo_code;
                                                                                debugger

                                                                            } else if (shipments[0].station[xss].type == 'unloading') {

                                                                                ptrl_number = shipments[0].station[xss].loading_name

                                                                                for (var xitm = 0; xitm <= shipments[0].items.length - 1; xitm++) {
                                                                                    itm_material_number = shipments[0].items[xitm].material_number;
                                                                                    xcustomer_information = await this.getCustomerInformationWithItem(lic_code, ptrl_number, itm_material_number);
                                                                                    //insert item information
                                                                                    let itm_code = '';
                                                                                    let itm_unit_code = '';
                                                                                    let item_quantity = 0;
                                                                                    let pos_number = shipments[0].items[xitm].pos_number;
                                                                                    let itm_desc = shipments[0].items[xitm].description;
                                                                                    let itm_short_desc = shipments[0].items[xitm].short_description;
                                                                                    let xitm_information = await this.getItemInformation(lic_code, itm_material_number);
                                                                                    itm_code = xitm_information[0].itm_code;
                                                                                    itm_unit_code = xitm_information[0].itm_unit_code;
                                                                                    itm_material_number = xitm_information[0].itm_material_number;

                                                                                    try {
                                                                                        if (shipments[0].items[xitm].quantities[0].qualifier == 'dimension.volume') {
                                                                                            item_quantity = parseFloat(shipments[0].items[xitm].quantities[0].value);
                                                                                        }
                                                                                    } catch (error) {
                                                                                        item_quantity = 0;
                                                                                    }

                                                                                    if (itm_code != '') {

                                                                                        try {
                                                                                            if (shipments[0].items[xitm].quantities[0].qualifier == 'dimension.volume') {
                                                                                                item_quantity = parseFloat(shipments[0].items[xitm].quantities[0].value);
                                                                                            }
                                                                                        } catch (error) {
                                                                                            item_quantity = 0;
                                                                                        }

                                                                                        script0 = `update tbl_order_item 
                                                                                            set pos_number = '${pos_number}', item_quantity = ${item_quantity}, itm_desc = '${itm_desc}', itm_short_desc = '${itm_short_desc}' where 
                                                                                            ord_code = '${tbl_temporary0.data[0].ord_code}' and itm_code = '${itm_code}'`
                                                                                        let tbl_temporary00 = await pgConn.execute(dbPrefix + lic_code, script0, config.connectionString());
                                                                                        debugger

                                                                                    }

                                                                                    if (xitm == shipments[0].items.length - 1) {
                                                                                        var script001 = `update tbl_order
                                                                                            set gsap_order_status = '${gsap_order_status}'
                                                                                            where ord_code = '${tbl_temporary0.data[0].ord_code}' `
                                                                                        let tbl_temporary001 = await pgConn.execute(dbPrefix + lic_code, script001, config.connectionString());
                                                                                    }
                                                                                }
                                                                            }

                                                                        }
                                                                    }

                                                                }
                                                            }
                                                        }

                                                    }
                                                    else {
                                                        console.log(moment().format('YYYY-MM-DD HH:mm:ss'), 'Checked Order', transport.number, 'shipments is empty.');
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    catch (ex) {
                                        debugger
                                    }
                                }
                                else {
                                    //insert to tbl_order
                                    if (transport.shipments.length > 0) {
                                        debugger
                                        var shipments = transport.shipments;
                                        let transportOrderId = transport.number;
                                        let comment = shipments[0].comment;
                                        let document_reference = transport.document_reference;
                                        let ord_dt = moment(transport.timestamp).add('Hours', 0).format('YYYY-MM-DD HH:mm:ss');
                                        let req_dt = moment(transport.end_date + ' ' + transport.end_time).add('Hours', 0).format('YYYY-MM-DD HH:mm:ss');
                                        let gsap_order_type_code = 'ZOR';
                                        let gsap_order_status = 'N';
                                        let transporeon_status = 'N';
                                        let quantityAmountWhiteOil = 0;

                                        for (var xpr = 0; xpr <= shipments[0].parameters.length - 1; xpr++) {
                                            //debugger
                                            if (shipments[0].parameters[xpr].qualifier == 'order_type') {
                                                gsap_order_type_code = shipments[0].parameters[xpr].value;
                                            } else if (shipments[0].parameters[xpr].qualifier == 'gsap_status') {
                                                gsap_order_status = shipments[0].parameters[xpr].value;
                                            }

                                            if (xpr == shipments[0].parameters.length - 1) {
                                                for (var xsh = 0; xsh <= shipments.length - 1; xsh++) {
                                                    let ord_type_code = 'otyp-9999999999999';
                                                    let off_code = 'off-1747276087326';
                                                    ord_code = 'odr-' + moment().format('x');
                                                    debugger

                                                    if (shipments[0].station.length >= 2) {
                                                        var dpo_number = '';
                                                        var xdpo_information = '';
                                                        var dpo_code = '';
                                                        var itm_material_number = '';
                                                        var xcustomer_information = '';
                                                        var ptrl_code = '';
                                                        var ord_customer_code = '';
                                                        var ord_customer_name = '';
                                                        var ord_customer_number = '';
                                                        var petrol_group_code = '';
                                                        var ptrl_tank_code = '';
                                                        var ptrl_number = '';

                                                        for (var xss = 0; xss <= shipments[0].station.length - 1; xss++) {

                                                            if (shipments[0].station[xss].type == 'loading') {

                                                                dpo_number = shipments[0].station[xss].loading_name;
                                                                xdpo_information = await this.getDepotInformation(lic_code, dpo_number);
                                                                dpo_code = xdpo_information[0].dpo_code;
                                                                debugger

                                                            } else if (shipments[0].station[xss].type == 'unloading') {

                                                                ptrl_number = shipments[0].station[xss].loading_name

                                                                for (var xitm = 0; xitm <= shipments[0].items.length - 1; xitm++) {
                                                                    itm_material_number = shipments[0].items[xitm].material_number;
                                                                    xcustomer_information = await this.getCustomerInformationWithItem(lic_code, ptrl_number, itm_material_number);
                                                                    ptrl_code = xcustomer_information[0].ptrl_code;
                                                                    ord_customer_code = xcustomer_information[0].ptrl_code;
                                                                    ord_customer_name = xcustomer_information[0].ptrl_desc;
                                                                    ord_customer_number = xcustomer_information[0].ptrl_number;
                                                                    petrol_group_code = xcustomer_information[0].ptrl_group_code;
                                                                    ptrl_tank_code = xcustomer_information[0].ptrl_tank_code;

                                                                    if (xitm == 0) {

                                                                        if (ord_customer_code == '') {
                                                                            ord_customer_code = '-';
                                                                            ord_customer_name = 'ไม่พบข้อมูลบนระบบ';
                                                                            ord_customer_number = '-';
                                                                        }

                                                                        let script1 = `insert into tbl_order 
                                                                            (ord_code, shipments_code, transport_code, tour_code, 
                                                                            pull_code, number, document_reference, plant, assigned_carrier_id, 
                                                                            assigned_carrier_name, assigned_creditor_number, assigned_carrier_number, 
                                                                            ord_dt, req_dt, ord_status, ord_comment, ord_customer_code, ord_customer_name, 
                                                                            ord_customer_number, gsap_order_type_code, gsap_order_status, transporeon_status, 
                                                                            off_code, ord_flag, ist_dt, mdf_dt, rm_dt, loading_count, unloading_count, item_count, 
                                                                            item_quantity, ord_type_code, petrol_group_code, dver_code, veh_code, transporeon_result, 
                                                                            transporeon_ist_dt, transporeon_mdf_dt, transporeon_rm_dt, gsap_order_number) 
                                                                            VALUES ('${ord_code}', '${transportOrderId}', '', '', '', '${transportOrderId}', 
                                                                            '${document_reference}', 'Non-VMI orders', '624745', 'PONGRAWE Co.,Ltd', '', '', '${ord_dt}', 
                                                                            '${req_dt}', '0', '${comment}', '${ord_customer_code}', 
                                                                            '${ord_customer_name}', '${ord_customer_number}', '${gsap_order_type_code}', '${gsap_order_status}', '${transporeon_status}', 
                                                                            '${off_code}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}', 
                                                                            NULL, NULL, 0, 0, 0, 0.0, '${ord_type_code}', '${petrol_group_code}', NULL, 
                                                                            NULL, NULL, NULL, NULL, NULL, '${transportOrderId}');`;

                                                                        let tbl_temporary1 = await pgConn.execute(dbPrefix + lic_code, script1, config.connectionString());
                                                                        //debugger
                                                                        if (!tbl_temporary1.code) {
                                                                            //debugger
                                                                        }
                                                                        else {
                                                                            console.log(moment().format('YYYY-MM-DD HH:mm:ss'), 'Insert Order', ord_code, 'Order is error.');
                                                                        }
                                                                    }

                                                                    //insert item information
                                                                    let itm_code = '';
                                                                    let itm_unit_code = '';
                                                                    let item_quantity = 0;
                                                                    let pos_number = shipments[0].items[xitm].pos_number;
                                                                    let itm_desc = shipments[0].items[xitm].description;
                                                                    let itm_short_desc = shipments[0].items[xitm].short_description;
                                                                    let xitm_information = await this.getItemInformation(lic_code, itm_material_number);
                                                                    itm_code = xitm_information[0].itm_code;
                                                                    itm_unit_code = xitm_information[0].itm_unit_code;
                                                                    itm_material_number = xitm_information[0].itm_material_number;

                                                                    try {
                                                                        if (shipments[0].items[xitm].quantities[0].qualifier == 'dimension.volume') {
                                                                            item_quantity = parseFloat(shipments[0].items[xitm].quantities[0].value);
                                                                        }
                                                                    } catch (error) {
                                                                        item_quantity = 0;
                                                                    }

                                                                    if (itm_code != '') {
                                                                        var ord_item_code = 'oitm-' + moment().format('x');
                                                                        let script2 = `INSERT INTO public.tbl_order_item 
                                                                            (ord_item_code, ord_code, itm_code, itm_unit_code, item_quantity, ord_item_flag, ist_dt, pos_number, itm_desc, itm_short_desc, ptrl_tank_code) 
                                                                            values ('${ord_item_code}', '${ord_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                                                                            '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '${pos_number}', '${itm_desc}', '${itm_short_desc}', '${ptrl_tank_code}')`

                                                                        let tbl_temporary2 = await pgConn.execute(dbPrefix + lic_code, script2, config.connectionString());
                                                                        //debugger;
                                                                        if (!tbl_temporary2.code) {
                                                                            //insert loading information
                                                                            var ord_depot_code = 'odpo-' + moment().format('x');

                                                                            if (dpo_code != '') {
                                                                                let script3 = `INSERT INTO public.tbl_order_depot 
                                                                                    (ord_depot_code, ord_code, dpo_code, itm_code, itm_unit_code, item_quantity, ord_depot_flag, ist_dt) 
                                                                                    values ('${ord_depot_code}', '${ord_code}', '${dpo_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                                                                                    '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                                                                                let tbl_temporary3 = await pgConn.execute(dbPrefix + lic_code, script3, config.connectionString());
                                                                                //debugger;
                                                                                if (!tbl_temporary3.code) {
                                                                                    //insert unloading information
                                                                                    if (ptrl_code != '') {
                                                                                        var ord_petrol_code = 'optrl-' + moment().format('x');
                                                                                        let script4 = `INSERT INTO public.tbl_order_petrol 
                                                                                            (ord_petrol_code, ord_code, ptrl_code, ptrl_tank_code, itm_code, itm_unit_code, item_quantity, req_dt, ord_petrol_flag, ist_dt) 
                                                                                            values ('${ord_petrol_code}', '${ord_code}', '${ptrl_code}', '${ptrl_tank_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity},
                                                                                            '${req_dt}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                                                                                        let tbl_temporary4 = await pgConn.execute(dbPrefix + lic_code, script4, config.connectionString());
                                                                                        //debugger
                                                                                        if (!tbl_temporary4.code) {
                                                                                            console.log('sync shipments_code', transportOrderId, 'done.')
                                                                                        }
                                                                                    }

                                                                                }
                                                                            }
                                                                            else {
                                                                                if (ptrl_code != '') {
                                                                                    var ord_petrol_code = 'optrl-' + moment().format('x');
                                                                                    let script4 = `INSERT INTO public.tbl_order_petrol 
                                                                                    (ord_petrol_code, ord_code, ptrl_code, ptrl_tank_code, itm_code, itm_unit_code, item_quantity, req_dt, ord_petrol_flag, ist_dt) 
                                                                                    values ('${ord_petrol_code}', '${ord_code}', '${ptrl_code}', '${ptrl_tank_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity},
                                                                                    '${req_dt}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                                                                                    let tbl_temporary4 = await pgConn.execute(dbPrefix + lic_code, script4, config.connectionString());
                                                                                    //debugger
                                                                                    if (!tbl_temporary4.code) {
                                                                                        console.log('sync shipments_code', transportOrderId, 'done.')
                                                                                    }
                                                                                }
                                                                            }

                                                                        }
                                                                    }
                                                                    else {
                                                                        var ord_depot_code = 'odpo-' + moment().format('x');

                                                                        if (dpo_code != '') {
                                                                            let script3 = `INSERT INTO public.tbl_order_depot 
                                                                                (ord_depot_code, ord_code, dpo_code, itm_code, itm_unit_code, item_quantity, ord_depot_flag, ist_dt) 
                                                                                values ('${ord_depot_code}', '${ord_code}', '${dpo_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                                                                                '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                                                                            let tbl_temporary3 = await pgConn.execute(dbPrefix + lic_code, script3, config.connectionString());
                                                                            //debugger;
                                                                            if (!tbl_temporary3.code) {
                                                                                //insert unloading information
                                                                                if (ptrl_code != '') {
                                                                                    var ord_petrol_code = 'optrl-' + moment().format('x');
                                                                                    let script4 = `INSERT INTO public.tbl_order_petrol 
                                                                                        (ord_petrol_code, ord_code, ptrl_code, ptrl_tank_code, itm_code, itm_unit_code, item_quantity, req_dt, ord_petrol_flag, ist_dt) 
                                                                                        values ('${ord_petrol_code}', '${ord_code}', '${ptrl_code}', '${ptrl_tank_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity},
                                                                                        '${req_dt}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                                                                                    let tbl_temporary4 = await pgConn.execute(dbPrefix + lic_code, script4, config.connectionString());
                                                                                    //debugger
                                                                                    if (!tbl_temporary4.code) {
                                                                                        console.log('sync shipments_code', transportOrderId, 'done.')
                                                                                    }
                                                                                }

                                                                            }
                                                                        }
                                                                        else {
                                                                            if (ptrl_code != '') {
                                                                                var ord_petrol_code = 'optrl-' + moment().format('x');
                                                                                let script4 = `INSERT INTO public.tbl_order_petrol 
                                                                                    (ord_petrol_code, ord_code, ptrl_code, ptrl_tank_code, itm_code, itm_unit_code, item_quantity, req_dt, ord_petrol_flag, ist_dt) 
                                                                                    values ('${ord_petrol_code}', '${ord_code}', '${ptrl_code}', '${ptrl_tank_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity},
                                                                                    '${req_dt}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                                                                                let tbl_temporary4 = await pgConn.execute(dbPrefix + lic_code, script4, config.connectionString());
                                                                                //debugger
                                                                                if (!tbl_temporary4.code) {
                                                                                    console.log('sync shipments_code', transportOrderId, 'done.')
                                                                                }
                                                                            }
                                                                        }

                                                                    }
                                                                }
                                                            }

                                                        }
                                                    }

                                                }
                                            }
                                        }

                                    }
                                    else {
                                        console.log(moment().format('YYYY-MM-DD HH:mm:ss'), 'Checked Order', transport.number, 'shipments is empty.');
                                    }
                                }
                            }
                            else {
                                console.log(moment().format('YYYY-MM-DD HH:mm:ss'), 'Checked Order', transport.number, 'is error.');
                            }

                            if (ord_code != undefined && ord_code != '') {
                                //debugger
                                let script5 = `update tbl_order 
                                    set item_count = (select count(itm_code) from tbl_order_item where ord_code = '${ord_code}' and ord_item_flag = '1'),
                                    item_quantity = (select sum(item_quantity) from tbl_order_item where ord_code = '${ord_code}' and ord_item_flag = '1'), 
                                    loading_count = (select count(distinct dpo_code) from tbl_order_depot where ord_code = '${ord_code}' and ord_depot_flag = '1'),
                                    unloading_count = (select count(distinct ptrl_code) from tbl_order_petrol where ord_code = '${ord_code}' and ord_petrol_flag = '1')
                                    where ord_code = '${ord_code}'`

                                let tbl_temporary5 = await pgConn.execute(dbPrefix + lic_code, script5, config.connectionString());
                                console.log('update order code ', ord_code, 'done.')
                            }
                        }

                    }
                }

            }
            else {
                xresult = false;
            }
        }

    } catch (err) {
        console.log(err);
        console.log(moment().format('YYYY-MM-DD HH:mm:ss'), 'Non-VMI-Order is error.');
        xresult = false;
    }
    finally {
        return xresult;
    }

}

exports.postJob2TmpWithShipment = async (lic_code, job_code, action) => {

    var xresult = false;

    try {

        var script1 = `select xjob.job_code, xjob.tms_transport_code, tbl_driver.dver_code, tbl_driver.dver_name, tbl_driver.dver_surname,
        tbl_vehicle.veh_number , tbl_vehicle.veh_type_code,tbl_vehicle.veh_license_number, tbl_vehicle.veh_license_province, 
        tbl_vehicle.veh_sub_license_number, tbl_vehicle.veh_sub_license_province, xjob.gsap_order_status, 
        xjob.gsap_order_type_code, case when xjob.gsap_shipments_number is null then '' else xjob.gsap_shipments_number end as gsap_shipments_number 
        from tbl_job xjob
        left join tbl_driver on xjob.dver_code = tbl_driver.dver_code 
        left join tbl_vehicle on xjob.veh_code = tbl_vehicle.veh_code 
        where xjob.job_code = '${job_code}' and xjob.job_flag = '1' and xjob.job_status = '2' `

        let tbl_temporary1 = await pgConn.get(dbPrefix + lic_code, script1, config.connectionString());

        if (!tbl_temporary1.code) {
            console.log('postJob2Tmp: job code', job_code);
            debugger
            if (tbl_temporary1.data.length > 0) {
                var xlicense_plate_truck = tbl_temporary1.data[0].veh_license_number.replace('-', '');
                var xlicense_plate_trailer = '';
                var xlicence_plate_second_trailer = '';
                var xtruck_id = tbl_temporary1.data[0].veh_number.replace('-', '');;
                var xvehicle_id = 'vehicleSingletruckNoTrailer';

                if (tbl_temporary1.data[0].veh_type_code == 'veht-1749028886915') {
                    xvehicle_id = 'vehicleTruckTrailerCombination';

                    if (tbl_temporary1.data[0].veh_sub_license_number != '') {
                        if (tbl_temporary1.data[0].veh_sub_license_number != 'N/A') {
                            xlicence_plate_second_trailer = tbl_temporary1.data[0].veh_sub_license_number.replace('-', '');
                            xlicense_plate_trailer = tbl_temporary1.data[0].veh_sub_license_number.replace('-', '');
                        }
                    }
                }
                else {
                    xlicense_plate_trailer = xlicense_plate_truck;
                    xlicence_plate_second_trailer = '';
                }

                //get order.
                //vehicleSingletruckNoTrailer
                //vehicleRigidTruckWithTrailer
                //vehicleTruckTrailerCombination

                var scriptx00 = `select ord_code, shipments_code, gsap_order_type_code, gsap_order_status, ord_type_code from 
                tbl_order where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') 
                and ord_flag = '1' and ord_type_code != 'otyp-9999999999996';`
                let tbl_temporaryx00 = await pgConn.get(dbPrefix + lic_code, scriptx00, config.connectionString());

                if (!tbl_temporaryx00.code) {
                    if (tbl_temporaryx00.data.length > 0) {
                        var xshipment = ``;
                        for (var x00 = 0; x00 <= tbl_temporaryx00.data.length - 1; x00++) {
                            var xitem = ''
                            var xshipments_code = '';
                            var xnumber = '';
                            var xgsap_order_status = '';
                            var xgsap_order_type_code = '';
                            var xgsap_shipments_number = ''
                            var ord_code = tbl_temporaryx00.data[x00].ord_code;

                            if (tbl_temporaryx00.data[x00].ord_type_code == 'otyp-9999999999999') {
                                xgsap_order_status = tbl_temporaryx00.data[x00].gsap_order_status;
                                xgsap_order_type_code = tbl_temporaryx00.data[x00].gsap_order_type_code;
                                xshipments_code = tbl_temporaryx00.data[x00].shipments_code;
                                xnumber = '454' + tbl_temporary1.data[0].tms_transport_code;
                                xgsap_shipments_number = tbl_temporary1.data[0].gsap_shipments_number;
                            }
                            else {
                                //454692
                                xgsap_order_status = '';
                                xgsap_order_type_code = '';
                                xgsap_shipments_number = '';
                                xshipments_code = '692' + tbl_temporaryx00.data[x00].shipments_code;
                                xnumber = '454' + tbl_temporary1.data[0].tms_transport_code;
                            }

                            //loading
                            //get loading
                            var scriptx01 = `select '${job_code}' as job_code, tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc, 
                            case when tbl_order_depot.dpo_address is null then tbl_depot.dpo_address else tbl_order_depot.dpo_address end as dpo_address,
                            case when tbl_order_depot.dpo_zip_code is null then tbl_depot.dpo_zip_code else tbl_order_depot.dpo_zip_code end as dpo_zip_code,
                            case when tbl_order_depot.dpo_country_code is null then tbl_depot.dpo_country_code else tbl_order_depot.dpo_country_code end as dpo_country_code,
                            case when tbl_order_depot.dpo_lat is null then tbl_depot.dpo_lat else tbl_order_depot.dpo_lat end as dpo_lat,
                            case when tbl_order_depot.dpo_lon is null then tbl_depot.dpo_lon else tbl_order_depot.dpo_lon end as dpo_lon,
                            case when tbl_order_depot.dpo_city is null then tbl_depot.dpo_city else tbl_order_depot.dpo_city end as dpo_city,
                            tbl_depot.dpo_loading_minute, tbl_depot.ist_dt, tbl_depot.mdf_dt, tbl_depot.rm_dt, tbl_order_depot.loading_start_dt, tbl_order_depot.loading_end_dt
                            from tbl_order
                            left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code
                            left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code
                            where tbl_order.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and tbl_order.ord_flag = '1' and tbl_order_depot.ord_depot_flag = '1'

                            group by tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc, 
                            tbl_depot.dpo_address,tbl_depot.dpo_zip_code, tbl_depot.dpo_country_code, tbl_depot.dpo_lat, tbl_depot.dpo_lon, 
                            tbl_order_depot.dpo_address,tbl_order_depot.dpo_zip_code, tbl_order_depot.dpo_country_code, tbl_order_depot.dpo_lat, tbl_order_depot.dpo_lon, 
                            tbl_depot.dpo_loading_minute, tbl_depot.ist_dt, tbl_depot.mdf_dt, tbl_order_depot.dpo_city, tbl_depot.dpo_city, 
                            tbl_depot.rm_dt, tbl_order_depot.loading_start_dt, tbl_order_depot.loading_end_dt order by tbl_order_depot.loading_start_dt asc
                            limit 1`;

                            let tbl_temporaryx01 = await pgConn.get(dbPrefix + lic_code, scriptx01, config.connectionString());

                            var xlcompany_name = '';
                            var xladdress = '';
                            var xlzip = '';
                            var xlcity = '';
                            var xlloading_name = '';
                            var xlstart = '';
                            var xlend = '';
                            var xloading = ``;

                            if (!tbl_temporaryx01.code) {
                                if (tbl_temporaryx01.data.length > 0) {
                                    xlcompany_name = tbl_temporaryx01.data[0].dpo_desc;
                                    xladdress = tbl_temporaryx01.data[0].dpo_address;
                                    xlzip = tbl_temporaryx01.data[0].dpo_zip_code;
                                    xlcity = tbl_temporaryx01.data[0].dpo_city;
                                    xlloading_name = tbl_temporaryx01.data[0].dpo_number;
                                    xlstart = moment(tbl_temporaryx01.data[0].loading_start_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');
                                    xlend = moment(tbl_temporaryx01.data[0].loading_end_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');

                                    xloading = `<station type="loading">
                                    <company_name>${xlcompany_name}</company_name>
                                    <address>${xladdress}</address>
                                    <zip>${xlzip}</zip>
                                    <city>${xlcity}</city>
                                    <country_id>TH</country_id>
                                    <loading_name>${xlloading_name}</loading_name>
                                    <date_time_period>
                                        <start>${xlstart}</start>
                                        <end>${xlend}</end>
                                        <timezone>Asia/Bangkok</timezone>
                                    </date_time_period>
                                    <comment></comment>
                                    </station>`
                                }
                            }
                            else {
                                console.log(job_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP (Get depot)');
                                return false;
                            }

                            var scriptx02 = `
                            select '${job_code}' as job_code, tbl_order_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc, 
                            case when tbl_order_petrol.ptrl_address is null then tbl_petrol.ptrl_address else tbl_order_petrol.ptrl_address end as ptrl_address,
                            case when tbl_order_petrol.ptrl_zip_code is null then tbl_petrol.ptrl_zip_code else tbl_order_petrol.ptrl_zip_code end as ptrl_zip_code,
                            case when tbl_order_petrol.ptrl_country_code is null then tbl_petrol.ptrl_country_code else tbl_order_petrol.ptrl_country_code end as ptrl_country_code,
                            case when tbl_order_petrol.ptrl_lat is null then tbl_petrol.ptrl_lat else tbl_order_petrol.ptrl_lat end as ptrl_lat,
                            case when tbl_order_petrol.ptrl_lon is null then tbl_petrol.ptrl_lon else tbl_order_petrol.ptrl_lon end as ptrl_lon,
                            case when tbl_order_petrol.ptrl_city is null then tbl_petrol.ptrl_city else tbl_order_petrol.ptrl_city end as ptrl_city,
                            tbl_petrol.ptrl_unloading_minute, tbl_petrol.ist_dt, tbl_petrol.mdf_dt, tbl_petrol.rm_dt, min(tbl_order_petrol.unloading_start_dt) as unloading_start_dt, 
                            max(tbl_order_petrol.unloading_end_dt) as unloading_end_dt
                            from tbl_order
                            left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
                            left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
                            where tbl_order.ord_code = '${ord_code}' and tbl_order.ord_flag = '1' and tbl_order_petrol.ord_petrol_flag = '1'

                            group by tbl_order_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc, 
                            tbl_petrol.ptrl_address,tbl_petrol.ptrl_zip_code, tbl_petrol.ptrl_country_code, tbl_petrol.ptrl_lat, tbl_petrol.ptrl_lon, 
                            tbl_order_petrol.ptrl_address,tbl_order_petrol.ptrl_zip_code, tbl_order_petrol.ptrl_country_code, tbl_order_petrol.ptrl_lat, tbl_order_petrol.ptrl_lon, 
                            tbl_petrol.ptrl_unloading_minute, tbl_petrol.ist_dt, tbl_petrol.mdf_dt, tbl_order_petrol.ptrl_city, tbl_petrol.ptrl_city, 
                            tbl_petrol.rm_dt, tbl_order_petrol.unloading_start_dt, tbl_order_petrol.unloading_end_dt
                            order by tbl_order_petrol.unloading_start_dt asc `;

                            let tbl_temporaryx02 = await pgConn.get(dbPrefix + lic_code, scriptx02, config.connectionString());

                            //unloading
                            var xuncompany_name = '';
                            var xunaddress = '';
                            var xunzip = '';
                            var xuncity = '';
                            var xunloading_name = '';
                            var xunstart = '';
                            var xunend = '';
                            var xunloading = ``;
                            debugger

                            if (!tbl_temporaryx02.code) {
                                if (tbl_temporaryx02.data.length > 0) {
                                    xuncompany_name = tbl_temporaryx02.data[0].ptrl_desc;
                                    xunaddress = tbl_temporaryx02.data[0].ptrl_address;
                                    xunzip = tbl_temporaryx02.data[0].ptrl_zip_code;
                                    xuncity = tbl_temporaryx02.data[0].ptrl_city;
                                    xunloading_name = tbl_temporaryx02.data[0].ptrl_number;
                                    xunstart = moment(tbl_temporaryx02.data[0].unloading_start_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');
                                    xunend = moment(tbl_temporaryx02.data[0].unloading_end_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');

                                    xunloading = `<station type="unloading">
                                    <company_name>${xuncompany_name}</company_name>
                                    <address>${xunaddress}</address>
                                    <zip>${xunzip}</zip>
                                    <city>${xuncity}</city>
                                    <country_id>TH</country_id>
                                    <loading_name>${xunloading_name}</loading_name>
                                    <date_time_period>
                                        <start>${xunstart}</start>
                                        <end>${xunend}</end>
                                        <timezone>Asia/Bangkok</timezone>
                                    </date_time_period>
                                    <comment></comment>
                                    </station>`
                                }
                                else {
                                    console.log(job_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP (Get depot)');
                                    xresult = false;
                                }
                            }
                            else {
                                console.log(job_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP (Get depot)');
                                xresult = false;
                            }

                            var scriptx03 = `select tbl_order_item.itm_code,
                            case when tbl_order_item.pos_number is null then '' else tbl_order_item.pos_number end as pos_number,
                            case when tbl_order_item.itm_desc is null then tbl_item.itm_desc else tbl_order_item.itm_desc end as itm_desc, 
                            case when tbl_order_item.itm_short_desc is null then tbl_item.itm_short_desc else tbl_order_item.itm_short_desc end as itm_short_desc, 
                            tbl_order_item.itm_unit_code,tbl_item.itm_material_number,
                            tbl_order_compartment.veh_compartment_code, tbl_vehicle_compartment.veh_compartment_number,
                            (select sum(xcompartment.item_quantity) from tbl_order_compartment xcompartment
                            where xcompartment.ord_code = '${ord_code}' and xcompartment.itm_code = tbl_order_item.itm_code and xcompartment.veh_compartment_code = tbl_order_compartment.veh_compartment_code) as item_quantity, 
                            tbl_order_compartment.ptrl_tank_code 

                            from tbl_order
                            left join tbl_order_item on tbl_order.ord_code = tbl_order_item.ord_code 
                            and tbl_order_item.ord_item_flag = '1'
                            left join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
                            and tbl_item.itm_flag = '1'
                            left join tbl_order_compartment on tbl_order_item.itm_code = tbl_order_compartment.itm_code
                            and tbl_order_compartment.ord_code = tbl_order.ord_code 
                            and tbl_order_compartment.ord_veh_compartment_flag = '1'

                            left join tbl_vehicle_compartment  
                            on tbl_order_compartment.veh_compartment_code = tbl_vehicle_compartment.veh_compartment_code
                            and tbl_vehicle_compartment.veh_compartment_flag = '1'

                            where tbl_order_item.ord_code = '${ord_code}'
                            and tbl_order_item.ord_item_flag = '1'

                            group by tbl_order_item.itm_code, pos_number, tbl_order_item.itm_desc, tbl_order_item.itm_short_desc, 
                            tbl_item.itm_desc, tbl_item.itm_short_desc, tbl_order_item.itm_unit_code, tbl_order_compartment.item_quantity,
                            tbl_item.itm_material_number, tbl_order_compartment.veh_compartment_code, tbl_vehicle_compartment.veh_compartment_number, tbl_order_compartment.ptrl_tank_code 
                            order by tbl_order_item.itm_code asc;`

                            let tbl_temporaryx03 = await pgConn.get(dbPrefix + lic_code, scriptx03, config.connectionString());

                            if (!tbl_temporaryx03.code) {
                                if (tbl_temporaryx03.data.length > 0) {
                                    var xtankuse = [];
                                    var xtank_number = ``;
                                    for (var itm = 0; itm <= tbl_temporaryx03.data.length - 1; itm++) {
                                        var xtemplate_id = tbl_temporaryx03.data[itm].itm_material_number;
                                        var xpos_number = tbl_temporaryx03.data[itm].pos_number;
                                        var xpos_index = itm + 1;

                                        if (xpos_index.length == 1) {
                                            xpos_index = '0' + xpos_index;
                                        }

                                        if (xpos_number == '') {
                                            try {
                                                xpos_number = '0000' + ((itm + 1) * 10)
                                            }
                                            catch (ex) {
                                                xpos_number = '000001';
                                            }
                                        }

                                        var xshort_description = tbl_temporaryx03.data[itm].itm_desc;
                                        var xdescription = tbl_temporaryx03.data[itm].itm_desc;
                                        var xmaterial_number = tbl_temporaryx03.data[itm].itm_material_number;
                                        var xquantity = tbl_temporaryx03.data[itm].item_quantity;
                                        var xcompartment_number = tbl_temporaryx03.data[itm].veh_compartment_number

                                        var scriptx04 = ``;
                                        // scriptx04 = `select tbl_order_petrol.ptrl_tank_code, tbl_petrol_tank.tnk_number from tbl_order_petrol 
                                        //     left join tbl_petrol_tank on tbl_order_petrol.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
                                        //     where tbl_order_petrol.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and tbl_petrol_tank.ptrl_tank_code = '${tbl_temporaryx03.data[itm].ptrl_tank_code}' 
                                        //     and tbl_petrol_tank.ptrl_tank_flag = '1' 
                                        //     order by tbl_petrol_tank.tnk_number asc`
                                        scriptx04 = `select tbl_petrol_tank.ptrl_tank_code, tbl_petrol_tank.tnk_number, ptrl_tank_flag from tbl_petrol_tank 
                                        where tbl_petrol_tank.ptrl_tank_code = '${tbl_temporaryx03.data[itm].ptrl_tank_code}';`

                                        let tbl_temporaryx04 = await pgConn.get(dbPrefix + lic_code, scriptx04, config.connectionString());
                                        if (!tbl_temporaryx04.code) {
                                            if (tbl_temporaryx04.data.length > 0) {
                                                console.log(tbl_temporaryx04.data[0].tnk_number);
                                                console.log(tbl_temporaryx04.data[0].ptrl_tank_code);
                                                console.log(xtankuse);
                                                xtank_number = tbl_temporaryx04.data[0].tnk_number;
                                                xtankuse.push(tbl_temporaryx04.data[0].ptrl_tank_code)
                                            }
                                            else {
                                                console.log('tbl_temporaryx04 length = 0 -7');
                                                console.log(job_code, 'ไม่พบข้อมูล Job เพื่อส่งไปยัง TMP');
                                                xresult = false;
                                                return xresult;
                                            }
                                        }
                                        else {
                                            console.log('tbl_temporaryx04 is error.');
                                        }

                                        xitem += `<item>
                                            <template_id>${xtemplate_id}</template_id>
                                            <pos_number>${xpos_number}</pos_number>
                                            <pos_index>${xpos_index}</pos_index>
                                            <description>${xdescription}</description>
                                            <short_description>${xshort_description}</short_description>
                                            <material_number>${xmaterial_number}</material_number>
                                            <quantities>
                                                <quantity>
                                                    <qualifier>dimension.volume</qualifier>
                                                    <unit>l</unit>
                                                    <value>${xquantity}</value>
                                                </quantity>
                                            </quantities>
                                            <parameters>
                                                <parameter>
                                                    <qualifier>bol</qualifier>
                                                </parameter>
                                                <parameter>
                                                    <qualifier>tank.number</qualifier>
                                                    <value>T${xtank_number}</value>
                                                </parameter>
                                                <parameter>
                                                    <qualifier>compartment.number</qualifier>
                                                    <value>${xcompartment_number}</value>
                                                </parameter>
                                                <parameter>
                                                    <qualifier>depot</qualifier>
                                                    <!-- Filled in case of multipickup scenario, otherwise empty -->
                                                    <value>${xlloading_name}</value>
                                                </parameter>
                                                <parameter>
                                                    <qualifier>trailer_plate_number</qualifier>
                                                    <value>${xlicense_plate_trailer}</value>
                                                </parameter>
                                            </parameters>
                                        </item>`

                                        if (itm == tbl_temporaryx03.data.length - 1) {
                                            //create shipment
                                            xshipment += `<shipment>
                                            <number>${xshipments_code}</number>
                                            <shipper_id>454692</shipper_id>
                                            <plant>TH Pongrawe CO LTD</plant>
                                            <vehicle_id>${xvehicle_id}</vehicle_id>
                                            <parameter>
                                                <qualifier>gsap_order_number</qualifier>
                                                <value></value>
                                            </parameter>
                                            <comment></comment>
                                            ${xloading}
                                            ${xunloading}
                                            <items>${xitem}</items>
                                            <parameters>
                                                <parameter>
                                                    <qualifier>gsap_order_number</qualifier>
                                                    <value></value>
                                                </parameter>
                                                <parameter>
                                                    <qualifier>gsap_status</qualifier>
                                                    <value>${xgsap_order_status}</value>
                                                </parameter>
                                                <parameter>
                                                    <qualifier>order_type</qualifier>
                                                    <value>${xgsap_order_type_code}</value>
                                                </parameter>
                                            </parameters>
                                        </shipment>`
                                        }
                                    }
                                }
                                else {
                                    console.log(job_code, 'ไม่พบข้อมูล Job เพื่อส่งไปยัง TMP');
                                    xresult = false;
                                }
                            }
                            else {
                                console.log(job_code, 'ไม่พบข้อมูล Job เพื่อส่งไปยัง TMP');
                                xresult = false;
                            }

                            if (x00 == tbl_temporaryx00.data.length - 1) {
                                if (xshipment != '') {
                                    var xdata = `<transport>
                                    <number>${xnumber}</number>
                                    <shipper_id>454692</shipper_id>
                                    <plant>TH Pongrawe CO LTD</plant>
                                    <vehicle_id>${xvehicle_id}</vehicle_id>
                                    <license_plate_truck>${xlicense_plate_truck}</license_plate_truck>
                                    <license_plate_trailer>${xlicence_plate_second_trailer}</license_plate_trailer>
                                    <comment>-</comment>
                                    <shipments>
                                        ${xshipment}
                                    </shipments>
                                    <parameters>
                                        <parameter>
                                            <qualifier>gsap_shipment_number</qualifier>
                                            <value>${xgsap_shipments_number}</value>
                                        </parameter>
                                        <parameter>
                                            <qualifier>fuel_type</qualifier>
                                            <value>Diesel</value>
                                        </parameter>
                                        <parameter>
                                            <qualifier>is_discharged</qualifier>
                                            <value>false</value>
                                        </parameter>
                                        <parameter>
                                            <qualifier>is_redirect</qualifier>
                                            <value>false</value>
                                        </parameter>
                                        <parameter>
                                            <qualifier>truck_id</qualifier>
                                            <value>${xtruck_id}</value>
                                        </parameter>
                                        <parameter>
                                            <qualifier>licence_plate_second_trailer</qualifier>
                                            <value></value>
                                        </parameter>
                                    </parameters>
                                    </transport>`

                                    console.log('xproduction', xproduction);
                                    // console.log(xdata);
                                    if (xproduction && lic_code == 'prw02') {
                                        debugger
                                        let xconfig = {
                                            method: 'post',
                                            maxBodyLength: Infinity,
                                            url: 'xxxxx',
                                            headers: {
                                                'Content-Type': 'application/xml',
                                                'Authorization': 'Basic SW50ZXJmYWNlQDYyNDc0NTpXc0A2NTQzMjE='
                                            },
                                            data: xdata
                                        };

                                        console.log(xconfig.url);
                                        await axios.request(xconfig)
                                            .then(async (response) => {
                                                console.log(JSON.stringify(response.data));
                                                if (response.data.success == true) {
                                                    console.log(job_code, 'postJob2TmpWithShipment TMP Complete');
                                                    await this.action_logs(
                                                        lic_code,
                                                        action[0].id,
                                                        job_code + "postJob2TmpWithShipment true",
                                                        xdata,
                                                        "success",
                                                        action[0].value,
                                                    );
                                                    xresult = true;
                                                }
                                                else {
                                                    console.log(job_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP, TMP Reject');
                                                    var scriptx04 = `update tbl_job set transporeon_status = 'D', job_comment = 'ข้อมูลไม่ถูกต้อง ตรวจสอบชื่ออักขระพิเศษ' where job_code = '${job_code}'`
                                                    await this.action_logs(
                                                        lic_code,
                                                        action[0].id,
                                                        job_code + "postJob2TmpWithShipment true",
                                                        xdata,
                                                        "success",
                                                        action[0].value,
                                                    );
                                                    xresult = false;
                                                }
                                            })
                                            .catch(async (error) => {
                                                console.log(error);
                                                console.log(job_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP');

                                                var scriptx04 = `update tbl_job set transporeon_status = 'D', job_comment = 'ข้อมูลไม่ถูกต้อง ตรวจสอบชื่ออักขระพิเศษ' where job_code = '${job_code}'`
                                                let tbl_temporaryx04 = await pgConn.execute(dbPrefix + lic_code, scriptx04, config.connectionString());
                                                xresult = false;
                                            });
                                    }
                                    else {
                                        xresult = true;
                                    }
                                }
                                else {
                                    console.log(job_code, 'ไม่พบข้อมูล Job เพื่อส่งไปยัง TMP');
                                    xresult = false;
                                }
                            }
                        }

                    }
                    else {
                        console.log(job_code, 'ไม่พบข้อมูล Job เพื่อส่งไปยัง TMP');
                        xresult = false;
                    }
                }
                else {
                    console.log(job_code, 'ไม่พบข้อมูล Job เพื่อส่งไปยัง TMP');
                    xresult = false;
                }
            }
            else {
                console.log(job_code, 'ไม่พบข้อมูล Job เพื่อส่งไปยัง TMP');
                xresult = false;
            }
        }
        else {
            console.log(job_code, 'ไม่สามารถดึงข้อมูลเพื่อส่งไปยัง TMP');
            xresult = false;
        }

    } catch (err) {
        console.log(err);
        xresult = false;
    }
    finally {
        return xresult;
    }

}

exports.deleteJob2TmpWithShipment = async (lic_code, job_code) => {

    try {

        var script1 = `select tms_transport_code FROM tbl_job 
        where job_code = '${job_code}' and job_flag = '1' and tms_transport_code is not null and tms_transport_code != '' `

        let tbl_temporary1 = await pgConn.get(dbPrefix + lic_code, script1, config.connectionString());

        if (!tbl_temporary1.code) {
            console.log('postAcceptJob2Tmp: Job number', job_code);
            debugger
            if (tbl_temporary1.data.length > 0) {
                var tms_transport_code = '454' + tbl_temporary1.data[0].tms_transport_code;
                debugger
                console.log('xproduction', xproduction);
                console.log(`xxxxx/454692/${tms_transport_code}`)

                if (xproduction && lic_code == 'prw02') {
                    let xconfig = {
                        method: 'delete',
                        maxBodyLength: Infinity,
                        url: `xxxxx/454692/${tms_transport_code}`,
                        headers: {
                            'Content-Type': 'application/xml',
                            'Authorization': 'Basic SW50ZXJmYWNlQDYyNDc0NTpXc0A2NTQzMjE='
                        }
                    };

                    console.log(xconfig.url);
                    await axios.request(xconfig)
                        .then((response) => {
                            console.log(JSON.stringify(response.data));
                            if (response.data.success == true) {
                                console.log(job_code, 'Delete TMP Complete');
                                return true;
                            }
                            else {
                                console.log(job_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP, Delete TMP Reject');
                                return false;
                            }

                        })
                        .catch((error) => {
                            console.log(error);
                            console.log(job_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP');
                            return false;
                        });
                }
                else {
                    return true;
                }
            }
            else {
                console.log(job_code, 'ไม่พบข้อมูล Transport code เพื่อส่งไปยัง TMP');
                return false;
            }
        }
        else {
            console.log(job_code, 'ไม่สามารถดึงข้อมูลเพื่อส่งไปยัง TMP');
            return false;
        }

    } catch (err) {
        console.log(err);
        return false;
    }

}

exports.postAcceptJob2Tmp = async (lic_code, job_code) => {

    var xresult = false;

    try {

        var script1 = `select transport_code FROM tbl_job 
        where job_code = '${job_code}' and job_flag = '1' and transport_code is not null and transport_code != '' `

        let tbl_temporary1 = await pgConn.get(dbPrefix + lic_code, script1, config.connectionString());

        if (!tbl_temporary1.code) {
            console.log('postAcceptJob2Tmp: Job number', job_code);
            debugger
            if (tbl_temporary1.data.length > 0) {
                var transport_code = tbl_temporary1.data[0].transport_code;

                var xdata = `<?xml version="1.0" encoding="UTF-8"?>
                <nto_accept_transport>
                    <scheduler_email>amnart_pg@dtc.co.th</scheduler_email>
                    <transport_id>${transport_code}</transport_id>
                </nto_accept_transport>`

                debugger
                console.log('xproduction', xproduction);
                console.log(xdata);
                if (xproduction && lic_code == 'prw02') {
                    let xconfig = {
                        method: 'post',
                        maxBodyLength: Infinity,
                        url: 'xxxxx',
                        headers: {
                            'Content-Type': 'application/xml',
                            'Authorization': 'Basic SW50ZXJmYWNlQDYyNDc0NTpXc0A2NTQzMjE='
                        },
                        data: xdata
                    };

                    console.log(xconfig.url);
                    await axios.request(xconfig)
                        .then((response) => {
                            console.log(JSON.stringify(response.data));
                            if (response.data.success == true) {
                                console.log(job_code, 'Accept TMP Complete');
                                xresult = true;
                            }
                            else {
                                console.log(job_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP, Accept TMP Reject');
                                xresult = false;
                            }

                        })
                        .catch((error) => {
                            console.log(error);
                            console.log(job_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP');
                            xresult = false;
                        });
                }
                else {
                    xresult = true;
                }
            }
            else {
                console.log(job_code, 'ไม่พบข้อมูล Transport code เพื่อส่งไปยัง TMP');
                xresult = false;
            }
        }
        else {
            console.log(job_code, 'ไม่สามารถดึงข้อมูลเพื่อส่งไปยัง TMP');
            xresult = false;
        }

    } catch (err) {
        console.log(err);
        xresult = false;
    }
    finally {
        return xresult;
    }

}

exports.postDeclineJob2Tmp = async (lic_code, job_code) => {

    try {

        var script1 = `select transport_code FROM tbl_job 
        where job_code = '${job_code}' and job_flag = '1' and transport_code is not null and transport_code != '' `

        let tbl_temporary1 = await pgConn.get(dbPrefix + lic_code, script1, config.connectionString());

        if (!tbl_temporary1.code) {
            console.log('postDeclineJob2Tmp: Job number', job_code);
            debugger
            if (tbl_temporary1.data.length > 0) {
                var transport_code = tbl_temporary1.data[0].transport_code;

                var xdata = `<?xml version="1.0" encoding="UTF-8"?>
                <nto_accept_transport>
                    <scheduler_email>amnart_pg@dtc.co.th</scheduler_email>
                    <transport_id>${transport_code}</transport_id>
                </nto_accept_transport>`

                debugger
                console.log('xproduction', xproduction);
                console.log(xdata);
                if (xproduction && lic_code == 'prw02') {
                    let xconfig = {
                        method: 'post',
                        maxBodyLength: Infinity,
                        url: 'xxxx',
                        headers: {
                            'Content-Type': 'application/xml',
                            'Authorization': 'Basic SW50ZXJmYWNlQDYyNDc0NTpXc0A2NTQzMjE='
                        },
                        data: xdata
                    };

                    console.log(xconfig.url);
                    await axios.request(xconfig)
                        .then((response) => {
                            console.log(JSON.stringify(response.data));
                            if (response.data.success == true) {
                                console.log(job_code, 'Decline TMP Complete');
                                return true;
                            }
                            else {
                                console.log(job_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP, Decline TMP Reject');
                                return false;
                            }

                        })
                        .catch((error) => {
                            console.log(error);
                            console.log(job_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP');
                            return false;
                        });
                }
                else {
                    return true;
                }
            }
            else {
                console.log(job_code, 'ไม่พบข้อมูล Transport code เพื่อส่งไปยัง TMP');
                return false;
            }
        }
        else {
            console.log(job_code, 'ไม่สามารถดึงข้อมูลเพื่อส่งไปยัง TMP');
            return false;
        }

    } catch (err) {
        console.log(err);
        return false;
    }

}

exports.postBeforeCloseDischargedJob2Tmp = async (lic_code, job_code) => {

    try {

        var script1 = `select xjob.job_code, xjob.tms_transport_code, tbl_driver.dver_code, tbl_driver.dver_name, tbl_driver.dver_surname,
        tbl_vehicle.veh_number , tbl_vehicle.veh_type_code,case when tbl_vehicle.veh_license_number is null then '' 
        else tbl_vehicle.veh_license_number end as veh_license_number, tbl_vehicle.veh_license_province, 
        tbl_vehicle.veh_sub_license_number, tbl_vehicle.veh_sub_license_province, xjob.gsap_order_status, xjob.gsap_order_type_code,
        case when xjob.gsap_shipments_number is null then '' else xjob.gsap_shipments_number end as gsap_shipments_number    
        from tbl_job xjob
        left join tbl_driver on xjob.dver_code = tbl_driver.dver_code 
        left join tbl_vehicle on xjob.veh_code = tbl_vehicle.veh_code 
        where xjob.job_code = '${job_code}' and xjob.job_flag = '1' and xjob.job_status = '4' `
        let tbl_temporary1 = await pgConn.get(dbPrefix + lic_code, script1, config.connectionString());

        if (!tbl_temporary1.code) {
            if (tbl_temporary1.data.length > 0) {

                //make shipment for redirect.
                var xredirect = false;
                script1 = `select distinct(tbl_order_close.ord_code) as ord_code from tbl_order_close 
                where tbl_order_close.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') 
                and tbl_order_close.delivery_flag in ('2','3')`
                let tbl_temporary1x1 = await pgConn.get(dbPrefix + lic_code, script1, config.connectionString());

                if (!tbl_temporary1x1.code) {
                    if (tbl_temporary1x1.data.length > 0) {
                        xredirect = true
                        console.log('xredirect set to true', xredirect);
                    }
                }

                var script2 = `select distinct(tbl_order_close.ptrl_code) as ptrl_code from tbl_order_close 
                where tbl_order_close.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') 

                union

                select distinct(tbl_petrol_tank.ptrl_code) as ptrl_code 
                from tbl_order_compartment 
                inner join tbl_petrol_tank on tbl_order_compartment.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
                where tbl_order_compartment.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') 
                group by ptrl_code `
                let tbl_temporary2 = await pgConn.get(dbPrefix + lic_code, script2, config.connectionString());

                if (!tbl_temporary2.code) {
                    if (tbl_temporary2.data.length > 0) {
                        var rshipment = ``;
                        for (var r00 = 0; r00 <= tbl_temporary2.data.length - 1; r00++) {
                            var xcreate_order = false;
                            var scriptx00 = `select tbl_order.ord_code, shipments_code, gsap_order_type_code, gsap_order_status, ord_type_code, 
                                    case when tbl_order.gsap_order_number is null then '' else tbl_order.gsap_order_number end as gsap_order_number,
                                    case when tbl_order.gsap_shipments_number is null then '' else tbl_order.gsap_shipments_number end as gsap_shipments_number
                                    from tbl_order left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
                                    where tbl_order.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') 
                                    and tbl_order_petrol.ptrl_code = '${tbl_temporary2.data[r00].ptrl_code}'
                                    and ord_flag = '1' limit 1;`

                            let tbl_temporaryx00 = await pgConn.get(dbPrefix + lic_code, scriptx00, config.connectionString());

                            if (!tbl_temporaryx00.code) {
                                if (tbl_temporaryx00.data.length == 0) {
                                    scriptx00 = `select ptrl_code, ord_code from tbl_order_close 
                                    where tbl_order_close.ord_code 
                                    in (select ord_code from tbl_job_order where job_code = '${job_code}') 
                                    and ptrl_code = '${tbl_temporary2.data[r00].ptrl_code}' and tbl_order_close.delivery_flag = '2' limit 1`

                                    let tbl_temporaryx00xx23 = await pgConn.get(dbPrefix + lic_code, scriptx00, config.connectionString());
                                    if (!tbl_temporaryx00xx23.code) {
                                        if (tbl_temporaryx00xx23.data.length > 0) {
                                            //สร้าง order ใหม่สวมงานเดิม
                                            xcreate_order = true
                                            var scriptx00 = `select tbl_order.ord_code, shipments_code, gsap_order_type_code, gsap_order_status, ord_type_code, 
                                            case when tbl_order.gsap_order_number is null then '' else tbl_order.gsap_order_number end as gsap_order_number,
                                            case when tbl_order.gsap_shipments_number is null then '' else tbl_order.gsap_shipments_number end as gsap_shipments_number
                                            from tbl_order left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
                                            where tbl_order.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') 
                                            and tbl_order_petrol.ord_code = '${tbl_temporaryx00xx23.data[0].ord_code}'
                                            and ord_flag = '1' limit 1;`

                                            tbl_temporaryx00 = await pgConn.get(dbPrefix + lic_code, scriptx00, config.connectionString());
                                            if (!tbl_temporaryx00.code) {
                                                if (tbl_temporaryx00.data.length == 0) {
                                                    console.log(job_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP (Get petrol (Special))');
                                                    return '';
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            else {
                                console.log(job_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP (Get petrol)');
                                return '';
                            }

                            for (var x00 = 0; x00 <= tbl_temporaryx00.data.length - 1; x00++) {
                                var xitem = ''
                                var xshipments_code = '';
                                var xnumber = '';
                                var xgsap_order_status = '';
                                var xgsap_order_type_code = '';
                                var ord_code = tbl_temporaryx00.data[x00].ord_code;
                                var xgsap_order_status = tbl_temporaryx00.data[x00].gsap_order_status;
                                var xgsap_order_number = tbl_temporaryx00.data[x00].gsap_order_number;
                                var xgsap_order_type_code = tbl_temporaryx00.data[x00].gsap_order_type_code;
                                var xgsap_shipments_number = tbl_temporary1.data[0].gsap_shipments_number;
                                var xlicense_plate_truck = tbl_temporary1.data[0].veh_license_number.replace('-', '');
                                var xlicense_plate_trailer = '';
                                var xlicence_plate_second_trailer = '';
                                var xtruck_id = tbl_temporary1.data[0].veh_number.replace('-', '');;
                                var xvehicle_id = 'vehicleSingletruckNoTrailer';

                                if (tbl_temporary1.data[0].veh_type_code == 'veht-1749028886915') {
                                    xvehicle_id = 'vehicleTruckTrailerCombination';

                                    if (tbl_temporary1.data[0].veh_sub_license_number != '') {
                                        if (tbl_temporary1.data[0].veh_sub_license_number != 'N/A') {
                                            xlicence_plate_second_trailer = tbl_temporary1.data[0].veh_sub_license_number.replace('-', '');
                                            xlicense_plate_trailer = tbl_temporary1.data[0].veh_sub_license_number.replace('-', '');
                                        }
                                    }
                                }
                                else {
                                    xlicense_plate_trailer = xlicense_plate_truck;
                                    xlicence_plate_second_trailer = '';
                                }

                                if (tbl_temporaryx00.data[x00].ord_type_code == 'otyp-9999999999999') {
                                    xgsap_order_status = tbl_temporaryx00.data[x00].gsap_order_status;
                                    xgsap_order_type_code = tbl_temporaryx00.data[x00].gsap_order_type_code;
                                    xshipments_code = tbl_temporaryx00.data[x00].shipments_code;
                                    xnumber = '454' + tbl_temporary1.data[0].tms_transport_code;
                                    // xgsap_order_number = '';
                                }
                                else {
                                    //454692
                                    // xgsap_order_number = '';
                                    xgsap_order_status = '';
                                    xgsap_order_type_code = '';
                                    if (xcreate_order == true) {
                                        xshipments_code = '693' + tbl_temporaryx00.data[x00].shipments_code;
                                    }
                                    else {
                                        xshipments_code = '692' + tbl_temporaryx00.data[x00].shipments_code;
                                    }

                                    xnumber = '454' + tbl_temporary1.data[0].tms_transport_code;
                                }

                                //loading
                                //get loading
                                var scriptx01 = `select '${job_code}' as job_code, tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc, 
                                case when tbl_order_depot.dpo_address is null then tbl_depot.dpo_address else tbl_order_depot.dpo_address end as dpo_address,
                                case when tbl_order_depot.dpo_zip_code is null then tbl_depot.dpo_zip_code else tbl_order_depot.dpo_zip_code end as dpo_zip_code,
                                case when tbl_order_depot.dpo_country_code is null then tbl_depot.dpo_country_code else tbl_order_depot.dpo_country_code end as dpo_country_code,
                                case when tbl_order_depot.dpo_lat is null then tbl_depot.dpo_lat else tbl_order_depot.dpo_lat end as dpo_lat,
                                case when tbl_order_depot.dpo_lon is null then tbl_depot.dpo_lon else tbl_order_depot.dpo_lon end as dpo_lon,
                                case when tbl_order_depot.dpo_city is null then tbl_depot.dpo_city else tbl_order_depot.dpo_city end as dpo_city,
                                tbl_depot.dpo_loading_minute, tbl_depot.ist_dt, tbl_depot.mdf_dt, tbl_depot.rm_dt, tbl_order_depot.loading_start_dt, tbl_order_depot.loading_end_dt
                                from tbl_order
                                left join tbl_job_order on tbl_order.ord_code = tbl_job_order.ord_code
                                left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code
                                left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code
                                where tbl_job_order.job_code = '${job_code}' and tbl_order.ord_flag = '1' and tbl_order_depot.ord_depot_flag = '1'
                                group by tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc, 
                                tbl_depot.dpo_address,tbl_depot.dpo_zip_code, tbl_depot.dpo_country_code, tbl_depot.dpo_lat, tbl_depot.dpo_lon, 
                                tbl_order_depot.dpo_address,tbl_order_depot.dpo_zip_code, tbl_order_depot.dpo_country_code, tbl_order_depot.dpo_lat, tbl_order_depot.dpo_lon, 
                                tbl_depot.dpo_loading_minute, tbl_depot.ist_dt, tbl_depot.mdf_dt, tbl_order_depot.dpo_city, tbl_depot.dpo_city, 
                                tbl_depot.rm_dt, tbl_order_depot.loading_start_dt, tbl_order_depot.loading_end_dt order by tbl_order_depot.loading_start_dt asc
                                limit 1 `;

                                let tbl_temporaryx01 = await pgConn.get(dbPrefix + lic_code, scriptx01, config.connectionString());
                                var xlcompany_name = '';
                                var xladdress = '';
                                var xlzip = '';
                                var xlcity = '';
                                var xlloading_name = '';
                                var xlstart = '';
                                var xlend = '';
                                var xloading = ``;

                                if (!tbl_temporaryx01.code) {
                                    if (tbl_temporaryx01.data.length > 0) {
                                        xlcompany_name = tbl_temporaryx01.data[0].dpo_desc;
                                        xladdress = tbl_temporaryx01.data[0].dpo_address;
                                        xlzip = tbl_temporaryx01.data[0].dpo_zip_code;
                                        xlcity = tbl_temporaryx01.data[0].dpo_city;
                                        xlloading_name = tbl_temporaryx01.data[0].dpo_number;
                                        xlstart = moment(tbl_temporaryx01.data[0].loading_start_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');
                                        xlend = moment(tbl_temporaryx01.data[0].loading_end_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');

                                        xloading = `<station type="loading">
                                                <company_name>${xlcompany_name}</company_name>
                                                <address>${xladdress}</address>
                                                <zip>${xlzip}</zip>
                                                <city>${xlcity}</city>
                                                <country_id>TH</country_id>
                                                <loading_name>${xlloading_name}</loading_name>
                                                <date_time_period>
                                                    <start>${xlstart}</start>
                                                    <end>${xlend}</end>
                                                    <timezone>Asia/Bangkok</timezone>
                                                </date_time_period>
                                                <comment></comment>
                                                </station>`
                                    }
                                }
                                else {
                                    console.log(job_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP (Get depot)');
                                    return '';
                                }

                                var scriptx02 = `select '${job_code}' as job_code, tbl_order_close.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc, 
                                case when tbl_order_petrol.ptrl_address is null then tbl_petrol.ptrl_address else tbl_order_petrol.ptrl_address end as ptrl_address,
                                case when tbl_order_petrol.ptrl_zip_code is null then tbl_petrol.ptrl_zip_code else tbl_order_petrol.ptrl_zip_code end as ptrl_zip_code,
                                case when tbl_order_petrol.ptrl_country_code is null then tbl_petrol.ptrl_country_code else tbl_order_petrol.ptrl_country_code end as ptrl_country_code,
                                case when tbl_order_petrol.ptrl_lat is null then tbl_petrol.ptrl_lat else tbl_order_petrol.ptrl_lat end as ptrl_lat,
                                case when tbl_order_petrol.ptrl_lon is null then tbl_petrol.ptrl_lon else tbl_order_petrol.ptrl_lon end as ptrl_lon,
                                case when tbl_order_petrol.ptrl_city is null then tbl_petrol.ptrl_city else tbl_order_petrol.ptrl_city end as ptrl_city,
                                tbl_petrol.ptrl_unloading_minute, tbl_petrol.ist_dt, tbl_petrol.mdf_dt, tbl_petrol.rm_dt, 
                                (select min(xsub.unloading_start_dt) from tbl_order_petrol xsub 
                                where xsub.ord_code = '${ord_code}' and xsub.ptrl_code = '${tbl_temporary2.data[r00].ptrl_code}') as unloading_start_dt, 
                                (select max(xsub.unloading_end_dt) from tbl_order_petrol xsub 
                                where xsub.ord_code = '${ord_code}' and xsub.ptrl_code = '${tbl_temporary2.data[r00].ptrl_code}') as unloading_end_dt, tbl_order_close.delivery_flag
                                from tbl_order_close
                                left join tbl_order_petrol on tbl_order_close.ord_code = tbl_order_petrol.ord_code
                                and tbl_order_petrol.ord_petrol_flag = '1'
                                left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
                                where tbl_order_close.ptrl_code = '${tbl_temporary2.data[r00].ptrl_code}'
                                and tbl_order_close.ord_close_flag = '1' and tbl_order_petrol.ptrl_code = '${tbl_temporary2.data[r00].ptrl_code}'

                                group by tbl_order_close.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc, 
                                tbl_petrol.ptrl_address,tbl_petrol.ptrl_zip_code, tbl_petrol.ptrl_country_code, tbl_petrol.ptrl_lat, tbl_petrol.ptrl_lon, 
                                tbl_order_petrol.ptrl_address,tbl_order_petrol.ptrl_zip_code, tbl_order_petrol.ptrl_country_code, tbl_order_petrol.ptrl_lat, tbl_order_petrol.ptrl_lon, 
                                tbl_petrol.ptrl_unloading_minute, tbl_petrol.ist_dt, tbl_petrol.mdf_dt, tbl_order_petrol.ptrl_city, tbl_petrol.ptrl_city, 
                                tbl_petrol.rm_dt, tbl_order_petrol.unloading_start_dt, tbl_order_petrol.unloading_end_dt, tbl_order_close.delivery_flag


                                union

                                select '${job_code}' as job_code, tbl_petrol_tank.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc, 
                                tbl_petrol.ptrl_address as ptrl_address,
                                tbl_petrol.ptrl_zip_code as ptrl_zip_code,
                                tbl_petrol.ptrl_country_code as ptrl_country_code,
                                tbl_petrol.ptrl_lat as ptrl_lat,
                                tbl_petrol.ptrl_lon as ptrl_lon,
                                tbl_petrol.ptrl_city as ptrl_city,
                                tbl_petrol.ptrl_unloading_minute, tbl_petrol.ist_dt, tbl_petrol.mdf_dt, tbl_petrol.rm_dt, 
                                (select min(xsub.unloading_start_dt) from tbl_order_petrol xsub 
                                where xsub.ord_code = '${ord_code}' and xsub.ptrl_code = '${tbl_temporary2.data[r00].ptrl_code}') as unloading_start_dt, 
                                (select max(xsub.unloading_end_dt) from tbl_order_petrol xsub 
                                where xsub.ord_code = '${ord_code}' and xsub.ptrl_code = '${tbl_temporary2.data[r00].ptrl_code}') as unloading_end_dt, '' delivery_flag
                                from tbl_order_compartment
                                left join tbl_petrol_tank on tbl_order_compartment.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
                                left join tbl_petrol on tbl_petrol_tank.ptrl_code = tbl_petrol.ptrl_code
                                where tbl_petrol_tank.ptrl_code = '${tbl_temporary2.data[r00].ptrl_code}'

                                group by tbl_petrol_tank.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc, 
                                tbl_petrol.ptrl_address,tbl_petrol.ptrl_zip_code, tbl_petrol.ptrl_country_code, tbl_petrol.ptrl_lat, tbl_petrol.ptrl_lon, 
                                tbl_petrol.ptrl_address,tbl_petrol.ptrl_zip_code, tbl_petrol.ptrl_country_code, tbl_petrol.ptrl_lat, tbl_petrol.ptrl_lon, 
                                tbl_petrol.ptrl_unloading_minute, tbl_petrol.ist_dt, tbl_petrol.mdf_dt, tbl_petrol.ptrl_city, tbl_petrol.ptrl_city, 
                                tbl_petrol.rm_dt, unloading_start_dt, unloading_end_dt

                                order by unloading_start_dt asc limit 1`;

                                let tbl_temporaryx02 = await pgConn.get(dbPrefix + lic_code, scriptx02, config.connectionString());

                                //unloading
                                var xuncompany_name = '';
                                var xunaddress = '';
                                var xunzip = '';
                                var xuncity = '';
                                var xunloading_name = '';
                                var xunstart = '';
                                var xunend = '';
                                var xunloading = ``;
                                //debugger

                                if (!tbl_temporaryx02.code) {
                                    if (tbl_temporaryx02.data.length > 0) {
                                        xuncompany_name = tbl_temporaryx02.data[0].ptrl_desc;
                                        xunaddress = tbl_temporaryx02.data[0].ptrl_address;
                                        xunzip = tbl_temporaryx02.data[0].ptrl_zip_code;
                                        xuncity = tbl_temporaryx02.data[0].ptrl_city;
                                        xunloading_name = tbl_temporaryx02.data[0].ptrl_number;
                                        xunstart = moment(tbl_temporaryx02.data[0].unloading_start_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');
                                        xunend = moment(tbl_temporaryx02.data[0].unloading_end_dt).add('Hours', 0).format('YYYY-MM-DDTHH:mm:ss');

                                        xunloading = `<station type="unloading">
                                                <company_name>${xuncompany_name}</company_name>
                                                <address>${xunaddress}</address>
                                                <zip>${xunzip}</zip>
                                                <city>${xuncity}</city>
                                                <country_id>TH</country_id>
                                                <loading_name>${xunloading_name}</loading_name>
                                                <date_time_period>
                                                    <start>${xunstart}</start>
                                                    <end>${xunend}</end>
                                                    <timezone>Asia/Bangkok</timezone>
                                                </date_time_period>
                                                <comment></comment>
                                                </station>`
                                    }
                                    else {
                                        console.log(job_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP (Get depot)');
                                        return '';
                                    }
                                }
                                else {
                                    console.log(job_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP (Get depot)');
                                    return '';
                                }

                                var scriptx03 = `
                                select tbl_order_close.ptrl_code, tbl_petrol.ptrl_desc,tbl_order_close.itm_code, case when delivery_flag = '3' then 0 else tbl_order_close.item_quantity end as item_quantity, tbl_order_close.veh_compartment_code,
                                tbl_vehicle_compartment.veh_compartment_number, tbl_order_close.ptrl_tank_code, tbl_petrol_tank.tnk_number, delivery_flag,
                                case when tbl_order_item.pos_number is null then '' else tbl_order_item.pos_number end as pos_number,
                                case when tbl_order_item.itm_desc is null then tbl_item.itm_desc else tbl_order_item.itm_desc end as itm_desc, 
                                case when tbl_order_item.itm_short_desc is null then tbl_item.itm_short_desc else tbl_order_item.itm_short_desc end as itm_short_desc, 
                                'init-9999999999999' as itm_unit_code,tbl_item.itm_material_number

                                from tbl_order_close 
                                left join tbl_order_item on tbl_order_close.itm_code = tbl_order_item.itm_code 
                                and tbl_order_close.ptrl_tank_code = tbl_order_item.ptrl_tank_code
                                and tbl_order_close.ord_code = tbl_order_item.ord_code
                                left join tbl_item on tbl_order_close.itm_code = tbl_item.itm_code
                                left join tbl_petrol_tank on tbl_order_close.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code 
                                left join tbl_vehicle_compartment on tbl_order_close.veh_compartment_code = tbl_vehicle_compartment.veh_compartment_code
                                left join tbl_petrol on tbl_order_close.ptrl_code = tbl_petrol.ptrl_code
                                where tbl_order_close.ptrl_code = '${tbl_temporary2.data[r00].ptrl_code}' 
                                and tbl_order_close.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}')

                                union 

                                select tbl_petrol_tank.ptrl_code, tbl_petrol.ptrl_desc ,tbl_order_compartment. itm_code,0 as item_quantity, tbl_order_compartment.veh_compartment_code, 
                                tbl_vehicle_compartment.veh_compartment_number, tbl_order_compartment.ptrl_tank_code, tbl_petrol_tank.tnk_number, delivery_flag,
                                case when tbl_order_item.pos_number is null then '' else tbl_order_item.pos_number end as pos_number,
                                case when tbl_order_item.itm_desc is null then tbl_item.itm_desc else tbl_order_item.itm_desc end as itm_desc, 
                                case when tbl_order_item.itm_short_desc is null then tbl_item.itm_short_desc else tbl_order_item.itm_short_desc end as itm_short_desc, 
                                'init-9999999999999' as itm_unit_code,tbl_item.itm_material_number 

                                from tbl_order_close 
                                left join tbl_job_order on tbl_order_close.ord_code = tbl_job_order.ord_code
                                left join tbl_order_compartment on tbl_order_close.ord_code = tbl_order_compartment.ord_code 
                                left join tbl_petrol_tank on tbl_order_compartment.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code 
                                and tbl_order_compartment.itm_code = tbl_order_close.itm_code
                                and tbl_order_compartment.ptrl_tank_code != tbl_order_close.ptrl_tank_code 
                                left join tbl_vehicle_compartment on tbl_order_compartment.veh_compartment_code = tbl_vehicle_compartment.veh_compartment_code
                                left join tbl_petrol on tbl_petrol_tank.ptrl_code = tbl_petrol.ptrl_code
                                left join tbl_order_item on tbl_order_compartment.itm_code = tbl_order_item.itm_code 
                                and tbl_order_compartment.ptrl_tank_code = tbl_order_item.ptrl_tank_code
                                and tbl_order_compartment.ord_code = tbl_order_item.ord_code
                                left join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
                                where job_code = '${job_code}' and tbl_order_close.delivery_flag = '2'
                                and tbl_petrol_tank.ptrl_code is not null and tbl_petrol_tank.ptrl_code = '${tbl_temporary2.data[r00].ptrl_code}'
                                and tbl_order_compartment.veh_compartment_code not in  

                                (select tbl_order_close.veh_compartment_code 

                                from tbl_order_close 
                                left join tbl_order_item on tbl_order_close.itm_code = tbl_order_item.itm_code 
                                and tbl_order_close.ptrl_tank_code = tbl_order_item.ptrl_tank_code
                                and tbl_order_close.ord_code = tbl_order_item.ord_code
                                left join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
                                left join tbl_petrol_tank on tbl_order_close.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code 
                                left join tbl_vehicle_compartment on tbl_order_close.veh_compartment_code = tbl_vehicle_compartment.veh_compartment_code
                                left join tbl_petrol on tbl_order_close.ptrl_code = tbl_petrol.ptrl_code
                                where tbl_order_close.ptrl_code = '${tbl_temporary2.data[r00].ptrl_code}' 
                                and tbl_order_close.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}'))


                                order by ptrl_code asc `

                                let tbl_temporaryx03 = await pgConn.get(dbPrefix + lic_code, scriptx03, config.connectionString());

                                if (!tbl_temporaryx03.code) {
                                    if (tbl_temporaryx03.data.length > 0) {
                                        var xitemuse = [{ itm_code: '', compartment_number: '', tank_number: '' }];

                                        var ipos = 0;
                                        for (var itm = 0; itm <= tbl_temporaryx03.data.length - 1; itm++) {
                                            //debugger
                                            var xitm_code = tbl_temporaryx03.data[itm].itm_code;
                                            var xtemplate_id = tbl_temporaryx03.data[itm].itm_material_number;
                                            var xpos_number = tbl_temporaryx03.data[itm].pos_number;
                                            var xshort_description = tbl_temporaryx03.data[itm].itm_desc;
                                            var xdescription = tbl_temporaryx03.data[itm].itm_desc;
                                            var xmaterial_number = tbl_temporaryx03.data[itm].itm_material_number;
                                            var xquantity = tbl_temporaryx03.data[itm].item_quantity;
                                            var xcompartment_number = tbl_temporaryx03.data[itm].veh_compartment_number
                                            var xtank_number = tbl_temporaryx03.data[itm].tnk_number;

                                            //debugger
                                            var xitemfilter = xitemuse.filter(xxx => {
                                                xxx.itm_code.toString() == xitm_code
                                                    && xxx.compartment_number.toString() == xcompartment_number
                                            })

                                            if (xitemfilter.length == 0) {

                                                var xpos_index = ipos + 1;

                                                if (xpos_index.length == 1) {
                                                    xpos_index = '0' + xpos_index;
                                                }

                                                if (xpos_number == '') {
                                                    try {
                                                        xpos_number = '0000' + ((ipos + 1) * 10)
                                                    }
                                                    catch (ex) {
                                                        xpos_number = '000001';
                                                    }
                                                }

                                                xitemuse.push({ itm_code: xitm_code, compartment_number: xcompartment_number, tank_number: xtank_number });
                                                ipos += 1;
                                                xitem += `<item>
                                                        <template_id>${xtemplate_id}</template_id>
                                                        <pos_number>${xpos_number}</pos_number>
                                                        <pos_index>${xpos_index}</pos_index>
                                                        <description>${xdescription}</description>
                                                        <short_description>${xshort_description}</short_description>
                                                        <material_number>${xmaterial_number}</material_number>
                                                        <quantities>
                                                            <quantity>
                                                                <qualifier>dimension.volume</qualifier>
                                                                <unit>l</unit>
                                                                <value>${xquantity}</value>
                                                            </quantity>
                                                        </quantities>
                                                        <parameters>
                                                            <parameter>
                                                                <qualifier>bol</qualifier>
                                                            </parameter>
                                                            <parameter>
                                                                <qualifier>tank.number</qualifier>
                                                                <value>T${xtank_number}</value>
                                                            </parameter>
                                                            <parameter>
                                                                <qualifier>compartment.number</qualifier>
                                                                <value>${xcompartment_number}</value>
                                                            </parameter>
                                                            <parameter>
                                                                <qualifier>depot</qualifier>
                                                                <!-- Filled in case of multipickup scenario, otherwise empty -->
                                                                <value>${xlloading_name}</value>
                                                            </parameter>
                                                            <parameter>
                                                                <qualifier>trailer_plate_number</qualifier>
                                                                <value>${xlicense_plate_trailer}</value>
                                                            </parameter>
                                                        </parameters>
                                                        </item>`
                                            }

                                            if (itm == tbl_temporaryx03.data.length - 1) {
                                                //create shipment
                                                rshipment += `<shipment>
                                                            <number>${xshipments_code}</number>
                                                            <shipper_id>454692</shipper_id>
                                                            <plant>TH Pongrawe CO LTD</plant>
                                                            <vehicle_id>${xvehicle_id}</vehicle_id>
                                                            <parameter>
                                                                <qualifier>gsap_order_number</qualifier>
                                                                <value></value>
                                                            </parameter>
                                                            <comment></comment>
                                                            ${xloading}
                                                            ${xunloading}
                                                            <items>${xitem}</items>
                                                            <parameters>
                                                                <parameter>
                                                                    <qualifier>gsap_order_number</qualifier>
                                                                    <value>${xgsap_order_number}</value>
                                                                </parameter>
                                                                <parameter>
                                                                    <qualifier>gsap_status</qualifier>
                                                                    <value>${xgsap_order_status}</value>
                                                                </parameter>
                                                                <parameter>
                                                                    <qualifier>order_type</qualifier>
                                                                    <value>${xgsap_order_type_code}</value>
                                                                </parameter>
                                                            </parameters>
                                                            </shipment>`
                                            }
                                        }
                                    }
                                    else {
                                        console.log(job_code, 'ไม่พบข้อมูล Job เพื่อส่งไปยัง TMP');
                                        return '';
                                    }
                                }
                                else {
                                    console.log(job_code, 'ไม่พบข้อมูล Job เพื่อส่งไปยัง TMP');
                                    return '';
                                }
                            }

                            if (r00 == tbl_temporary2.data.length - 1) {
                                //debugger
                                var xdata = ``;
                                xdata = `<transport>
                                                    <number>${xnumber}</number>
                                                    <shipper_id>454692</shipper_id>
                                                    <plant>TH Pongrawe CO LTD</plant>
                                                    <vehicle_id>${xvehicle_id}</vehicle_id>
                                                    <license_plate_truck>${xlicense_plate_truck}</license_plate_truck>
                                                    <license_plate_trailer>${xlicence_plate_second_trailer}</license_plate_trailer>
                                                    <comment>-</comment>
                                                    <shipments>
                                                        ${rshipment}
                                                    </shipments>
                                                    <parameters>
                                                        <parameter>
                                                            <qualifier>gsap_shipment_number</qualifier>
                                                            <value>${xgsap_shipments_number}</value>
                                                        </parameter>
                                                        <parameter>
                                                            <qualifier>fuel_type</qualifier>
                                                            <value>Diesel</value>
                                                        </parameter>
                                                        <parameter>
                                                            <qualifier>is_discharged</qualifier>
                                                            <value>true</value>
                                                        </parameter>
                                                        <parameter>
                                                            <qualifier>is_redirect</qualifier>
                                                            <value>${xredirect}</value>
                                                        </parameter>
                                                        <parameter>
                                                            <qualifier>truck_id</qualifier>
                                                            <value>${xtruck_id}</value>
                                                        </parameter>
                                                        <parameter>
                                                            <qualifier>licence_plate_second_trailer</qualifier>
                                                            <value></value>
                                                        </parameter>
                                                    </parameters>
                                                    </transport>`

                                console.log('xproduction', xproduction);
                                console.log(xdata);
                                return xdata;
                            }
                        }
                    }
                    else {
                        console.log(job_code, 'ไม่พบข้อมูล Job เพื่อส่งไปยัง TMP');
                        return '';
                    }
                }
                else {
                    console.log(job_code, 'ไม่พบข้อมูล Job เพื่อส่งไปยัง TMP');
                    return '';
                }

            }
            else {
                console.log(job_code, 'ไม่พบข้อมูล Job เพื่อส่งไปยัง TMP');
                return '';
            }
        }
        else {
            console.log(job_code, 'ไม่สามารถดึงข้อมูลเพื่อส่งไปยัง TMP');
            return '';
        }

    } catch (err) {
        console.log(job_code, err);
        console.log(job_code, 'ไม่สามารถดึงข้อมูลเพื่อส่งไปยัง TMP');
        return '';
    }

}

exports.postCloseDischargedJob2TmpWithXml = async (lic_code, job_code, xdata) => {

    var xresult = false;

    try {

        console.log(xdata);
        if (xproduction && lic_code == 'prw02') {
            debugger
            let xconfig = {
                method: 'post',
                maxBodyLength: Infinity,
                url: 'xxxxx',
                headers: {
                    'Content-Type': 'application/xml',
                    'Authorization': 'Basic SW50ZXJmYWNlQDYyNDc0NTpXc0A2NTQzMjE='
                },
                data: xdata
            };


            try {
                console.log(xconfig.url);
                const response = await axios.request(xconfig);
                console.log('Success:', response.data);
                console.log(JSON.stringify(response.data));
                if (response.data.success == true) {
                    console.log(job_code, 'postCloseDischargedJob2TmpWithXml TMP Complete');
                    var scriptx03 = `update tbl_job set job_comment = 'TMP Complete' where job_code = '${job_code}';`
                    let tbl_temporaryx03 = await pgConn.execute(dbPrefix + lic_code, scriptx03, config.connectionString());
                    xresult = true;
                }
                else {
                    console.log(job_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP, TMP Reject');
                    var scriptx03 = `update tbl_job set job_comment = 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP, TMP Reject' where job_code = '${job_code}';`
                    let tbl_temporaryx03 = await pgConn.execute(dbPrefix + lic_code, scriptx03, config.connectionString());
                    xresult = false;
                }
            } catch (error) {
                debugger
                if (axios.isAxiosError(error)) {
                    // This is an Axios-specific error
                    var error_message = '';
                    if (error.response) {
                        // The request was made and the server responded with a status code
                        // that falls out of the range of 2xx
                        console.error('Server Error:', error.response.data);
                        console.error('Status Code:', error.response.status);
                        console.error('Headers:', error.response.headers);
                        error_message = error.response.data.message;
                    } else if (error.request) {
                        // The request was made but no response was received
                        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                        // http.ClientRequest in Node.js
                        console.error('No Response Received:', error.request);
                        error_message = 'No Response Received';
                    } else {
                        // Something happened in setting up the request that triggered an Error
                        console.error('Request Setup Error:', error.message);
                        error_message = 'Request Setup Error';
                    }

                    debugger


                    if ((error_message.indexOf('locked') != -1)) {
                        var scriptx03 = `update tbl_job set job_comment = 'TMP Complete' where job_code = '${job_code}';`
                        let tbl_temporaryx03 = await pgConn.execute(dbPrefix + lic_code, scriptx03, config.connectionString());
                        xresult = true;
                    }
                    else {
                        console.log(job_code, 'เกิดข้อผิดพลาดในตอนส่งข้อมูล TMP, TMP Reject');
                        var scriptx03 = `update tbl_job set job_comment = '${error_message}' where job_code = '${job_code}';`
                        let tbl_temporaryx03 = await pgConn.execute(dbPrefix + lic_code, scriptx03, config.connectionString());
                        xresult = false;
                    }

                } else {
                    // This is a generic JavaScript error
                    console.error('Unexpected Error:', error.message);
                }
            }
        }
        else {
            return xresult;
        }

    } catch (err) {
        console.log(err);
        return xresult;
    }
    finally {
        return xresult;
    }

}

exports.postSyncVMIOrder_BK = async (lic_code) => {

    try {

        var xresult = false;

        try {

            let off_code = 'off-1747276087326';
            const params = new URLSearchParams();
            params.append('client_id', '5FF10yCWeVuUj8Bj');
            params.append('client_secret', 'Ikr7Fdnh2Z1DLeIL1ncq0xO99OHhH4YltuxviiWVzHIMpoQTtUzyWFKhXzCYOPTV');
            params.append('scope', 'ais-ds-ts-hamlet-prv');
            params.append('grant_type', 'client_credentials');

            await axios.post(xurl_prod, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })
                .then(async (response) => {
                    //get token
                    debugger
                    console.log(response.data);
                    let token = response.data.access_token;
                    let data = {
                        "haulierGroupName": "TH_PRV",
                        "userName": "TPTHTNA1@shellea.com"
                    }
                    await axios.post(xutl_order_prod, JSON.stringify(data), {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'Ocp-Apim-Subscription-Key': 'b4c8fb9099c04fd09945d46846fa0caa'
                        }
                    })
                        .then(async (response2) => {
                            //get token
                            debugger
                            console.log(response2.data);
                            if (response2.data != undefined) {
                                if (response2.data.length > 0) {
                                    var transportOrder = [];
                                    var transportOrderId = '';
                                    for (var x = 0; x <= response2.data.length - 1; x++) {

                                        let script0 = `select ord_code from public.tbl_order where shipments_code = '${response2.data[x].transportOrderId}' 
                                        and req_dt = '${moment(response2.data[x].tripStartDateTime).format('YYYY-MM-DD HH:mm:ss')}' and ord_flag = '1'`
                                        let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script0, config.connectionString());
                                        //debugger
                                        if (!tbl_temporary.code) {
                                            if (tbl_temporary.data.length > 0) {
                                                //skip insert order insert item, depot, petrol
                                                //insert รอบ 2
                                                //debugger
                                                let ord_code = tbl_temporary.data[0].ord_code;
                                                let dpo_number = response2.data[x].depotCode == undefined ? '' : response2.data[x].depotCode;
                                                let dpo_code = '';
                                                let xdpo_information = await this.getDepotInformation(lic_code, dpo_number);
                                                //debugger
                                                dpo_code = xdpo_information[0].dpo_code;

                                                let ptrl_number = response2.data[x].siteId
                                                let tank_number = response2.data[x].tankCode
                                                let xcustomer_information = await this.getCustomerInformation(lic_code, ptrl_number, tank_number);
                                                //debugger
                                                let ptrl_code = xcustomer_information[0].ptrl_code;
                                                let ptrl_tank_code = xcustomer_information[0].ptrl_tank_code;

                                                //insert item information
                                                let itm_code = '';
                                                let itm_unit_code = '';
                                                let itm_material_number = response2.data[x].productCode
                                                let item_quantity = 0;
                                                let xitm_information = await this.getItemInformation(lic_code, itm_material_number);
                                                itm_code = xitm_information[0].itm_code;
                                                itm_unit_code = xitm_information[0].itm_unit_code;
                                                itm_material_number = xitm_information[0].itm_material_number;

                                                try {
                                                    item_quantity = parseFloat(response2.data[x].quantity);
                                                } catch (error) {
                                                    item_quantity = 0;
                                                }

                                                if (dpo_code == '' && ptrl_code != '') {
                                                    xdpo_information = await this.getDepotFromPetrolInformation(lic_code, ptrl_code);
                                                    dpo_code = xdpo_information[0].dpo_code;
                                                }

                                                let average_daily_sales = 0;
                                                let book_stock = 0;

                                                try {
                                                    average_daily_sales = parseFloat(response2.data[x].averageDailySales);
                                                } catch (error) {
                                                    average_daily_sales = 0;
                                                }

                                                try {
                                                    book_stock = parseFloat(0);
                                                } catch (error) {
                                                    book_stock = 0;
                                                }

                                                if (ord_code != '') {
                                                    //checked
                                                    let script0 = `select ord_code from public.tbl_order_petrol where ord_code = '${ord_code}' 
                                                    and itm_code = '${itm_code}' and ptrl_tank_code = '${ptrl_tank_code}' and item_quantity = ${item_quantity}`
                                                    let tbl_temporary0x02 = await pgConn.get(dbPrefix + lic_code, script0, config.connectionString());

                                                    if (!tbl_temporary0x02.code) {
                                                        if (tbl_temporary0x02.data.length <= 0) {
                                                            //insert
                                                            var ord_item_code = 'oitm-' + moment().format('x');
                                                            let script2 = `INSERT INTO public.tbl_order_item 
                                                            (ord_item_code, ord_code, itm_code, itm_unit_code, item_quantity, ord_item_flag, ist_dt, ptrl_tank_code) 
                                                            values ('${ord_item_code}', '${ord_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                                                            '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '${ptrl_tank_code}')`

                                                            let tbl_temporary2 = await pgConn.execute(dbPrefix + lic_code, script2, config.connectionString());
                                                            //debugger;
                                                            if (!tbl_temporary2.code) {
                                                                //insert loading information
                                                                var ord_depot_code = 'odpo-' + moment().format('x');
                                                                let script3 = `INSERT INTO public.tbl_order_depot 
                                                                (ord_depot_code, ord_code, dpo_code, itm_code, itm_unit_code, item_quantity, ord_depot_flag, ist_dt) 
                                                                values ('${ord_depot_code}', '${ord_code}', '${dpo_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                                                                '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                                                                let tbl_temporary3 = await pgConn.execute(dbPrefix + lic_code, script3, config.connectionString());
                                                                //debugger;
                                                                if (!tbl_temporary3.code) {
                                                                    //insert unloading information
                                                                    var ord_petrol_code = 'optrl-' + moment().format('x');
                                                                    let script4 = `INSERT INTO public.tbl_order_petrol 
                                                                    (ord_petrol_code, ord_code, ptrl_code, ptrl_tank_code, itm_code, itm_unit_code, item_quantity, req_dt, ord_petrol_flag, ist_dt, 
                                                                    average_daily_sales, book_stock, deadlock_dt) 
                                                                    values ('${ord_petrol_code}', '${ord_code}', '${ptrl_code}', '${ptrl_tank_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity},
                                                                    '${moment(response2.data[x].customerETA).format('YYYY-MM-DD HH:mm:ss')}', '1', 
                                                                    '${moment().format('YYYY-MM-DD HH:mm:ss')}', ${average_daily_sales}, ${book_stock}, '${moment(response2.data[x].firstHitDeadStock).format('YYYY-MM-DD HH:mm:ss')}')`

                                                                    let tbl_temporary4 = await pgConn.execute(dbPrefix + lic_code, script4, config.connectionString());
                                                                    //debugger
                                                                    if (!tbl_temporary4.code) {
                                                                        console.log('sync (2) shipments_code', response2.data[x].transportOrderId, 'done.')
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            else {
                                                //insert ครั้งแรก
                                                let ord_code = 'odr-' + moment().format('x');
                                                //checked ข้อมูลซ่ำก่อน
                                                if (transportOrder.indexOf() == -1) {
                                                    transportOrder.push(ord_code);
                                                }

                                                let ord_type_code = 'otyp-9999999999998';
                                                let dpo_number = response2.data[x].depotCode
                                                let dpo_code = '';
                                                let xdpo_information = await this.getDepotInformation(lic_code, dpo_number);
                                                //debugger
                                                dpo_code = xdpo_information[0].dpo_code;

                                                let ptrl_number = response2.data[x].siteId
                                                let tank_number = response2.data[x].tankCode
                                                let xcustomer_information = await this.getCustomerInformation(lic_code, ptrl_number, tank_number);
                                                //debugger
                                                let ptrl_code = xcustomer_information[0].ptrl_code;
                                                let ord_customer_code = xcustomer_information[0].ptrl_code;
                                                let ord_customer_name = xcustomer_information[0].ptrl_desc;
                                                let ord_customer_number = xcustomer_information[0].ptrl_number;
                                                let petrol_group_code = xcustomer_information[0].ptrl_group_code;
                                                let ptrl_tank_code = xcustomer_information[0].ptrl_tank_code;

                                                if (dpo_code == '' && ptrl_code != '') {
                                                    xdpo_information = await this.getDepotFromPetrolInformation(lic_code, ptrl_code);
                                                    dpo_code = xdpo_information[0].dpo_code;
                                                }

                                                let script1 = `INSERT INTO public.tbl_order 
                                                (ord_code, shipments_code, transport_code, tour_code, 
                                                pull_code, number, document_reference, plant, assigned_carrier_id, 
                                                assigned_carrier_name, assigned_creditor_number, assigned_carrier_number, 
                                                ord_dt, req_dt, ord_status, ord_comment, ord_customer_code, ord_customer_name, 
                                                ord_customer_number, gsap_order_type_code, gsap_order_status, transporeon_status, 
                                                off_code, ord_flag, ist_dt, mdf_dt, rm_dt, loading_count, unloading_count, item_count, 
                                                item_quantity, ord_type_code, petrol_group_code, dver_code, veh_code, transporeon_result, 
                                                transporeon_ist_dt, transporeon_mdf_dt, transporeon_rm_dt, deadlock_dt) 
                                                VALUES ('${ord_code}', '${response2.data[x].transportOrderId}', '', '', 
                                                '', '${response2.data[x].transportOrderId}', 
                                                '', 'VMI orders', '624745', 'PONGRAWE Co.,Ltd', '', '', '${moment(response2.data[x].tripStartDateTime).format('YYYY-MM-DD HH:mm:ss')}', 
                                                '${moment(response2.data[x].customerETA).format('YYYY-MM-DD HH:mm:ss')}', '0', 'VMI Haulier API', '${ord_customer_code}', 
                                                '${ord_customer_name}', '${ord_customer_number}', 'ZOR', 'N', 'N', '${off_code}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}', 
                                                NULL, NULL, 0, 0, 0, 0.0, '${ord_type_code}', '${petrol_group_code}', '', 
                                                '', NULL, NULL, NULL, NULL,'${moment(response2.data[x].firstHitDeadStock).format('YYYY-MM-DD HH:mm:ss')}');`;

                                                let tbl_temporary1 = await pgConn.execute(dbPrefix + lic_code, script1, config.connectionString());
                                                //insert master order

                                                //insert item information
                                                let itm_code = '';
                                                let itm_unit_code = '';
                                                let itm_material_number = response2.data[x].productCode
                                                let item_quantity = 0;
                                                let xitm_information = await this.getItemInformation(lic_code, itm_material_number);
                                                itm_code = xitm_information[0].itm_code;
                                                itm_unit_code = xitm_information[0].itm_unit_code;
                                                itm_material_number = xitm_information[0].itm_material_number;

                                                try {
                                                    item_quantity = parseFloat(response2.data[x].quantity);
                                                } catch (error) {
                                                    item_quantity = 0;
                                                }

                                                let average_daily_sales = 0;
                                                let book_stock = 0;

                                                try {
                                                    average_daily_sales = parseFloat(response2.data[x].averageDailySales);
                                                } catch (error) {
                                                    average_daily_sales = 0;
                                                }

                                                try {
                                                    book_stock = parseFloat(0);
                                                } catch (error) {
                                                    book_stock = 0;
                                                }

                                                if (!tbl_temporary1.code) {
                                                    var ord_item_code = 'oitm-' + moment().format('x');
                                                    let script2 = `INSERT INTO public.tbl_order_item 
                                                    (ord_item_code, ord_code, itm_code, itm_unit_code, item_quantity, ord_item_flag, ist_dt, ptrl_tank_code) 
                                                    values ('${ord_item_code}', '${ord_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                                                    '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '${ptrl_tank_code}')`

                                                    let tbl_temporary2 = await pgConn.execute(dbPrefix + lic_code, script2, config.connectionString());
                                                    //debugger;
                                                    if (!tbl_temporary2.code) {
                                                        //insert loading information
                                                        var ord_depot_code = 'odpo-' + moment().format('x');
                                                        let script3 = `INSERT INTO public.tbl_order_depot 
                                                        (ord_depot_code, ord_code, dpo_code, itm_code, itm_unit_code, item_quantity, ord_depot_flag, ist_dt) 
                                                        values ('${ord_depot_code}', '${ord_code}', '${dpo_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                                                        '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                                                        let tbl_temporary3 = await pgConn.execute(dbPrefix + lic_code, script3, config.connectionString());
                                                        //debugger;
                                                        if (!tbl_temporary3.code) {
                                                            //insert unloading information
                                                            var ord_petrol_code = 'optrl-' + moment().format('x');
                                                            let script4 = `INSERT INTO public.tbl_order_petrol 
                                                            (ord_petrol_code, ord_code, ptrl_code, ptrl_tank_code, itm_code, itm_unit_code, item_quantity, req_dt, ord_petrol_flag, ist_dt, 
                                                            average_daily_sales, book_stock, deadlock_dt) 
                                                            values ('${ord_petrol_code}', '${ord_code}', '${ptrl_code}', '${ptrl_tank_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity},
                                                            '${moment(response2.data[x].customerETA).format('YYYY-MM-DD HH:mm:ss')}', 
                                                            '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}', ${average_daily_sales}, ${book_stock}, '${moment(response2.data[x].firstHitDeadStock).format('YYYY-MM-DD HH:mm:ss')}')`

                                                            let tbl_temporary4 = await pgConn.execute(dbPrefix + lic_code, script4, config.connectionString());
                                                            //debugger
                                                            if (!tbl_temporary4.code) {
                                                                console.log('sync shipments_code', response2.data[x].transportOrderId, 'done.')
                                                            }
                                                        }
                                                    }
                                                }

                                            }
                                        }

                                        if (x == response2.data.length - 1) {
                                            //check count information
                                            debugger
                                            if (transportOrder.length > 0) {
                                                for (var x1 = 0; x1 <= transportOrder.length - 1; x1++) {
                                                    let script5 = `update tbl_order 
                                                    set item_count = (select count(itm_code) from tbl_order_item where ord_code = '${transportOrder[x1]}' and ord_item_flag = '1'),
                                                    item_quantity = (select sum(item_quantity) from tbl_order_item where ord_code = '${transportOrder[x1]}' and ord_item_flag = '1'), 
                                                    loading_count = (select count(distinct dpo_code) from tbl_order_depot where ord_code = '${transportOrder[x1]}' and ord_depot_flag = '1'),
                                                    unloading_count = (select count(distinct ptrl_code) from tbl_order_petrol where ord_code = '${transportOrder[x1]}' and ord_petrol_flag = '1'),
                                                    deadlock_dt = (select min(deadlock_dt) from tbl_order_petrol where ord_code = '${transportOrder[x1]}' and ord_petrol_flag = '1')
                                                    where ord_code = '${transportOrder[x1]}'`

                                                    //debugger
                                                    let tbl_temporary5 = await pgConn.execute(dbPrefix + lic_code, script5, config.connectionString());
                                                    console.log('update order code ', transportOrder[x1], 'done.');
                                                    xresult = true;
                                                }
                                            }
                                            else {
                                                xresult = true;
                                            }

                                        }
                                    }
                                }
                            }
                            else {
                                return false;
                            }
                        })
                        .catch(err => {
                            debugger
                            console.error(err);
                        });

                })
                .catch(err => {
                    debugger
                    console.error(err);
                });

        } catch (err) {
            console.log(err);
        }


    } catch (err) {
        console.log(err);
        console.log(moment().format('YYYY-MM-DD HH:mm:ss'), 'VMI-Order is error.');
        xresult = false;
    }
    finally {
        return xresult;
    }

}

/**
 * รูปแบบ JSON action_body ให้เป็น Flat format
 */
exports.formatAuditLogs = (dbData) => {
    let rawData = JSON.parse(JSON.stringify(dbData).replace(/\:null/gi, "\:\"\""));

    let processedData = [];
    let allShipTos = new Set();

    for (let i = 0; i < rawData.length; i++) {
        let item = rawData[i];
        let parsedBody = null;
        try {
            if (item.action_body && typeof item.action_body === 'string') {
                parsedBody = JSON.parse(item.action_body);
            } else if (typeof item.action_body === 'object') {
                parsedBody = item.action_body;
            }
        } catch (e) {
            console.log("Json ผิดพลาด :", e.message);
        }

        let flatItem = {
            order_no: '',
            ship_to: '',
            station_name: '',
            station_group: item.station_group || '',
            event_type: item.event_type ? item.event_type.charAt(0).toUpperCase() + item.event_type.slice(1) : '',
            action_by: item.action_by,
            action_date: item.action_date,
            remark: '',
            field: '',
            before: '',
            after: '',
            changes: [],
        };

        if (parsedBody) {
            let bodyContent = parsedBody.body || parsedBody;
            flatItem.remark = bodyContent.remark || bodyContent.reason || bodyContent.description || '';

            flatItem.ship_to = bodyContent.ship_to || parsedBody.ship_to || '';
            if (flatItem.ship_to) {
                allShipTos.add(flatItem.ship_to.trim());
            }

            flatItem.field = bodyContent.field || '';
            flatItem.before = bodyContent.before || '';
            flatItem.after = bodyContent.after || '';

            if (Array.isArray(bodyContent.changes) && bodyContent.changes.length > 0) {
                flatItem.field = bodyContent.changes[0].field || '';
                flatItem.before = bodyContent.changes[0].before || '';
                flatItem.after = bodyContent.changes[0].after || '';
            }

            let extracted_order = parsedBody.query?.order_no || bodyContent.query?.order_no || bodyContent.order_no || parsedBody.order_no || '';

            if (Array.isArray(extracted_order)) {
                flatItem.order_no = extracted_order.join(', ');
            } else if (extracted_order !== '') {
                flatItem.order_no = extracted_order.toString();
            }
        }
        processedData.push(flatItem);
    }

    return { processedData, allShipTos };
}