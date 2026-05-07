const moment = require('moment');
const autoOrderMailsController = require('./auto-order-mails');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
    console.log(`[Auto Order Mail] เริ่มต้นระบบ Background Loop (${startTimeStr} - ${endTimeStr}, พัก ${pauseMinutes} นาที)...`);

    while (true) {
        try {
            const timeCtx = checkInTimeWindow(startTimeStr, endTimeStr);

            if (timeCtx.isInWindow) {
                console.log(`\n[${timeCtx.now.format('HH:mm:ss')}] 🟢 อยู่ในช่วงเวลาทำงาน | เริ่มประมวลผล...`);
                await autoOrderMailsController.runAutoOrderMailTask();

                const finishTime = moment();
                const currentWindow = checkInTimeWindow(startTimeStr, endTimeStr);

                if (currentWindow.isAfter || finishTime.format('HH:mm') === endTimeStr) {
                    const tomorrowStart = moment().add(1, 'day').set({
                        hour: parseInt(startTimeStr.split(':')[0]),
                        minute: parseInt(startTimeStr.split(':')[1]),
                        second: 0, millisecond: 0
                    });
                    const waitMs = tomorrowStart.diff(finishTime);
                    console.log(`\n[${finishTime.format('HH:mm:ss')}] 🏁 จบรอบสุดท้ายของวัน | จะเริ่มใหม่พรุ่งนี้ตอน ${startTimeStr} (${Math.round(waitMs / 1000 / 60)} นาที)`);
                    await sleep(waitMs);
                } else {
                    console.log(`\n[${finishTime.format('HH:mm:ss')}] 💤 เสร็จรอบนี้ | พัก ${pauseMinutes} นาที...`);
                    await sleep(pauseMinutes * 60 * 1000);
                }
            } else if (timeCtx.isBefore) {
                const waitMs = timeCtx.startWindow.diff(timeCtx.now);
                console.log(`\n[${timeCtx.now.format('HH:mm:ss')}] ⏳ ยังไม่ถึงเวลาเริ่ม (${startTimeStr}) | รออีก ${Math.round(waitMs / 1000 / 60)} นาที...`);
                await sleep(waitMs);
            } else {
                const tomorrowStart = moment().add(1, 'day').set({
                    hour: parseInt(startTimeStr.split(':')[0]),
                    minute: parseInt(startTimeStr.split(':')[1]),
                    second: 0, millisecond: 0
                });
                const waitMs = tomorrowStart.diff(timeCtx.now);
                console.log(`\n[${timeCtx.now.format('HH:mm:ss')}] 🏁 เลยเวลาของวันนี้ (${endTimeStr}) | เริ่มใหม่พรุ่งนี้ตอน ${startTimeStr} (${Math.round(waitMs / 1000 / 60)} นาที)`);
                await sleep(waitMs);
            }
        } catch (err) {
            console.error('❌ [Auto Order Mail Loop] Error:', err);
            await sleep(60000);
        }
    }
};

// --- Export Functions ---

// =========== Production Time =============
exports.startAutoOrderMailLoop = () => executeLoop("00:30", "15:30", 10);

// =========== Function Test ทำงานทุกๆ 10 วินาที =============
exports.startAutoOrderMailLoopTest = async () => {
    console.log('🧪 [Auto Order Mail] เริ่มต้นระบบ Background Loop (TEST MODE)...');
    while (true) {
        try {
            console.log(`\n[${moment().format('HH:mm:ss')}] 🧪 [TEST] เริ่มประมวลผล...`);
            await autoOrderMailsController.runAutoOrderMailTask();
            console.log(`\n[${moment().format('HH:mm:ss')}] 💤 [TEST] พัก 10 วินาที...`);
            await sleep(10000);
        } catch (err) {
            console.error('❌ [Auto Order Mail Loop TEST] Error:', err);
            await sleep(5000);
        }
    }
};

// =========== Function Test กำหนดเวลาเอง =============
exports.startAutoOrderMailLoopCustom = (startTime, endTime, pauseMinutes) => executeLoop(startTime, endTime, pauseMinutes);
