const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    report_id: {
        type: String,
        required: true,
        unique: true
    },
    type: {
        type: String,
        required: true
    },
    data: {
        type: Object,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'GENERATED', 'FAILED'],
        default: 'PENDING'
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Report', reportSchema);
