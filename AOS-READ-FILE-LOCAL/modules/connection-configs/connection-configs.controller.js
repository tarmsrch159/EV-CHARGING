const express = require('express');
const router = express.Router();
const connectionConfigsService = require('./connection-configs.service');

// GET /api/connection-configs — ดึงข้อมูลทั้งหมด
router.get('/', async (req, res) => {
    try {
        const data = await connectionConfigsService.getAll();
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error getAll:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/connection-configs/:id — ดึงข้อมูลตาม ID
router.get('/:id', async (req, res) => {
    try {
        const data = await connectionConfigsService.getById(req.params.id);
        if (!data) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล config_id นี้' });
        }
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error getById:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/connection-configs — Insert ข้อมูลใหม่
router.post('/', async (req, res) => {
    try {
        const { config_name, config_type, host_address, port, username, password, config_flag, db_name } = req.body;

        // Validation: ต้องมี field หลักครบ
        if (!config_name || !host_address || !username || !password) {
            return res.status(400).json({
                success: false,
                message: 'กรุณากรอกข้อมูลให้ครบ: config_name, host_address, username, password'
            });
        }

        const data = await connectionConfigsService.create(req.body);
        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('Error create:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/connection-configs/:id — Update ข้อมูลตาม ID
router.put('/:id', async (req, res) => {
    try {
        const data = await connectionConfigsService.update(req.params.id, req.body);
        if (!data) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล config_id นี้' });
        }
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error update:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/connection-configs/:id — ลบข้อมูลตาม ID
router.delete('/:id', async (req, res) => {
    try {
        const data = await connectionConfigsService.remove(req.params.id);
        if (!data) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล config_id นี้' });
        }
        res.json({ success: true, message: 'ลบข้อมูลสำเร็จ', data });
    } catch (err) {
        console.error('Error delete:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
