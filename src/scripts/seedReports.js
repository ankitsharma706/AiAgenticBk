/**
 * src/scripts/seedReports.js
 * Generates initial intelligence reports in MongoDB for dashboard demonstration.
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const Report = require('../models/report.model');

async function seed() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected!');

        // Clear existing reports (Optional - keep history if preferred)
        // await Report.deleteMany({});

        const reports = [
            {
                report_id: `REP-RETENT-${Date.now()}`,
                type: 'retention_audit',
                status: 'GENERATED',
                data: {
                    summary: { total_users: 1250, churn_rate: 0.12, retention_rate: 0.88, high_risk_users: 145 },
                    trend: [
                        { month: 'Jan', churn_rate: 0.08 },
                        { month: 'Feb', churn_rate: 0.10 },
                        { month: 'Mar', churn_rate: 0.13 },
                        { month: 'Apr', churn_rate: 0.12 }
                    ],
                    risk_distribution: [
                        { name: 'High', value: 145 },
                        { name: 'Medium', value: 310 },
                        { name: 'Low', value: 795 }
                    ]
                },
                created_at: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2 hours ago
            },
            {
                report_id: `REP-BEHAV-${Date.now()}`,
                type: 'behavior_audit',
                status: 'GENERATED',
                data: {
                    engagement: { avg_score: 7.2, inactive_users: 38 },
                    activity_distribution: [45, 32, 18, 5],
                    top_behaviors: [
                        'Decreased login frequency in Enterprise segment',
                        'High correlation between churn and "monetary < $200"',
                        'Unusually high support ticket volume for SMB customers'
                    ]
                },
                created_at: new Date(Date.now() - 1000 * 60 * 60 * 24) // 1 day ago
            },
            {
                report_id: `REP-STRAT-${Date.now()}`,
                type: 'strategy_v2',
                status: 'GENERATED',
                data: {
                    recommendations: [
                        { segment: 'High Risk', action: 'Trigger 25% discount + Account Manager reach-out', impact: 'reduce churn by 18%' },
                        { segment: 'Medium Risk', action: 'Enable "Advanced Features" trial for 14 days', impact: 'reduce churn by 6%' },
                        { segment: 'Inactive', action: 'Re-engagement email with new feature highlights', impact: 'reduce churn by 3%' }
                    ],
                    revenue_impact: 84200.00
                },
                created_at: new Date(Date.now() - 1000 * 60 * 60 * 48) // 2 days ago
            }
        ];

        console.log('Inserting reports...');
        await Report.insertMany(reports);
        console.log('Successfully seeded 3 intelligence reports!');
        
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seed();
