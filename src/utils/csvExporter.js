/**
 * src/utils/csvExporter.js
 * Converts report data objects into CSV strings.
 */
exports.exportToCsv = async (reportData) => {
    // If it's a retention audit, we export the trend or raw stats
    // This is a simple implementation that can be expanded.
    
    let csvRows = [];
    
    // Header
    csvRows.push(['Metric', 'Value'].join(','));
    
    // Flatten the summary
    if (reportData.summary) {
        Object.entries(reportData.summary).forEach(([key, val]) => {
            csvRows.push([key, val].join(','));
        });
    }

    // Add Trends if available
    if (reportData.trend) {
        csvRows.push([]); // spacer
        csvRows.push(['Month', 'Churn Rate'].join(','));
        reportData.trend.forEach(t => {
            csvRows.push([t.month, t.churn_rate].join(','));
        });
    }

    return csvRows.join('\n');
};
