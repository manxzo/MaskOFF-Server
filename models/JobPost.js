const mongoose = require('mongoose');
const Schema = mongoose.Schema; 

const jobPostSchema = new Schema({
    title: {type: String, required: true},
    description: {type: String, required: true},
    employer: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    applicants: [{type: Schema.Types.ObjectId, ref: 'User'}],
    createdAt: {type: Date, default: Date.now}
});

//JSON transformation
jobPostSchema.set('toJSON', {
    virtuals: true,
    transform: (doc,ret) => {
        ret.jobPostID = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('JobPost', jobPostSchema);