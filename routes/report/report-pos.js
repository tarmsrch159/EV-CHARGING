const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../middleware/global');

const dbPrefix = config.dbPrefix();

const formatIfValid = (date) => {
    return moment(date, moment.ISO_8601, true).isValid()
        ? moment(date).format('YYYY-MM-DD')
        : null;
};

exports.getReportPosTanks = async (req, res, next) => {
    var xresult = [];
    let { start_date, end_date, keyword, page_index, page_limit, action } = req.body[0];
    let lic_code = req.header('lic_code');
    let roleId = action[0].id;
    let roleValue = action[0].value !== 'ALL' ? action[0].value : 'ALL';
    let shipTo = action[0].ship_to;

    if (lic_code == undefined) {

        let response = [{
            status: 'error',
            invalid_code: '-1',
            message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]

        res.status(200).send(response);
        return
    }

    try {
        end_date = moment(end_date).add(1, 'days').format('YYYY-MM-DD');
        page_index = (page_index - 1) * page_limit;
        page_limit = parseInt(page_limit);

        let param = [];
        let scriptSql = ` FROM tbl_order_eodtank WHERE 1=1 `;

        // --- เงื่อนไขที่ 1: Shipto ---
        if (roleValue.toUpperCase() !== 'ALL') {
            param.push(shipTo);
            scriptSql += ` AND shipto_no = $${param.length} `;
        }

        // --- เงื่อนไขที่ 2: Date ---
        start_date = formatIfValid(start_date);
        end_date = formatIfValid(end_date);
        if (start_date && end_date) {
            param.push(start_date);
            scriptSql += ` AND date_at >= $${param.length} `;

            param.push(end_date);
            scriptSql += ` AND date_at < $${param.length} `;
        }

        // --- เงื่อนไขที่ 3: Keyword ---
        if (keyword) {
            keyword = '%' + keyword + '%';
            param.push(keyword);
            scriptSql += ` AND product_name LIKE $${param.length} `;
        }

        // --- ดึงข้อมูล Count ---
        let scriptCount = ` SELECT count(*) as rows_total ` + scriptSql;
        let resultCount = await pgConn.getWithParams(dbPrefix + lic_code, scriptCount, [...param], config.connectionString());

        if (resultCount.code) throw new Error(resultCount.message);
        let rows_total = resultCount.data[0].rows_total;

        // --- ดึงข้อมูล Data ---
        let sortSql = ` ORDER BY date_at DESC, shipto_no ASC, tank_no ASC `;

        param.push(page_limit);
        let limitStr = ` LIMIT $${param.length} `;

        param.push(page_index);
        let offsetStr = ` OFFSET $${param.length} `;

        let scriptData = ` SELECT * ` + scriptSql + sortSql + limitStr + offsetStr;
        let result = await pgConn.getWithParams(dbPrefix + lic_code, scriptData, param, config.connectionString());
        let page_total = Math.ceil(rows_total / page_limit);

        response = [{
            status: 'success',
            invalid_code: '0',
            message: result.data.length > 0 ? 'ดึงข้อมูลสำเร็จ' : 'ไม่พบข้อมูล',
            page_total: (page_total <= 0 ? 1 : page_total),
            rows_total: parseInt(rows_total),
            data: result.data,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }];
        res.status(200).json(response);

    } catch (error) {
        let response = [{
            status: 'error',
            invalid_code: '-1',
            message: 'ไม่สามารถดึงข้อมูลได้, ระบบเกิดข้อผิดพลาด',
            data: error.message,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }];
        res.status(500).json(response);
    }
}

exports.getReportPosMeters = async (req, res, next) => {
    var xresult = [];
    let { start_date, end_date, keyword, page_index, page_limit, action } = req.body[0];
    let lic_code = req.header('lic_code');
    let roleId = action[0].id;
    let roleValue = action[0].value !== 'ALL' ? action[0].value : 'ALL';
    let shipTo = action[0].ship_to;

    if (lic_code == undefined) {

        let response = [{
            status: 'error',
            invalid_code: '-1',
            message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]

        res.status(200).send(response);
        return
    }

    try {
        end_date = moment(end_date).add(1, 'days').format('YYYY-MM-DD');
        page_index = (page_index - 1) * page_limit;
        page_limit = parseInt(page_limit);

        let param = [];
        let scriptSql = ` FROM tbl_order_eodmeter WHERE 1=1 `;

        // --- เงื่อนไขที่ 1: Shipto ---
        if (roleValue.toUpperCase() !== 'ALL') {
            param.push(shipTo);
            scriptSql += ` AND shipto_no = $${param.length} `;
        }

        // --- เงื่อนไขที่ 2: Date ---
        start_date = formatIfValid(start_date);
        end_date = formatIfValid(end_date);
        if (start_date && end_date) {
            param.push(start_date);
            scriptSql += ` AND buy_date >= $${param.length} `;

            param.push(end_date);
            scriptSql += ` AND buy_date < $${param.length} `;
        }

        // --- เงื่อนไขที่ 3: Keyword ---
        if (keyword) {
            keyword = '%' + keyword + '%';
            param.push(keyword);
            scriptSql += ` AND product_name LIKE $${param.length} `;
        }

        // --- ดึงข้อมูล Count ---
        let scriptCount = ` SELECT count(*) as rows_total ` + scriptSql;
        let resultCount = await pgConn.getWithParams(dbPrefix + lic_code, scriptCount, [...param], config.connectionString());

        if (resultCount.code) throw new Error(resultCount.message);
        let rows_total = resultCount.data[0].rows_total;

        // --- ดึงข้อมูล Data ---
        let sortSql = ` ORDER BY buy_date DESC, shipto_no ASC, meter_no ASC `;

        param.push(page_limit);
        let limitStr = ` LIMIT $${param.length} `;

        param.push(page_index);
        let offsetStr = ` OFFSET $${param.length} `;

        let scriptData = ` SELECT * ` + scriptSql + sortSql + limitStr + offsetStr;
        let result = await pgConn.getWithParams(dbPrefix + lic_code, scriptData, param, config.connectionString());
        let page_total = Math.ceil(rows_total / page_limit);

        response = [{
            status: 'success',
            invalid_code: '0',
            message: result.data.length > 0 ? 'ดึงข้อมูลสำเร็จ' : 'ไม่พบข้อมูล',
            page_total: (page_total <= 0 ? 1 : page_total),
            rows_total: parseInt(rows_total),
            data: result.data,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }];
        res.status(200).json(response);

    } catch (error) {
        let response = [{
            status: 'error',
            invalid_code: '-1',
            message: 'ไม่สามารถดึงข้อมูลได้, ระบบเกิดข้อผิดพลาด',
            data: error.message,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }];
        res.status(500).json(response);
    }
}

exports.getReportPosOmi = async (req, res, next) => {
    var xresult = [];
    let { start_date, end_date, keyword, page_index, page_limit, action } = req.body[0];
    let lic_code = req.header('lic_code');
    let roleId = action[0].id;
    let roleValue = action[0].value !== 'ALL' ? action[0].value : 'ALL';
    let shipTo = action[0].ship_to;

    if (lic_code == undefined) {

        let response = [{
            status: 'error',
            invalid_code: '-1',
            message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]

        res.status(200).send(response);
        return
    }

    try {
        end_date = moment(end_date).add(1, 'days').format('YYYY-MM-DD');
        page_index = (page_index - 1) * page_limit;
        page_limit = parseInt(page_limit);

        let param = [];
        let scriptSql = ` FROM tbl_order_omi WHERE 1=1 `;

        // --- เงื่อนไขที่ 1: Shipto ---
        if (roleValue.toUpperCase() !== 'ALL') {
            param.push(shipTo);
            scriptSql += ` AND shipto_no = $${param.length} `;
        }

        // --- เงื่อนไขที่ 2: Date ---
        start_date = formatIfValid(start_date);
        end_date = formatIfValid(end_date);
        if (start_date && end_date) {
            param.push(start_date);
            scriptSql += ` AND buy_at >= $${param.length} `;

            param.push(end_date);
            scriptSql += ` AND buy_at < $${param.length} `;
        }

        // --- เงื่อนไขที่ 3: Keyword ---
        if (keyword) {
            keyword = '%' + keyword + '%';
            param.push(keyword);
            scriptSql += ` AND product_name LIKE $${param.length} `;
        }

        // --- ดึงข้อมูล Count ---
        let scriptCount = ` SELECT count(*) as rows_total ` + scriptSql;
        let resultCount = await pgConn.getWithParams(dbPrefix + lic_code, scriptCount, [...param], config.connectionString());

        if (resultCount.code) throw new Error(resultCount.message);
        let rows_total = resultCount.data[0].rows_total;

        // --- ดึงข้อมูล Data ---
        let sortSql = ` ORDER BY buy_at DESC, product_no ASC `;

        param.push(page_limit);
        let limitStr = ` LIMIT $${param.length} `;

        param.push(page_index);
        let offsetStr = ` OFFSET $${param.length} `;

        let scriptData = ` SELECT * ` + scriptSql + sortSql + limitStr + offsetStr;
        let result = await pgConn.getWithParams(dbPrefix + lic_code, scriptData, param, config.connectionString());
        let page_total = Math.ceil(rows_total / page_limit);

        response = [{
            status: 'success',
            invalid_code: '0',
            message: result.data.length > 0 ? 'ดึงข้อมูลสำเร็จ' : 'ไม่พบข้อมูล',
            page_total: (page_total <= 0 ? 1 : page_total),
            rows_total: parseInt(rows_total),
            data: result.data,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }];
        res.status(200).json(response);

    } catch (error) {
        let response = [{
            status: 'error',
            invalid_code: '-1',
            message: 'ไม่สามารถดึงข้อมูลได้, ระบบเกิดข้อผิดพลาด',
            data: error.message,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }];
        res.status(500).json(response);
    }
}

exports.addPosTank = async (req, res) => {
    try {
        const { date_at, ptrl_number, lic_code } = req.body;
        const result = await pgConn.executePg(
            `SELECT * FROM ${dbPrefix}add_pos_tank($1, $2, $3)`,
            [date_at, ptrl_number, lic_code]
        );
        res.json(result);
    } catch (error) {
        console.error('Error in addPosTank:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

exports.addPosMeter = async (req, res) => {
    try {
        const { date_at, ptrl_number, lic_code } = req.body;
        const result = await pgConn.executePg(
            `SELECT * FROM ${dbPrefix}add_pos_meter($1, $2, $3)`,
            [date_at, ptrl_number, lic_code]
        );
        res.json(result);
    } catch (error) {
        console.error('Error in addPosMeter:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}


