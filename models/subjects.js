const mongoose = require('mongoose');


const subjectSchema = new mongoose.Schema({
    title: String,
})


module.exports = mongoose.model('subject', subjectSchema);