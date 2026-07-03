require('dotenv').config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
const logger = require('morgan');
const url = require('url');
const fs = require('fs')
const multer = require('multer');
const crypto = require("crypto");
const moment = require('moment');
const cron = require('node-cron');
const axios = require('axios');

var employeeRouter = require('./routes/employee/index');
var divisionRouter = require('./routes/division/index');
var departmentRouter = require('./routes/department/index');
var positionRouter = require('./routes/position/index');
var driverRouter = require('./routes/driver/index');
var authRouter = require('./routes/auth/index');
var officeRouter = require('./routes/office/index');
var locationRouter = require('./routes/location/index');
var vehicleRouter = require('./routes/vehicle/index');
var orderRouter = require('./routes/order/index');
var itemRouter = require('./routes/item/index');
var transporeonRouter = require('./routes/transporeon/index');
var petrolRouter = require('./routes/petrol/index');
var depotRouter = require('./routes/depot/index');
var utilityRouter = require('./routes/utility/index');
var centerRouter = require('./routes/center/index');
var jobRouter = require('./routes/job/index');
var trackingRouter = require('./routes/tracking/index');
var reportRouter = require('./routes/report/index');
var masterTimeRouter = require('./routes/master-time/index');
var reasonRouter = require('./routes/reason/index');
var runoutConfigRouter = require('./routes/runout-config/index');
var sapAlertConfigRouter = require('./routes/sap-alert-config/index');
var autoOrderMailsRouter = require('./routes/auto-order-mails/index');
var manualStockRouter = require('./routes/manual-stock/index');
var salesOrgConfigRouter = require('./routes/sales-org-config/index');
const autoOrderMailsController = require('./routes/auto-order-mails/auto-order-mails');
const autoOrderMailsScheduler = require('./routes/auto-order-mails/auto-order-mail-scheduler');
const orderController = require('./routes/order/order');
var lowStockAlertRouter = require('./routes/low-stock/index');
const lowStockAlertScheduler = require('./routes/low-stock/low-stock-scheduler');
const orderScheduler = require('./routes/order/order-sap-scheduler');
var app = express();
var cors = require('cors');
var config = require('./configuration/connection');
const prod = process.env.IS_PROD === 'true';
const paths = process.env.UPLOAD_PATH_DEV || path.join(__dirname, 'files');
const paths_prod = process.env.UPLOAD_PATH_PROD || '/root/tms-fuel/back-end/gateway/files/';
const uploadPath = prod ? paths_prod : paths;

app.get('/api-tms-v2/test-104', (req, res, next) => {
    console.log("-----------------------------------------")
    console.log("test 104")
    console.log("-----------------------------------------")
    res.status(200).send('Hello World!');

})

// gzip/deflate outgoing responses
var compression = require('compression');
app.use(compression());

// store session state in browser cookie
var cookieSession = require('cookie-session');
app.use(cookieSession({
    keys: [process.env.SESSION_SECRET_1 || 'secret1', process.env.SESSION_SECRET_2 || 'secret2']
}));

var session = require('express-session');
// parse urlencoded request bodies into req.body
app.set('trust proxy', 1) // trust first proxy
app.use(session({
    secret: process.env.SESSION_SECRET_EXPRESS || 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true }
}))

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        debugger
        callback(null, uploadPath)
    },
    filename: (req, file, callback) => {
        let id = crypto.randomBytes(16).toString("hex");
        req.id = id;
        // callback(null, id + '.' +
        //     file.originalname.split('.')[file.originalname.split('.').length - 1])
        console.log('filename', req.id)
        callback(null, id + '.jpg')
    }
})

const upload = multer({ storage: storage })
app.post('/api-tms-v2/upload/temporary', upload.single('fileupload'), async (req, res) => {
    debugger;
    console.log(req.id);
    console.log(req.body);
    if (req.id != undefined) {
        let response = [{
            status: 'success',
            invalid_code: '0',
            message: '',
            data: [{ id: req.id }],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]

        res.send(response);
    }
});

app.get('/helloword', async (req, res) => {
    let response = {
        status: 'success',
        invalid_code: '0',
        message: 'Hello World',
        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
    }

    res.send(response);
});

app.use(async (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.url.toString().indexOf('/helloword') != -1) {
        return;
    } else {
        let xauth = await this.xAuthorization(req, res);
        if (!xauth) {
            return;
        } else {
            next();
        }
    }
});

exports.xAuthorization = async (req, res) => {
    try {

        let lic_code = req.header('lic_code');
        console.log(lic_code);
        if (lic_code == undefined || lic_code.toString() == '') {
            if (req.url.toString().indexOf('register/license/verification') != -1) {
                return true;
            }
            else if (req.url.toString().indexOf('/source/?image=') != -1 || req.url.toString().indexOf('/favicon.ico') != -1) {
                //debugger
                var query = url.parse(req.url, true).query;
                pic = query.image;
                video = query.video;
                video_stream = query.video_stream;

                if (pic != undefined) {
                    if (typeof pic === 'undefined') {
                        res.writeHead(200, { 'Content-type': 'image/jpg' });
                        res.end(null);
                    } else {
                        //read the image using fs and send the image content back in the response
                        fs.readFile(uploadPath + pic, function (err, content) {
                            if (err) {
                                res.writeHead(200, { 'Content-type': 'image/jpg' });
                                res.end(null);
                            } else {
                                //specify the content type in the response will be an image
                                res.writeHead(200, { 'Content-type': 'image/jpg' });
                                res.end(content);
                            }
                        });
                    }
                }

                if (video != undefined) {
                    if (typeof video === 'undefined') {
                        res.writeHead(200, { 'Content-type': 'video/mp4' });
                        res.end(null);
                    } else {
                        //read the image using fs and send the image content back in the response
                        fs.readFile(uploadPath + video, function (err, content) {
                            if (err) {
                                res.writeHead(200, { 'Content-type': 'video/mp4' });
                                res.end(null);
                            } else {
                                //specify the content type in the response will be an image
                                res.writeHead(200, { 'Content-type': 'video/mp4' });
                                res.end(content);
                            }
                        });
                    }
                }

                if (video_stream != undefined) {
                    const videoPath = uploadPath + video_stream;
                    const stat = fs.statSync(videoPath);
                    const fileSize = stat.size;
                    const range = req.headers.range;

                    if (range) {
                        const parts = range.replace(/bytes=/, '').split('-');
                        const start = parseInt(parts[0], 10);
                        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                        const chunkSize = (end - start) + 1;
                        const file = fs.createReadStream(videoPath, { start, end });

                        res.writeHead(206, {
                            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                            'Accept-Ranges': 'bytes',
                            'Content-Length': chunkSize,
                            'Content-Type': 'video/quicktime;video/mp4',
                        });

                        file.pipe(res);
                    } else {
                        res.writeHead(200, {
                            'Content-Length': fileSize,
                            'Content-Type': 'video/quicktime;video/mp4',
                        });

                        fs.createReadStream(videoPath).pipe(res);
                    }
                }
            }
            else {
                let response = [{
                    status: 'error',
                    invalid_code: "-1",
                    message: "Authorization failed. (lic_code is undefined)",
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(401).send(response);
                return false;
            }
        }
        else {
            if (req.headers.authorization == config.authWebsite() || req.headers.authorization == config.authMobile()) {

                let httpmethod = req.method;
                let url = req.url;
                let body = req.body

                if (httpmethod == undefined) {
                    httpmethod = '';
                }

                if (url == undefined) {
                    url = '';
                }

                if (body == undefined) {
                    body = '{}';
                }

                return true;
            }
            else {
                let response = [{
                    status: 'error',
                    invalid_code: "-1",
                    message: "Authorization failed.",
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(401).send(response);
                return false;
            }
        }


    }
    catch (ex) {
        let response = [{
            status: 'error',
            invalid_code: "-2",
            message: "Authorization failed.",
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]

        res.status(401).send(response);
        return false;
    }
}

//auth
app.use('/api-tms-v2/auth', authRouter);
//employee
app.use('/api-tms-v2/employee', employeeRouter);
//division
app.use('/api-tms-v2/division', divisionRouter);
//department
app.use('/api-tms-v2/department', departmentRouter);
//position
app.use('/api-tms-v2/position', positionRouter);
//driver
app.use('/api-tms-v2/driver', driverRouter);
//office
app.use('/api-tms-v2/office', officeRouter);
//location
app.use('/api-tms-v2/location', locationRouter);
//vehicle
app.use('/api-tms-v2/vehicle', vehicleRouter);
//order
app.use('/api-tms-v2/order', orderRouter);
//item
app.use('/api-tms-v2/item', itemRouter);
//transporeon
app.use('/api-tms-v2/transporeon', transporeonRouter);
//Petrol
app.use('/api-tms-v2/petrol', petrolRouter);
//Depot
app.use('/api-tms-v2/depot', depotRouter);
//Utility
app.use('/api-tms-v2/utility', utilityRouter);
//Center
app.use('/api-tms-v2/center', centerRouter);
//Job
app.use('/api-tms-v2/job', jobRouter);
//Tracking
app.use('/api-tms-v2/tracking', trackingRouter);
//Report
app.use('/api-tms-v2/report', reportRouter);
//MasterTime
app.use('/api-tms-v2/master-time', masterTimeRouter);
//Reason
app.use('/api-tms-v2/reason', reasonRouter);
//Runout Config
app.use('/api-tms-v2/runout-config', runoutConfigRouter);
//SAP Alert Config
app.use('/api-tms-v2/sap-alert-config', sapAlertConfigRouter);
//Auto Order Mails
app.use('/api-tms-v2/auto-order-mails', autoOrderMailsRouter);
//Low Stock Alert
app.use('/api-tms-v2/low-stock-alert', lowStockAlertRouter);
//Manual Stock
app.use('/api-tms-v2/manual-stock', manualStockRouter);
//Sales Org Config
app.use('/api-tms-v2/sales-org-config', salesOrgConfigRouter);


// ตั้งเวลาทำงานทุก 1 ชั่วโมง
// cron.schedule('0 * * * *', async () => {
//     console.log('--- Start Hourly Cron Job: SAP Order Sync ---');
//     let toDay = moment().format('YYYYMMDD');
//     let toDayPlusOne = moment().add(1, 'days').format('YYYYMMDD');

//     const options = {
//         method: 'POST',
//         url: 'http://localhost:9100/api-tms-v2/order/order-hana/information',
//         headers: {
//             'Content-Type': 'application/json',
//             lic_code: 'aos01',
//             Authorization: 'Basic dG1zdjIud2Vic2l0ZTpyZVBAc3N3MHJkNzc4OTAw'
//         },
//         data: [
//             {
//                 SOInputParameter: {
//                     SalesOrderList: [],
//                     SalesOrderTypeList: [],
//                     ShipToPartyList: [],
//                     CreationDate: toDay,
//                     CreationTime: '',
//                     CreationDateTo: toDayPlusOne,
//                     CreationTimeTo: '',
//                     CustomerPurchaseOrderType: '',
//                     CustomerGroup1List: [],
//                     NameofOrdererList: [],
//                     action: [{ id: 'empl-1747190398748', value: '00001' }]
//                 }
//             }
//         ]
//     };

//     axios.request(options).then(function (response) {
//         console.log(response.data);
//     }).catch(function (error) {
//         console.error(error);
//     });
// }, {
//     timezone: "Asia/Bangkok"
// });

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

// Background Scheduler สำหรับ Auto Order Mail
autoOrderMailsScheduler.startAutoOrderMailLoop(); // Production รันทุกๆ 10 นาที
// Background Scheduler สำหรับแจ้งเตือน Low Stock
lowStockAlertScheduler.startLowStockLoop();
// Background Scheduler สำหรับดึงข้อมูลออเดอร์จาก SAP
orderScheduler.startOrderSapScheduler();

module.exports = app;