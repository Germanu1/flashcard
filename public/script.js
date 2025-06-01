require('dotenv').config(); // Loads environment variables from .env file
const express = require('express');
const { OpenAI } = require('openai');
const cors = require('cors');
const multer = require('multer'); // For handling file uploads

const app = express();
// --- CRITICAL CHANGE FOR DEPLOYMENT: Use Render's assigned PORT, or fallback to 3000 locally ---
const port = process.env.PORT || 3000;
// --- END CRITICAL CHANGE ---

// Initialize OpenAI with your API key from environment variables
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Set up Multer to store uploaded files in memory as a Buffer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware setup
app.use(cors()); // Enables Cross-Origin Resource Sharing for frontend communication
// Allow larger JSON bodies for base64 image data (e.g., up to 50MB)
app.use(express.json({ limit: '50mb' }));
// Serves static files (your frontend HTML, CSS, JS) from the 'public' directory
app.use(express.static('public'));

// API Endpoint for generating flashcards
// 'upload.single('image')' is Multer middleware that processes the 'image' field from FormData
app.post('/generate-flashcards', upload.single('image'), async (req, res) => {
    const { notes } = req.body; // Text notes from the request body
    const imageFile = req.file; // Uploaded image file (as a Buffer) from Multer

    // Basic validation: ensure at least notes or an image is provided
    if (!notes && !imageFile) {
        return res.status(400).json({ error: 'Please provide notes text or an image.' });
    }

    // Prepare the 'messages' array for OpenAI's chat completions API
    // This array handles both text and image content for multimodal models
    const messages = [{
        role: "user",
        content: [] // The content array will hold text and image parts
    }];

    // Add text notes to the content array if provided
    if (notes) {
        messages[0].content.push({ type: "text", text: `Here are some study notes:\n${notes}` });
    }

    // Add image data to the content array if an image file is provided
    if (imageFile) {
        // Convert the image buffer to a Base64 string
        const base64Image = imageFile.buffer.toString('base64');
        // Get the MIME type (e.g., 'image/png', 'image/jpeg')
        const mimeType = imageFile.mimetype;

        messages[0].content.push({
            type: "image_url", // Indicate that this part is an image URL
            image_url: {
                // Construct the data URL for the Base64 image
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "low" // 'low' for faster/cheaper processing, 'high' for more detail (more costly)
            }
        });
    }

    // --- UPDATED AI PROMPT FOR STRICTER FORMATTING ---
    messages[0].content.push({
        type: "text",
        text: `Based on the provided study notes and/or image, generate a list of distinct flashcards. Each flashcard MUST strictly follow the format "Q: [Your Question Here]\\nA: [Your Answer Here]". There MUST be exactly one blank line between each flashcard. Do NOT include any introductory or concluding remarks, or any other text outside of the Q: and A: pairs. Provide at least 3-5 flashcards if possible. If no relevant concepts are found, respond with "No flashcards could be generated."`
    });
    // --- END UPDATED AI PROMPT ---

    try {
        // Make the API call to OpenAI's chat completions endpoint
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // IMPORTANT: Using a multimodal model like GPT-4o for image understanding
            messages: messages, // Pass the prepared multimodal messages
            temperature: 0.7,   // Controls randomness (0.2 for more factual, 1.0 for more creative)
            max_tokens: 1500,   // Max tokens for the AI's response (adjust as needed)
        });

        // Extract the generated flashcards text from the AI's response
        const flashcardsText = completion.choices[0].message.content.trim();

        // Simple parsing: Split the text by blank lines to get individual flashcards
        // Then, parse each flashcard into a question and answer object
        const flashcards = flashcardsText.split('\n\n').filter(Boolean).map(card => {
            const parts = card.split('\n');
            const question = parts[0] ? parts[0].replace(/^Q: /, '').trim() : '';
            const answer = parts[1] ? parts[1].replace(/^A: /, '').trim() : '';
            return { question, answer };
        });

        // Send the parsed flashcards back to the frontend as JSON
        res.json({ flashcards });

    } catch (error) {
        console.error('Error generating flashcards:', error);
        // Handle API errors or other issues
        if (error.response) {
            console.error(error.response.status, error.response.data);
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: 'Failed to generate flashcards.' });
        }
    }
});

// Start the Express server and listen for incoming requests
app.listen(port, () => {
    // --- UPDATED CONSOLE.LOG MESSAGE FOR CLARITY ON DEPLOYMENT ---
    console.log(`Server is now listening on the assigned port: ${port}`);
    // --- END UPDATED CONSOLE.LOG ---
});