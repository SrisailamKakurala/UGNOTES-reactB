const mongoose = require('mongoose');


const postSchema = new mongoose.Schema({
    chapter: String,
    subject: String,
    topics: String,
    qualification: String,
    filename: String,
    likes: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user'
        }
    ],
    authorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    author: String,
    postedDate: {
        type: Date,
        default: Date.now()
    },
})


module.exports = mongoose.model('post', postSchema);