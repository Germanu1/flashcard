require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const { OpenAI } = require('openai');
const cors = require('cors');
const multer = require('multer'); // <-- ADDED: Multer import

const app = express();
const port = 3000; // Backend server port

// Initialize OpenAI with your API key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Setup Multer for memory storage. This stores the uploaded file as a Buffer in memory.
// It's simple for small files but not ideal for very large uploads.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage }); // <-- ADDED: Multer setup

// Middleware
app.use(cors()); // Enable CORS for cross-origin requests from your frontend
// IMPORTANT: Allow larger JSON bodies for base64 image data (e.g., 50mb)
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public')); // Serve static files from the 'public' directory

// API Endpoint for generating flashcards
// 'upload.single('image')' is Multer middleware that processes the 'image' field from FormData
app.post('/generate-flashcards', upload.single('image'), async (req, res) => {
    const { notes } = req.body; // Text notes from the form
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
                // 'low' for faster/cheaper processing, 'high' for more detail (more costly)
                detail: "low"
            }
        });
    }

    // Define the core instruction for the AI, appearing last in the content array
    // This tells GPT-4o what to do with the combined text and image input
    messages[0].content.push({
        type: "text",
        text: `You are a helpful AI assistant that generates flashcards from study materials. Analyze the provided text notes and/or image. Identify key concepts, facts, and definitions. For each key piece of information, create one clear question and its corresponding answer. Format the output as a list, where each item is exactly like this: "Q: [Question here]\nA: [Answer here]". Ensure there is a blank line between each flashcard. If no specific concepts are found, create general knowledge questions related to the image/text.`
    });

    try {
        // Make the API call to OpenAI's chat completions endpoint
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // <-- IMPORTANT: Using a multimodal model like GPT-4o for image understanding
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
    console.log(`Server listening at http://localhost:${port}`);
});