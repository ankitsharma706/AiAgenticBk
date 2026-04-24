const express = require('express');
const router = express.Router();
const predictionController = require('../controllers/prediction.controller');
const reportController = require('../controllers/report.controller');

// Prediction & Training
router.post('/predict-user', predictionController.predictUser);
router.post('/train', predictionController.train);

// Reports
router.get('/reports', reportController.getReports);
router.get('/reports/:id', reportController.getReportById);
router.post('/reports/generate', reportController.generateReport);
router.get('/reports/:id/pdf', reportController.downloadPdf);
router.get('/reports/:id/csv', reportController.downloadCsv);

module.exports = router;
