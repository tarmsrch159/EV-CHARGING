const moment = require('moment');
const autoOrderMailsController = require('./auto-order-mails');


const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const xglobal = require('../../middleware/global');
const logInfo = xglobal.logInfo;
const logError = xglobal.logError;

/**
 * ตรวจสอบช่วงเวลาปัจจุบันว่าอยู่ในช่วงที่กำหนดหรือไม่
 */
const checkInTimeWindow = (startTimeStr, endTimeStr) => {
    const now = moment();
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);

    const startWindow = moment().set({ hour: startH, minute: startM, second: 0, millisecond: 0 });
    const endWindow = moment().set({ hour: endH, minute: endM, second: 0, millisecond: 0 });

    return {
        now,
        startWindow,
        endWindow,
        isInWindow: now.isSameOrAfter(startWindow) && now.isSameOrBefore(endWindow),
        isBefore: now.isBefore(startWindow),
        isAfter: now.isAfter(endWindow)
    };
};

/**
 * function กำหนดเวลาการทำงานของ ฺBackground Process
 */
const executeLoop = async (startTimeStr, endTimeStr, pauseMinutes) => {
    console.log(`\x1b[32m\x1b[1m`);
    console.log(`====================================================================`);
    console.log(`  [AOS SYSTEM] STARTING AUTO ORDER MAIL SCHEDULER SERVICE`);
    console.log(`====================================================================`);
    console.log(`  รอบการพักระบบ : ทุก ๆ ${pauseMinutes} นาที`);
    console.log(`  สถานะบริการ   : เปิดใช้งาน (กำลังสแกนคิวส่งเมล...)`);
    console.log(`====================================================================\x1b[0m`);

    while (true) {
        try {
            const timeCtx = checkInTimeWindow(startTimeStr, endTimeStr);
            // ======== เริ่มทำงานของรอบวัน ============
            if (timeCtx.isInWindow) {
                const licCodes = ['aos_qa'];
                // const licCodes = ['aos01', 'aos02'];
                for (const lic_code of licCodes) {
                    await autoOrderMailsController.runAutoOrderMailTask(lic_code);
                }

                const finishTime = moment();
                const currentWindow = checkInTimeWindow(startTimeStr, endTimeStr);
                // ====== จบรอบสุดท้ายของวัน หรือ เวลาเกินช่วงเวลาทำงานไปแล้ว ======
                if (currentWindow.isAfter || finishTime.format('HH:mm') === endTimeStr) {
                    const tomorrowStart = moment().add(1, 'day').set({
                        hour: parseInt(startTimeStr.split(':')[0]),
                        minute: parseInt(startTimeStr.split(':')[1]),
                        second: 0, millisecond: 0
                    });
                    const waitMs = tomorrowStart.diff(finishTime);
                    logInfo('Auto Order Mail', `จบรอบสุดท้ายของวัน | จะเริ่มใหม่พรุ่งนี้ตอน ${startTimeStr} (${Math.round(waitMs / 1000 / 60)} นาที)`);
                    await sleep(waitMs);
                }
                // ====== Cool Down การทำงาน ======
                else {
                    logInfo('Auto Order Mail', `พัก ${pauseMinutes} นาที...`);
                    await sleep(pauseMinutes * 60 * 1000);
                }
            }
            // ====== ยังไม่ถึงเวลาเริ่ม (${startTimeStr}) | รออีก ${Math.round(waitMs / 1000 / 60)} นาที======
            else if (timeCtx.isBefore) {
                const waitMs = timeCtx.startWindow.diff(timeCtx.now);
                logInfo('Auto Order Mail', `ยังไม่ถึงเวลาเริ่ม (${startTimeStr}) | รออีก ${Math.round(waitMs / 1000 / 60)} นาที...`);
                await sleep(waitMs);
            }
            // เวลาเลยช่วงเวลาทำงานไปแล้ว
            else {
                const tomorrowStart = moment().add(1, 'day').set({
                    hour: parseInt(startTimeStr.split(':')[0]),
                    minute: parseInt(startTimeStr.split(':')[1]),
                    second: 0, millisecond: 0
                });
                const waitMs = tomorrowStart.diff(timeCtx.now);
                logInfo('Auto Order Mail', `เลยเวลาของวันนี้ (${endTimeStr}) | เริ่มใหม่พรุ่งนี้ตอน ${startTimeStr} (${Math.round(waitMs / 1000 / 60)} นาที)`);
                await sleep(waitMs);
            }
        } catch (err) {
            logError('Auto Order Mail', 'Auto Order Mail Service Error (executeLoop)', err);
            await sleep(60000);
        }
    }
};



// =========== Production Time (ใช้ช่วงเวลาที่กว้างขึ้นเพราะกรองใน Query แล้ว) =============
exports.startAutoOrderMailLoop = () => executeLoop("00:01", "23:59", 10);

// =========== Function Test ทำงานทุกๆ 10 วินาที =============
exports.startAutoOrderMailLoopTest = async () => {
    console.log(`\x1b[36m\x1b[1m`);
    console.log(`====================================================================`);
    console.log(`  [AOS SYSTEM] STARTING AUTO ORDER MAIL SCHEDULER (TEST MODE)`);
    console.log(`====================================================================`);
    console.log(`  ช่วงเวลาสแกน : ทุก ๆ 10 วินาที`);
    console.log(`  สถานะบริการ   : โหมดทดสอบเปิดใช้งาน (กำลังสแกนคิวส่งเมล...)`);
    console.log(`====================================================================\x1b[0m`);
    while (true) {
        try {
            const licCodes = ['aos_qa'];
            // const licCodes = ['aos01', 'aos02'];
            for (const lic_code of licCodes) {
                await autoOrderMailsController.runAutoOrderMailTask(lic_code);
            }
            logInfo('Auto Order Mail', '[TEST] พัก 10 วินาที...');
            await sleep(10000);
        } catch (err) {
            logError('Auto Order Mail', 'Auto Order Mail Service Error (executeLoopTest)', err);
            await sleep(5000);
        }
    }
};

// =========== Function Test กำหนดเวลาเอง =============
exports.startAutoOrderMailLoopCustom = (startTime, endTime, pauseMinutes) => executeLoop(startTime, endTime, pauseMinutes);
