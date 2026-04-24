const Report = require('../models/report.model.js');
const pdfkitGenerator = require('../utils/pdfkitGenerator.js');
const mlService = require('../services/ml.service.js');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /reports/generate
 */
exports.generateReport = async (req, res, next) => {
    try {
        const { type } = req.body;
        if (!type) return res.status(400).json({ error: "Report type is required" });

        const report_id = `REP-${uuidv4().slice(0, 8).toUpperCase()}`;

        // 1. Initial Processing (Async flow)
        const report = new Report({
            report_id,
            type,
            status: 'GENERATED', // For this request, we'll generate it immediately or mock it
            data: {},
            created_at: new Date()
        });

        // 2. Fetch real analytics from ML Service
        const analyticsData = await mlService.analyzeReport(type);
        report.data = analyticsData;
        
        await report.save();

        res.json({
            message: "Report generated successfully",
            report_id,
            type,
            data: report.data
        });
    } catch (error) {
        console.error('Generate Report Error:', error);
        res.status(500).json({ error: "Failed to generate report" });
    }
};

/**
 * GET /reports/:id
 */
exports.getReportById = async (req, res) => {
    try {
        const report = await Report.findOne({ report_id: req.params.id });
        if (!report) return res.status(404).json({ error: "Report not found" });
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

/**
 * GET /reports/:id/pdf
 */
exports.downloadPdf = async (req, res) => {
    try {
        const report = await Report.findOne({ report_id: req.params.id });
        if (!report) return res.status(404).json({ error: "Report not found" });

        const path = require('path');
        const fs = require('fs');
        
        let filePath = null;
        if (report.type === 'retention_audit') {
            filePath = path.join(__dirname, '../../churnai_monthly_retention_audit_sample.pdf');
        } else if (report.type === 'behavior_audit') {
            filePath = path.join(__dirname, '../../churnai_quarterly_forecast_report_sample.pdf');
        }

        if (filePath && fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=ChurnAI_${report.type}_${report.report_id}.pdf`);
            return res.sendFile(filePath);
        }

        // Fallback to generator if specific file not found
        const pdfBuffer = await pdfkitGenerator.generateReport(report);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Report_${report.report_id}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('PDF Download Error:', error);
        res.status(500).json({ error: "Failed to generate PDF" });
    }
};
/**
 * GET /reports (History)
 */
exports.getReports = async (req, res) => {
    try {
        console.log('Fetching reports history...');
        const reports = await Report.find().sort({ created_at: -1 }).limit(50);
        console.log(`Found ${reports.length} reports.`);
        res.json(reports);
    } catch (error) {
        console.error('Failed to fetch reports:', error);
        res.status(500).json({ error: "Failed to fetch reports" });
    }
};

/**
 * GET /reports/:id/csv
 */
exports.downloadCsv = async (req, res) => {
    try {
        const report = await Report.findOne({ report_id: req.params.id });
        if (!report) return res.status(404).json({ error: "Report not found" });

        const csvExporter = require('../utils/csvExporter.js');
        const csvData = await csvExporter.exportToCsv(report.data);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=Report_${report.report_id}.csv`);
        res.send(csvData);
    } catch (error) {
        res.status(500).json({ error: "Failed to generate CSV" });
    }
};
