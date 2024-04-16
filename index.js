require('dotenv').config();
const port = process.env.PORT || 4000
const express = require('express')
const app = express()
const cors = require('cors')
const bcrypt = require('bcrypt')
const cookieParser = require('cookie-parser');
const expressSession = require('express-session');
const userModel = require('./models/users')
const postModel = require('./models/posts')
const chapterModel = require('./models/chapters')
const subjectModel = require('./models/subjects')
const upload = require('./multer')
const path = require('path')


const secretKey = process.env.SECRET_KEY;


// middlewares
app.use(express.json())
app.use(cors())
app.use(cookieParser())
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'))

// passport setup 
app.use(expressSession({
    saveUninitialized: true,
    resave: true,
    secret: secretKey
}))

// Register endpoint
app.post('/', async (req, res) => {
    try {
        // Extract user details from request body
        const { username, email, password } = req.body;

        // Check if user already exists
        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user document
        const newUser = new userModel({
            username: username,
            email: email,
            password: hashedPassword
        });

        // Save the new user
        await newUser.save();


        // Respond with user details
        res.status(201).json({ newUser });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Login endpoint
app.post('/login', async function (req, res, next) {
    try {
        // Extract login credentials from request body
        const { username, password } = req.body;

        // Find user by email
        const user = await userModel.findOne({ username });

        if (!user) {
            // User not found
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Compare passwords
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            // Passwords do not match
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        // Respond with user details
        res.json({ user });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.post('/profileUpdate', upload.single('profileImg'), async (req, res) => {
    const user = await userModel.findOne({ _id: req.body.userId });
    user.profile = `http://localhost:3000/uploads/${req.file.filename}`;
    await user.save()
    // Process the uploaded file, e.g., save it to a database or file system
    res.send(user.profile);
});


app.post('/uploadPdf', upload.single('pdf-file'), async (req, res) => {

    const userData = await userModel.findOne({ _id: req.body.userId });
    const postData = await postModel.create({
        chapter: req.body.title,
        subject: req.body.subject,
        topics: req.body.topics,
        qualification: req.body.qualification,
        filename: req.file.originalname,
        author: userData.username,
        authorId: userData._id,
    });

    // also store the subject and chapter names to make searching easy
    const subjectName = req.body.subject;
    const chapterName = req.body.title;

    // Check if the subject already exists
    const existingSubject = await subjectModel.findOne({ title: subjectName });
    if (!existingSubject) {
        // Create a new subject if it doesn't exist
        await subjectModel.create({ title: subjectName });
    }

    // Check if the chapter already exists
    const existingChapter = await chapterModel.findOne({ title: chapterName });
    if (!existingChapter) {
        // Create a new chapter if it doesn't exist
        await chapterModel.create({ title: chapterName });
    }


    userData.posts.push(postData._id);
    await userData.save();

    // console.log(postData)
    // console.log(userData)
    res.send('uploaded');
})


app.get('/getuser/:userId', async (req, res) => {
    const userData = await userModel.findOne({ _id: req.params.userId })
    res.send(userData)
})


// Route to fetch PDF details by ID
app.get('/pdfDetails/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;
        // Fetch PDF details from the database based on the provided post ID
        const pdfDetails = await postModel.findById(postId);
        // Check if the PDF details exist
        if (pdfDetails) {
            // If found, send the PDF details as a response
            res.status(200).json(pdfDetails);
        } else {
            // If not found, send a 404 status with an error message
            res.status(404).json({ error: 'PDF details not found' });
        }
    } catch (error) {
        // If an error occurs, send a 500 status with the error message
        res.status(500).json({ error: error.message });
    }
});


app.post('/likePdf', async (req, res) => {
    const { userId, postId } = req.body;
    // Retrieve the post from the database
    const post = await postModel.findById(postId);

    if (!post) {
        // Handle case where post is not found
        return res.status(404).json({ error: 'Post not found' });
    }

    // Check if the post has likes array
    if (!post.likes || !Array.isArray(post.likes)) {
        // Handle case where likes array is missing or not an array
        return res.status(400).json({ error: 'Invalid post format' });
    }

    // Check if the userId is in the likes array
    if (post.likes.includes(userId)) {
        // Remove the userId from the likes array
        post.likes = post.likes.filter(id => id !== userId);
    } else {
        // Add the userId to the likes array
        post.likes.push(userId);
    }

    // Save the updated post
    await post.save();

    // Send a success response
    res.status(200).json({ message: 'Like status updated successfully' });
});


// Define a route to handle deleting a PDF
app.post('/deletePdf', async (req, res) => {
    try {
        // Find the user by ID
        const user = await userModel.findById(req.body.userId);

        // Find the index of the post ID in the user's posts array
        const index = user.posts.indexOf(req.body.postId);

        // If the post ID is found, remove it from the user's posts array
        if (index !== -1) {
            user.posts.splice(index, 1);
            await user.save(); // Save the user after updating the posts array
        }

        // Find the PDF by ID and delete it from the database
        await postModel.findByIdAndDelete(req.body.postId);

        res.status(200).json({ user });
    } catch (error) {
        console.error('Error deleting PDF:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.get('/getSubjects', async (req, res) => {
    const subjects = await subjectModel.find()
    res.send(subjects)
})


app.get('/getChapters/:chapter', async (req, res) => {
    const regex = new RegExp(`^${req.params.chapter}`, 'i')
    const chapters = await chapterModel.find({ title: regex });
    res.json(chapters);
})

// when input is empty after backspacing
app.get('/getChapters/', async (req, res) => {
    res.json([]);
})


app.get('/getSubjectPdfs', async (req, res) => {
    const option = req.query.option;
    const posts = await postModel.find({ subject: option })
    res.send(posts);
});


app.get('/getChapterPdfs', async (req, res) => {
    const chapters = req.query.chapter;
    const posts = await postModel.find({ chapter: chapters })
    // console.log(posts)
    res.send(posts);
});




app.listen(port, () => {
    console.log('server started');
})