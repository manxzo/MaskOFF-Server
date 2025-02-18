const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const postSchema = new Schema({
    title: {type: String, required: true},
    content: {type: String, required: true},
    author: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    //postType distinguish between 'community' and 'job' posts
    postType: {type: String, enum: ['community', 'job'], default: 'community'},
    comments: [commentSchema],
    createdAt: {type: Date, default: Date.now}
});

const commentSchema = new Schema({
    author: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    content: {type: String, required: true},
    createdAt: {type: Date, default: Date.now}
});

//JSON transformation; add postID, remove _id and __v
postSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.postID = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Post', postSchema);