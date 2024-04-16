const mongoose = require('mongoose');


const chapterSchema = new mongoose.Schema({
    title: String,
})


module.exports = mongoose.model('chapter', chapterSchema);