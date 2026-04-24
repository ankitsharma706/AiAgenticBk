const puppeteer = require('puppeteer');
const ejs = require('ejs');
const path = require('path');
const chartService = require('./chart.service');

/**
 * Orchestrate PDF Generation
 * 1. Generate base64 charts
 * 2. Render EJS template to HTML
 * 3. Use Puppeteer to convert HTML to PDF
 */
exports.generateReportPdf = async (report) => {
    try {
        const { type, report_id, data, created_at } = report;
        
        // Prepare HTML (Simulated template rendering)
        const html = `
            <html>
                <head>
                    <style>
                        body { font-family: 'Arial', sans-serif; padding: 40px; color: #333; }
                        .header { border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; }
                        h1 { color: #1e1b4b; margin: 0; }
                        .meta { color: #64748b; font-size: 12px; margin-top: 5px; }
                        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
                        .kpi-card { background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; }
                        .kpi-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: bold; }
                        .kpi-value { font-size: 24px; font-weight: bold; color: #6366f1; }
                        .section { margin-bottom: 30px; }
                        .section-title { font-size: 14px; font-weight: bold; color: #1e1b4b; border-left: 4px solid #6366f1; padding-left: 10px; margin-bottom: 15px; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
                        th { color: #64748b; font-weight: normal; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Intelligence Report: ${type.replace('_', ' ').toUpperCase()}</h1>
                        <div class="meta">ID: ${report_id} | Generated: ${new Date(created_at).toLocaleString()}</div>
                    </div>

                    ${data.summary ? `
                        <div class="kpi-grid">
                            <div class="kpi-card"><div class="kpi-label">Total Users</div><div class="kpi-value">${data.summary.total_users}</div></div>
                            <div class="kpi-card"><div class="kpi-label">Churn Rate</div><div class="kpi-value">${(data.summary.churn_rate * 100).toFixed(1)}%</div></div>
                            <div class="kpi-card"><div class="kpi-label">Retention</div><div class="kpi-value">${(data.summary.retention_rate * 100).toFixed(1)}%</div></div>
                        </div>
                    ` : ''}

                    <div class="section">
                        <div class="section-title">DETAILED ANALYSIS</div>
                        <p>This report was generated using the Multi-Agent Churn Intelligence Engine. 
                        The underlying models analyzed behavioral trends and risk correlations across the entire dataset.</p>
                    </div>

                    <div class="section">
                        <div class="section-title">DATA PAYLOAD</div>
                        <pre style="background: #f1f5f9; padding: 15px; border-radius: 8px; font-size: 10px;">${JSON.stringify(data, null, 2)}</pre>
                    </div>
                </body>
            </html>
        `;

        const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();
        return pdfBuffer;
    } catch (error) {
        console.error('PDF Service Error:', error);
        throw error;
    }
};
