const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const introductionSchema = new Schema({
    content: {type: String, required: true},
    createdAt: {type: Date, default: Date.now}
});

// JSON transformation: add introID, remove _id and __v
introductionSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.introID = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Introduction', introductionSchema);