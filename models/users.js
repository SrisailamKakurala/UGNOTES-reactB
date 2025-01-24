const mongoose = require('mongoose');


mongoose.connect('mongodb://127.0.0.1:27017/notesfy');

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    profile: {
        type: String,
        default: 'http://localhost:3000/uploads/defaultProfile.jpg',
    },
    posts: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'post'
        }
    ],
    downloads: {
        type: Number,
        default: 0,
    },
    amount: {
        type: Number,
        default: 0,
    },
})


module.exports = mongoose.model('user', userSchema);