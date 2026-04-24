const moment = require('moment');
const autoOrderMailsController = require('./auto-order-mails');

// =========================================================
//  Helper: Sleep
// =========================================================
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * ตัวกำหนด เวลาทำ งาน
 * @param {string} startTime - Format "HH:mm" (e.g., "00:30")
 * @param {string} endTime - Format "HH:mm" (e.g., "15:30")
 * @param {number} pauseMinutes - Minutes to pause between runs
 */
const executeLoop = async (startTimeStr, endTimeStr, pauseMinutes) => {
    console.log(`🚀 [Auto Order Mail] เริ่มต้นระบบ Background Loop (${startTimeStr} - ${endTimeStr}, พัก ${pauseMinutes} นาที)...`);

    while (true) {
        try {
            const now = moment();

            // แปลงค่าเวลา ถอด string "HH:mm" เป็นตัวเลข
            const [startH, startM] = startTimeStr.split(':').map(Number);
            const [endH, endM] = endTimeStr.split(':').map(Number);

            // สร้าง object moment สำหรับเวลาเริ่มต้นและสิ้นสุดของวัน
            const startWindow = moment().set({ hour: startH, minute: startM, second: 0, millisecond: 0 });
            const endWindow = moment().set({ hour: endH, minute: endM, second: 0, millisecond: 0 });

            //========= ตรวจสอบว่าอยู่ในช่วงเวลาที่อนุญาตหรือไม่ =========
            if (now.isSameOrAfter(startWindow) && now.isSameOrBefore(endWindow)) {
                console.log(`\n[${moment().format('HH:mm:ss')}] 🟢 อยู่ในช่วงเวลาทำงาน (${startTimeStr} - ${endTimeStr}) | เริ่มการประมวลผล...`);

                // รันงานหลักจาก controller
                await autoOrderMailsController.runAutoOrderMailTask();

                const finishTime = moment();
                // ตรวจสอบหลังจากรันเสร็จ ถ้าถึงเวลาสิ้นสุดช่วงหรือเกินไปแล้ว ให้หยุดพักยาวจนถึงพรุ่งนี้
                if (finishTime.isAfter(endWindow) || finishTime.format('HH:mm') === endTimeStr) {
                    const tomorrowStart = moment().add(1, 'day').set({ hour: startH, minute: startM, second: 0, millisecond: 0 });
                    const waitMs = tomorrowStart.diff(finishTime);
                    console.log(`\n[${finishTime.format('HH:mm:ss')}] 🏁 จบรอบสุดท้ายของวัน (${endTimeStr}) แล้ว | จะเริ่มรันอีกครั้งพรุ่งนี้ตอน ${startTimeStr} (รออีกประมาณ ${Math.round(waitMs / 1000 / 60)} นาที)`);
                    await sleep(waitMs);
                } else {
                    console.log(`\n[${finishTime.format('HH:mm:ss')}] 💤 ประมวลผลรอบนี้เสร็จแล้ว | พัก ${pauseMinutes} นาทีตามเงื่อนไข...`);
                    await sleep(pauseMinutes * 60 * 1000);
                }
            }
            //========= ยังไม่ถึงเวลาเริ่ม Background Process =========
            else if (now.isBefore(startWindow)) {
                const waitMs = startWindow.diff(now);
                console.log(`\n[${now.format('HH:mm:ss')}] ⏳ ยังไม่ถึงเวลาเริ่ม (${startTimeStr}) | รออีกประมาณ ${Math.round(waitMs / 1000 / 60)} นาที...`);
                await sleep(waitMs);
            }
            //========= เลยเวลา endTime ของวันนี้ไปแล้ว =========
            else {
                const tomorrowStart = moment().add(1, 'day').set({ hour: startH, minute: startM, second: 0, millisecond: 0 });
                const waitMs = tomorrowStart.diff(now);
                console.log(`\n[${now.format('HH:mm:ss')}] 🏁 เลยเวลาดำเนินการของวันนี้ (${endTimeStr}) ไปแล้ว | จะเริ่มรันอีกครั้งพรุ่งนี้ตอน ${startTimeStr} (รออีกประมาณ ${Math.round(waitMs / 1000 / 60)} นาที)`);
                await sleep(waitMs);
            }
        } catch (err) {
            console.error('❌ [Auto Order Mail Loop] Error:', err);
            await sleep(60000); // กรณี error ให้รอ 1 นาทีแล้วค่อยลองใหม่
        }
    }
};

// =========================================================
//  Production Mode: 00:30 - 15:30 (พัก 10 นาที)
// =========================================================
exports.startAutoOrderMailLoop = () => {
    return executeLoop("00:30", "15:30", 10);
};

// =========================================================
//  Test Mode: พัก 10 วินาที, รันตลอดเวลา
// =========================================================
exports.startAutoOrderMailLoopTest = async () => {
    console.log('🧪 [Auto Order Mail] เริ่มต้นระบบ Background Loop (TEST MODE)...');

    while (true) {
        try {
            console.log(`\n[${moment().format('HH:mm:ss')}] 🧪 [TEST] เริ่มการประมวลผล...`);
            await autoOrderMailsController.runAutoOrderMailTask();
            console.log(`\n[${moment().format('HH:mm:ss')}] 💤 [TEST] พัก 10 วินาที...`);
            await sleep(10 * 1000);
        } catch (err) {
            console.error('❌ [Auto Order Mail Loop TEST] Error:', err);
            await sleep(5000);
        }
    }
};

// =========================================================
//  Custom Mode: กำหนดเวลาเองได้
// =========================================================
exports.startAutoOrderMailLoopCustom = (startTime, endTime, pauseMinutes) => {
    return executeLoop(startTime, endTime, pauseMinutes);
};
