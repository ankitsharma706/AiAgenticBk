const Prediction = require('../models/prediction.model');
const mongoose = require('mongoose');

const syncForecastsToPredictions = async () => {
    const fs = require('fs');
    const path = require('path');
    const csv = require('csv-parser');
    
    // Safety check for mongoose connection
    if (!mongoose.connection || !mongoose.connection.db) {
        console.error('Sync failed: MongoDB connection not ready');
        return;
    }
    const db = mongoose.connection.db;
    
    try {
        // 1. Load Activity Data
        const activityMap = {};
        const activityPath = path.join(__dirname, '../../../ml-service/data/activity.csv');
        
        if (fs.existsSync(activityPath)) {
            console.log('Reading activity data for sync...');
            await new Promise((resolve, reject) => {
                fs.createReadStream(activityPath)
                    .pipe(csv())
                    .on('data', (row) => {
                        try {
                            // Map user_001 to C-001
                            const cid = row.user_id ? row.user_id.replace('user_', 'C-') : null;
                            if (!cid) return;
                            if (!activityMap[cid]) activityMap[cid] = [];
                            activityMap[cid].push({
                                month: parseInt(row.month) || 1,
                                year: parseInt(row.year) || 2024,
                                txns: parseInt(row.txn_count) || 0,
                                spend: parseFloat(row.spend) || 0
                            });
                        } catch (e) {
                            // Ignore malformed rows
                        }
                    })
                    .on('error', reject)
                    .on('end', resolve);
            });
        }

        // 2. Load Forecasts
        const forecastFiles = [
            path.join(__dirname, '../../../ml-service/data/quarterly_forecast_raw_predictions.csv'),
            path.join(__dirname, '../../../ml-service/data/Quarterly data.csv')
        ];

        let forecasts = [];
        for (const fpath of forecastFiles) {
            if (fs.existsSync(fpath)) {
                console.log(`Parsing forecast file: ${path.basename(fpath)}`);
                await new Promise((resolve, reject) => {
                    fs.createReadStream(fpath)
                        .pipe(csv())
                        .on('data', (row) => {
                            try {
                                const customerId = row['Customer ID'] || row.customer_id;
                                if (!customerId || customerId.trim() === '' || customerId === 'null') return;

                                forecasts.push({
                                    customer_id: customerId,
                                    name: row.Name || row.name || 'Unknown',
                                    predicted_churn_probability: row['Predicted Churn Probability'] || row.predicted_churn_probability || '0%',
                                    risk_level: row['Risk Level'] || row.risk_level || 'Low',
                                    subscription_plan: row['Subscription Plan'] || row.subscription_plan || 'Basic',
                                    segment: row.Segment || row.segment || 'Startup',
                                    predicted_revenue_loss: row['Predicted Revenue Loss'] || row.predicted_revenue_loss || '$0',
                                    recommended_action: row['Recommended Action'] || row.recommended_action || 'N/A',
                                    forecast_month: row['Forecast Month'] || row.forecast_month || 'N/A',
                                    timestamp: new Date()
                                });
                            } catch (e) {}
                        })
                        .on('error', reject)
                        .on('end', resolve);
                });
            }
        }

        // Also get from DB forecasts collection if it exists
        try {
            const dbForecasts = await db.collection('forecasts').find().toArray();
            forecasts = [...forecasts, ...dbForecasts];
        } catch (e) {
            console.warn('Could not fetch forecasts from collection, relying on CSVs');
        }

        if (forecasts.length === 0) {
            console.log('No forecasts found to sync.');
            return;
        }

        const predictions = forecasts.map(f => {
            // Map "91%" to 0.91
            const probStr = String(f.predicted_churn_probability || '0%');
            const churnScore = parseFloat(probStr.replace('%', '')) / 100 || 0;
            
            // Map Risk Levels
            let riskLevel = 'Low';
            const rawRisk = String(f.risk_level || 'Low').toLowerCase();
            if (rawRisk === 'critical' || rawRisk === 'high') riskLevel = 'High';
            else if (rawRisk === 'medium') riskLevel = 'Medium';

            // Map Revenue Loss "$14,200" to 14200
            const revStr = String(f.predicted_revenue_loss || '$0');
            const monetary = parseFloat(revStr.replace(/[$,]/g, '')) || 0;

            return {
                customer_id: f.customer_id,
                churn_score: churnScore,
                risk_level: riskLevel,
                metadata: {
                    name: f.name,
                    segment: f.segment,
                    plan: f.subscription_plan,
                    monetary: monetary,
                    frequency: activityMap[f.customer_id]?.reduce((sum, a) => sum + a.txns, 0) || 10,
                    recommended_action: f.recommended_action,
                    forecast_month: f.forecast_month,
                    activity_history: activityMap[f.customer_id] || []
                },
                created_at: f.timestamp || new Date()
            };
        });

        if (predictions.length === 0) {
            console.log('No forecasts found to sync.');
            return;
        }

        console.log(`Starting bulk sync of ${predictions.length} records...`);
        const bulkOps = predictions.map(pred => ({
            updateOne: {
                filter: { customer_id: pred.customer_id },
                update: { $set: pred },
                upsert: true
            }
        }));

        await Prediction.bulkWrite(bulkOps);
        console.log(`Bulk sync completed: ${predictions.length} predictions updated.`);
    } catch (err) {
        console.error('Error during forecast sync:', err.message);
        // Do not throw, allow the request to proceed with existing data
    }
};

let lastSync = 0;
let isSyncing = false;

const ensureSynced = async () => {
    if (isSyncing) return;
    const now = Date.now();
    
    try {
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
            console.warn('ensureSynced skipped: MongoDB not connected');
            return;
        }
        const count = await Prediction.countDocuments();
        // Only sync if empty or more than 5 minutes passed
        if (count === 0 || (now - lastSync > 300000)) {
            isSyncing = true;
            try {
                await syncForecastsToPredictions();
                lastSync = Date.now();
            } finally {
                isSyncing = false;
            }
        }
    } catch (err) {
        console.error('Error in ensureSynced check:', err.message);
    }
};

exports.getSummary = async (req, res, next) => {
    try {
        await ensureSynced();
        const stats = await Prediction.aggregate([
            {
                $group: {
                    _id: null,
                    total_users: { $sum: 1 },
                    high_risk_count: {
                        $sum: { $cond: [{ $eq: ["$risk_level", "High"] }, 1, 0] }
                    },
                    avg_churn_score: { $avg: "$churn_score" }
                }
            }
        ]);
        res.json(stats[0] || { total_users: 0, high_risk_count: 0, avg_churn_score: 0 });
    } catch (error) {
        next(error);
    }
};

exports.getTrends = async (req, res, next) => {
    try {
        await ensureSynced();
        // Since we have history in metadata, we can aggregate that
        // For simplicity in this demo, we'll return the monthly activity totals
        const trends = await Prediction.aggregate([
            { $unwind: "$metadata.activity_history" },
            {
                $group: {
                    _id: { 
                        month: "$metadata.activity_history.month",
                        year: "$metadata.activity_history.year"
                    },
                    activity: { $sum: "$metadata.activity_history.txns" },
                    spend: { $sum: "$metadata.activity_history.spend" }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } },
            {
                $project: {
                    month: "$_id.month",
                    year: "$_id.year",
                    activity: 1,
                    spend: 1,
                    _id: 0
                }
            }
        ]);
        res.json(trends);
    } catch (error) {
        next(error);
    }
};

exports.getSegments = async (req, res, next) => {
    try {
        await ensureSynced();
        const segments = await Prediction.aggregate([
            {
                $group: {
                    _id: "$risk_level",
                    count: { $sum: 1 }
                }
            }
        ]);
        res.json(segments);
    } catch (error) {
        next(error);
    }
};

exports.getHeatmap = async (req, res, next) => {
    try {
        await ensureSynced();
        const heatmap = await Prediction.aggregate([
            { $unwind: "$metadata.activity_history" },
            {
                $group: {
                    _id: {
                        risk: "$risk_level",
                        month: "$metadata.activity_history.month"
                    },
                    value: { $sum: "$metadata.activity_history.txns" }
                }
            },
            {
                $project: {
                    risk: "$_id.risk",
                    month: "$_id.month",
                    value: 1,
                    _id: 0
                }
            }
        ]);
        res.json(heatmap);
    } catch (error) {
        next(error);
    }
};

exports.getScatter = async (req, res, next) => {
    try {
        await ensureSynced();
        const scatter = await Prediction.find({}, {
            customer_id: 1,
            churn_score: 1,
            'metadata.monetary': 1,
            'metadata.frequency': 1,
            risk_level: 1,
            _id: 0
        }).limit(500);
        
        const formatted = scatter.map(s => ({
            id: s.customer_id,
            x: s.metadata.monetary,
            y: s.churn_score * 100, // Scale to percentage
            z: s.metadata.frequency,
            risk: s.risk_level
        }));
        res.json(formatted);
    } catch (error) {
        next(error);
    }
};

exports.getTopUsers = async (req, res, next) => {
    try {
        await ensureSynced();
        const users = await Prediction.find()
            .sort({ churn_score: -1 })
            .limit(10);
        res.json(users);
    } catch (error) {
        next(error);
    }
};

exports.getForecasts = async (req, res, next) => {
    try {
        const { quarter, year, page = 1, limit = 20, customer_id } = req.query;
        const query = {};
        
        if (customer_id) {
            query.customer_id = customer_id;
        } else {
            if (quarter && quarter !== 'All' && year && year !== 'All') {
                query.forecast_month = `${quarter} ${year}`;
            } else if (year && year !== 'All') {
                query.forecast_month = { $regex: year, $options: 'i' };
            } else if (quarter && quarter !== 'All') {
                query.forecast_month = { $regex: quarter, $options: 'i' };
            }
        }

        if (!mongoose.connection || !mongoose.connection.db) {
            return res.json({ data: [], total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 });
        }
        const db = mongoose.connection.db;
        
        const total = await db.collection('forecasts').countDocuments(query);
        const forecasts = await db.collection('forecasts')
            .find(query)
            .sort({ timestamp: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit))
            .toArray();
            
        res.json({
            data: forecasts,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / (parseInt(limit) || 20))
        });
    } catch (error) {
        next(error);
    }
};

exports.getForecastById = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.connection || !mongoose.connection.db) {
            return res.status(503).json({ message: 'Database connection not ready' });
        }
        const db = mongoose.connection.db;
        const forecast = await db.collection('forecasts').findOne({ customer_id: id });
        if (!forecast) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        res.json(forecast);
    } catch (error) {
        next(error);
    }
};
