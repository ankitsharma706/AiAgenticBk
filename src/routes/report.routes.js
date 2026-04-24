const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller.js');

/**
 * Report Routes
 * All routes are prefixed with /reports in app.js
 */

router.get('/', reportController.getReports);
router.post('/generate', reportController.generateReport);
router.get('/:id', reportController.getReportById);
router.get('/:id/pdf', reportController.downloadPdf);

module.exports = router;
