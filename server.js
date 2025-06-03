require('dotenv').config(); // Loads environment variables from .env file
const express = require('express');
const { OpenAI } = require('openai');
const cors = require('cors');
const multer = require('multer'); // For handling file uploads
const mongoose = require('mongoose'); // For MongoDB interaction
const bcrypt = require('bcryptjs'); // For password hashing
const jwt = require('jsonwebtoken'); // For JSON Web Tokens

const app = express();
// --- CRITICAL CHANGE FOR DEPLOYMENT: Use Render's assigned PORT, or fallback to 3000 locally ---
const port = process.env.PORT || 3000;
// --- END CRITICAL CHANGE ---

// Initialize OpenAI with your API key from environment variables
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('Could not connect to MongoDB Atlas', err));

// Define User Schema (before app.use middleware)
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    // Trial and subscription fields (for future subscription logic)
    trialEndDate: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // 30 days trial from registration
    isSubscribed: { type: Boolean, default: false }
});

// Pre-save hook to hash password before saving
userSchema.pre('save', async function(next) {
    if (this.isModified('password')) { // Only hash if password field is modified (e.g., on registration or password change)
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

const User = mongoose.model('User', userSchema);

// Set up Multer for memory storage. This stores the uploaded file as a Buffer in memory.
// We use 'input_file' as the generic field name for both image and audio.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware setup
app.use(cors()); // Enables Cross-Origin Resource Sharing for frontend communication
// Allow larger JSON bodies for base64 image data (e.g., up to 50MB)
app.use(express.json({ limit: '50mb' }));
// Serves static files (your frontend HTML, CSS, JS) from the 'public' directory
app.use(express.static('public'));

// User Registration Endpoint
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = new User({ username, password });
        await user.save();
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        if (error.code === 11000) { // Duplicate key error for unique username
            return res.status(400).json({ error: 'Username already exists.' });
        }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// User Login Endpoint
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ error: 'Invalid username or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid username or password.' });
        }

        // Generate JWT Token
        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        res.json({ message: 'Logged in successfully!', token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expects 'Bearer TOKEN'

    if (!token) {
        return res.status(401).json({ error: 'Authentication required: No token provided.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT verification error:', err);
            return res.status(403).json({ error: 'Authentication failed: Invalid or expired token.' });
        }
        req.user = user; // Attach user payload to request
        next();
    });
};

// MODIFIED: API Endpoint to handle notes, image, OR audio (NOW PROTECTED)
app.post('/generate-flashcards', authenticateToken, upload.single('input_file'), async (req, res) => { // 'input_file' will be the generic field name from frontend
    const { notes } = req.body; // Text notes from the request body
    const file = req.file; // This could be an image or an audio file

    let transcribedText = '';

    // Step 1: Handle Audio Transcription if an audio file is provided
    if (file && file.mimetype && file.mimetype.startsWith('audio/')) {
        try {
            // OpenAI's Whisper API expects a File object, so we recreate it from the buffer
            const audioFileForWhisper = new File([file.buffer], file.originalname, { type: file.mimetype });

            const transcription = await openai.audio.transcriptions.create({
                file: audioFileForWhisper,
                model: "whisper-1", // Whisper API model for transcription
            });
            transcribedText = transcription.text;
            console.log('Whisper transcription:', transcribedText); // For debugging
        } catch (whisperError) {
            console.error('Error transcribing audio with Whisper:', whisperError);
            if (whisperError.response) {
                console.error('Whisper API Error Status:', whisperError.response.status);
                console.error('Whisper API Error Data:', whisperError.response.data);
            }
            return res.status(500).json({ error: 'Failed to transcribe audio. Please try a different audio format or quality.' });
        }
    }

    // Prepare messages array for GPT-4o
    const messages = [{
        role: "user",
        content: [] // The content array will hold text and image parts
    }];

    // Step 2: Add content for GPT-4o based on input type (prioritizing audio then text then image)
    if (transcribedText) { // If audio was transcribed
        messages[0].content.push({ type: "text", text: `Here are notes transcribed from audio:\n${transcribedText}` });
    } else if (notes) { // If text notes were provided
        messages[0].content.push({ type: "text", text: `Here are some study notes:\n${notes}` });
    } else if (file && file.mimetype && file.mimetype.startsWith('image/')) { // If an image file was provided
        const base64Image = file.buffer.toString('base64');
        const mimeType = file.mimetype;
        messages[0].content.push({
            type: "image_url",
            image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "low" // 'low' for faster/cheaper processing, 'high' for more detail (more costly)
            }
        });
    } else {
        // If no valid input (text, audio, or image) is provided
        return res.status(400).json({ error: 'Please provide notes text, an image, or audio input.' });
    }


    // Step 3: Add core instruction for GPT-4o
    messages[0].content.push({
        type: "text",
        text: `Based on the provided study materials, generate a list of distinct flashcards. Each flashcard MUST strictly follow the format "Q: [Your Question Here]\\nA: [Your Answer Here]". There MUST be exactly one blank line between each flashcard. Do NOT include any introductory or concluding remarks, or any other text outside of the Q: and A: pairs. Provide at least 3-5 flashcards if possible. If no relevant concepts are found, respond with "No flashcards could be generated."`
    });

    try {
        // Step 4: Call GPT-4o
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // IMPORTANT: Using a multimodal model like GPT-4o for image understanding
            messages: messages, // Pass the prepared multimodal messages
            temperature: 0.7,   // Controls randomness (0.2 for more factual, 1.0 for more creative)
            max_tokens: 1500,   // Max tokens for the AI's response (adjust as needed)
        });

        const flashcardsText = completion.choices[0].message.content.trim();

        if (flashcardsText === "No flashcards could be generated.") {
            return res.status(200).json({ flashcards: [], error: "No flashcards could be generated from the provided input." });
        }

        const flashcards = flashcardsText.split('\n\n').filter(Boolean).map(card => {
            const parts = card.split('\n');
            const question = parts[0] ? parts[0].replace(/^Q: /, '').trim() : '';
            const answer = parts[1] ? parts[1].replace(/^A: /, '').trim() : '';
            return { question, answer };
        });

        res.json({ flashcards });

    } catch (error) {
        console.error('Error generating flashcards with GPT-4o:', error);
        if (error.response) {
            console.error('GPT-4o API Error Status:', error.response.status);
            console.error('GPT-4o API Error Data:', error.response.data);
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: 'Failed to generate flashcards due to an internal AI error.' });
        }
    }
});

// Start the Express server and listen for incoming requests
app.listen(port, () => {
    // --- UPDATED CONSOLE.LOG MESSAGE FOR CLARITY ON DEPLOYMENT ---
    console.log(`Server is now listening on the assigned port: ${port}`);
    // --- END UPDATED CONSOLE.LOG ---
});

