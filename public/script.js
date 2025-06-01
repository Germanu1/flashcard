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
        const file = event.target.files[0];
        if (file) {
            imageFileNameSpan.textContent = file.name;
            const reader = new FileReader();

            reader.onload = (e) => {
                uploadedImage.src = e.target.result;
                imagePreviewDiv.classList.remove('hidden');
                clearImageBtn.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            imagePreviewDiv.classList.add('hidden');
            clearImageBtn.classList.add('hidden');
            uploadedImage.src = '#';
            imageFileNameSpan.textContent = '';
        }
    });

    // Event listener for clearing the selected image
    clearImageBtn.addEventListener('click', () => {
        imageUpload.value = '';
        uploadedImage.src = '#';
        imageFileNameSpan.textContent = '';
        imagePreviewDiv.classList.add('hidden');
        clearImageBtn.classList.add('hidden');
    });


    generateBtn.addEventListener('click', async () => {
        const notes = notesInput.value.trim();
        const imageFile = imageUpload.files[0];

        // Validate: ensure at least notes or an image is provided
        if (!notes && !imageFile) {
            errorDiv.textContent = 'Please paste some notes or select an image to generate flashcards.';
            errorDiv.classList.remove('hidden');
            return;
        }

        // Clear previous results and errors
        flashcardsContainer.innerHTML = '';
        errorDiv.classList.add('hidden');
        loadingDiv.classList.remove('hidden');
        generateBtn.disabled = true; // Disable button during processing

        try {
            // Create a FormData object to send both text and file data
            const formData = new FormData();
            if (notes) {
                formData.append('notes', notes);
            }
            if (imageFile) {
                formData.append('image', imageFile);
            }

            // --- THIS IS THE CRITICAL LINE THAT NEEDS TO BE CORRECTED ---
            const response = await fetch(`${BACKEND_BASE_URL}/generate-flashcards`, { // <-- This now correctly uses the BACKEND_BASE_URL
                method: 'POST',
                // IMPORTANT: Do NOT set 'Content-Type': 'application/json' when using FormData.
                // The browser automatically sets it correctly as 'multipart/form-data' header.
                body: formData // Send the FormData object
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Something went wrong on the server.');
            }

            const data = await response.json();

            if (data.flashcards && data.flashcards.length > 0) {
                data.flashcards.forEach(card => {
                    const flashcardDiv = document.createElement('div');
                    flashcardDiv.classList.add('flashcard');

                    // Clean up potential leading/trailing Q:/A: that might be left by AI
                    const questionText = card.question.replace(/^Q: /, '').trim();
                    const answerText = card.answer.replace(/^A: /, '').trim();


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

                    flashcardDiv.addEventListener('click', () => {
                        // Toggle between front and back
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


                    flashcardsContainer.appendChild(flashcardDiv);
                });
            } else {
                errorDiv.textContent = 'No flashcards could be generated from the provided notes/image. Please try different input or more detailed content.';
                errorDiv.classList.remove('hidden');
            }

        } catch (error) {
            console.error('Fetch error:', error);
            errorDiv.textContent = `Error: ${error.message}. Please try again.`;
            errorDiv.classList.remove('hidden');
        } finally {
            loadingDiv.classList.add('hidden');
            generateBtn.disabled = false; // Re-enable button
        }
    });
});