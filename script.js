document.addEventListener('DOMContentLoaded', () => {
    const notesInput = document.getElementById('notesInput');
    const imageUpload = document.getElementById('imageUpload'); // <-- ADDED: New image input element
    const imagePreviewDiv = document.getElementById('imagePreview'); // <-- ADDED: Image preview container
    const uploadedImage = document.getElementById('uploadedImage'); // <-- ADDED: <img> tag for preview
    const imageFileNameSpan = document.getElementById('imageFileName'); // <-- ADDED: Span for file name
    const clearImageBtn = document.getElementById('clearImageBtn'); // <-- ADDED: Clear image button

    const generateBtn = document.getElementById('generateBtn');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const flashcardsContainer = document.getElementById('flashcardsContainer');

    // ADDED: Event listener for image upload to show preview
    imageUpload.addEventListener('change', (event) => {
        const file = event.target.files[0]; // Get the selected file
        if (file) {
            imageFileNameSpan.textContent = file.name; // Display file name
            const reader = new FileReader(); // Create a FileReader to read the file

            reader.onload = (e) => {
                uploadedImage.src = e.target.result; // Set the image source for preview
                imagePreviewDiv.classList.remove('hidden'); // Show the preview container
                clearImageBtn.classList.remove('hidden'); // Show the clear button
            };
            reader.readAsDataURL(file); // Read the file as a Data URL (Base64) for display
        } else {
            // If no file is selected (e.g., user cancels), hide preview
            imagePreviewDiv.classList.add('hidden');
            clearImageBtn.classList.add('hidden');
            uploadedImage.src = '#'; // Clear preview image
            imageFileNameSpan.textContent = ''; // Clear file name
        }
    });

    // ADDED: Event listener for clearing the selected image
    clearImageBtn.addEventListener('click', () => {
        imageUpload.value = ''; // Clear the file input's selected file
        uploadedImage.src = '#'; // Clear the image preview
        imageFileNameSpan.textContent = ''; // Clear the file name display
        imagePreviewDiv.classList.add('hidden'); // Hide the preview container
        clearImageBtn.classList.add('hidden'); // Hide the clear button
    });


    generateBtn.addEventListener('click', async () => {
        const notes = notesInput.value.trim();
        const imageFile = imageUpload.files[0]; // <-- ADDED: Get the selected image file

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
            // <-- MODIFIED: Using FormData to send both text and files -->
            const formData = new FormData();
            if (notes) {
                formData.append('notes', notes); // Append text notes to FormData
            }
            if (imageFile) {
                formData.append('image', imageFile); // Append the image file to FormData
            }

            const response = await fetch('/generate-flashcards', {
                method: 'POST',
                // IMPORTANT: Do NOT set 'Content-Type': 'application/json' when using FormData.
                // The browser automatically sets the correct 'multipart/form-data' header.
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