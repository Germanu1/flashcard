// public/script.js

// PASTE YOUR RENDER BACKEND URL HERE:
// This is the URL that Render provides for your deployed backend service (e.g., 'https://my-flashcard-backend-xyz1.onrender.com')
const BACKEND_BASE_URL = 'https://flashcard-generator-4b1f.onrender.com'; // <--- Make sure this is your actual Render URL!

document.addEventListener('DOMContentLoaded', () => {
    // Get references to all HTML elements
    const notesInput = document.getElementById('notesInput');
    const imageUpload = document.getElementById('imageUpload');
    const imagePreviewDiv = document.getElementById('imagePreview');
    const uploadedImage = document.getElementById('uploadedImage');
    const imageFileNameSpan = document.getElementById('imageFileName');
    const clearImageBtn = document.getElementById('clearImageBtn');

    const generateBtn = document.getElementById('generateBtn');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const flashcardsContainer = document.getElementById('flashcardsContainer');

    // Event listener for image upload to show a preview
    imageUpload.addEventListener('change', (event) => {
        const file = event.target.files[0]; // Get the selected file
        if (file) {
            imageFileNameSpan.textContent = file.name; // Display the file's name
            const reader = new FileReader(); // Create a FileReader object to read file content

            reader.onload = (e) => {
                uploadedImage.src = e.target.result; // Set the <img> source to the loaded file (for preview)
                imagePreviewDiv.classList.remove('hidden'); // Make the preview container visible
                clearImageBtn.classList.remove('hidden'); // Make the clear button visible
            };
            reader.readAsDataURL(file); // Read the file content as a Data URL (Base64 encoded)
        } else {
            // If no file is selected (e.g., user cancels file dialog), hide preview elements
            imagePreviewDiv.classList.add('hidden');
            clearImageBtn.classList.add('hidden');
            uploadedImage.src = '#'; // Clear the <img> source
            imageFileNameSpan.textContent = ''; // Clear the file name display
        }
    });

    // Event listener for clearing the selected image
    clearImageBtn.addEventListener('click', () => {
        imageUpload.value = ''; // Clear the file input's selected file
        uploadedImage.src = '#'; // Clear the image preview
        imageFileNameSpan.textContent = ''; // Clear the file name display
        imagePreviewDiv.classList.add('hidden'); // Hide the preview container
        clearImageBtn.classList.add('hidden'); // Hide the clear button
    });


    // Event listener for the "Generate Flashcards" button click
    generateBtn.addEventListener('click', async () => {
        const notes = notesInput.value.trim(); // Get text from the notes input, trimmed
        const imageFile = imageUpload.files[0]; // Get the selected image file (if any)

        // Basic validation: User must provide either notes or an image
        if (!notes && !imageFile) {
            errorDiv.textContent = 'Please paste some notes or select an image to generate flashcards.';
            errorDiv.classList.remove('hidden'); // Show the error message
            return; // Stop execution
        }

        // Clear previous results and error messages
        flashcardsContainer.innerHTML = ''; // Clear any existing flashcards
        errorDiv.classList.add('hidden'); // Hide previous error messages
        loadingDiv.classList.remove('hidden'); // Show loading indicator
        generateBtn.disabled = true; // Disable the button to prevent multiple submissions

        try {
            // Create a FormData object to send both text and file data
            const formData = new FormData();
            if (notes) {
                formData.append('notes', notes); // Append text notes to FormData
            }
            if (imageFile) {
                formData.append('image', imageFile); // Append the image file to FormData
            }

            // Make the HTTP POST request to your backend server
            // THIS IS THE CRITICAL LINE calling your Render backend
            const response = await fetch(`${BACKEND_BASE_URL}/generate-flashcards`, {
                method: 'POST',
                // IMPORTANT: Do NOT set 'Content-Type' header here.
                // The browser automatically sets it correctly as 'multipart/form-data' when using FormData.
                body: formData // Send the FormData object as the request body
            });

            // Check if the response was successful (HTTP status code 200-299)
            if (!response.ok) {
                const errorData = await response.json(); // Parse error response from backend
                throw new Error(errorData.error || 'Something went wrong on the server.');
            }

            const data = await response.json(); // Parse the successful JSON response from backend

            // Check if flashcards were generated and display them
            if (data.flashcards && data.flashcards.length > 0) {
                data.flashcards.forEach(card => {
                    const flashcardDiv = document.createElement('div');
                    flashcardDiv.classList.add('flashcard');

                    // Clean up potential leading/trailing "Q: " and "A: " from AI output
                    const questionText = card.question.replace(/^Q: /, '').trim();
                    const answerText = card.answer.replace(/^A: /, '').trim();

                    // Populate the flashcard HTML
                    flashcardDiv.innerHTML = `
                        <div class="flashcard-content front">
                            <h3>Question:</h3>
                            <p>${questionText}</p>
                        </div>
                        <div class="flashcard-content back hidden">
                            <h3>Answer:</h3>
                            <p>${answerText}</p>
                        </div>
                    `;

                    // Add click listener to flip the flashcard
                    flashcardDiv.addEventListener('click', () => {
                        const front = flashcardDiv.querySelector('.front');
                        const back = flashcardDiv.querySelector('.back');

                        if (front.classList.contains('hidden')) { // Currently showing back, flip to front
                            front.classList.remove('hidden');
                            back.classList.add('hidden');
                            flashcardDiv.classList.remove('flipped');
                        } else { // Currently showing front, flip to back
                            front.classList.add('hidden');
                            back.classList.remove('hidden');
                            flashcardDiv.classList.add('flipped');
                        }
                    });

                    flashcardsContainer.appendChild(flashcardDiv); // Add the flashcard to the container
                });
            } else {
                // If no flashcards were returned, display an appropriate message
                errorDiv.textContent = 'No flashcards could be generated from the provided notes/image. Please try different input or more detailed content.';
                errorDiv.classList.remove('hidden');
            }

        } catch (error) {
            console.error('Fetch error:', error); // Log any network or server errors
            errorDiv.textContent = `Error: ${error.message}. Please try again.`; // Display user-friendly error
            errorDiv.classList.remove('hidden');
        } finally {
            loadingDiv.classList.add('hidden'); // Hide loading indicator
            generateBtn.disabled = false; // Re-enable the button
        }
    });
});