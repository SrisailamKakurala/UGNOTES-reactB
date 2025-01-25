require('dotenv').config();
const port = process.env.PORT || 3000
const express = require('express')
const app = express()
const cors = require('cors')
const bcrypt = require('bcrypt')
const userModel = require('./models/users')
const postModel = require('./models/posts')
const chapterModel = require('./models/chapters')
const subjectModel = require('./models/subjects')
const upload = require('./multer')
const path = require('path')
const fs = require('fs');

const { createOrder, verifyPayment, handleWithdrawal  } = require('./razorpayPayment');

// middlewares
app.use(express.json())
app.use(cors())
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'))


// Register endpoint
app.post('/', async (req, res) => {
    try {
        console.log('entered');
        const { username, email, password } = req.body;

        // Debug: Log request body
        console.log('Request body:', { username, email, password });

        // Check if user already exists
        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            console.log('User already exists:', existingUser);
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('Password hashed:', hashedPassword);

        // Create a new user document
        const newUser = new userModel({
            username: username,
            email: email,
            password: hashedPassword
        });

        // Save the new user
        await newUser.save();
        console.log('User saved:', newUser);

        // Respond with user details
        res.status(201).json({ newUser });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// Login endpoint
app.post('/login', async function (req, res) {
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
    await user.save();
    res.send(user.profile);
});


app.post('/uploadPdf', upload.single('pdf-file'), async (req, res) => {

    const userData = await userModel.findOne({ _id: req.body.userId });
    const postData = await postModel.create({
        chapter: req.body.title,
        subject: req.body.subject,
        topics: req.body.topics,
        qualification: req.body.qualification,
        filename: req.file.filename,
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


// searching pdf's by select tag
app.get('/getSubjectPdfs', async (req, res) => {
    const option = req.query.option;
    const posts = await postModel.find({ subject: option })
    res.send(posts);
});


// searching pdf's by input tag
app.get('/getChapterPdfs', async (req, res) => {
    const chapters = req.query.chapter;
    const posts = await postModel.find({ chapter: chapters })
    // console.log(posts)
    res.send(posts);
});


// Route to create Razorpay order
app.post('/create-order', createOrder, (req, res) => {
    res.json({ order: req.razorpayOrder });
});


// Route to verify payment and download PDF
app.post('/downloadPdf', verifyPayment, async (req, res) => {
    try {
        if (!req.paymentSuccess) {
            return res.status(400).json({ error: 'Payment not verified' });
        }

        // Find the PDF by ID
        const pdf = await postModel.findById(req.query.id);
        if (!pdf) {
            return res.status(404).send("PDF not found");
        }

        // Find the user associated with the post
        const user = await userModel.findById(pdf.authorId);
        if (!user) {
            return res.status(404).send("User not found");
        }

        // Check if the file exists
        const filePath = path.join(__dirname, 'public/uploads', pdf.filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).send("File not found");
        }

        // Increment downloads by 1 and amount by 1.5
        user.downloads += 1;
        user.amount += 1.5;

        // Save the updated user
        await user.save();

        // Set content-disposition header to trigger download
        res.setHeader('Content-Disposition', `attachment; filename="${pdf.chapter}.pdf"`);

        // Send the file
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } catch (err) {
        console.log(err);
        res.status(500).send('Error downloading PDF');
    }
});


app.post('/withdraw',  handleWithdrawal);

app.listen(port, () => {
    console.log('server started');
})