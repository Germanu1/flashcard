// public/script.js

// PASTE YOUR RENDER BACKEND URL HERE:
const BACKEND_BASE_URL = 'https://flashcard-generator-4b1f.onrender.com'; // <--- Make sure this is your actual Render URL!

document.addEventListener('DOMContentLoaded', () => {
    // Get references to all HTML elements
    const notesInput = document.getElementById('notesInput');
    const imageUpload = document.getElementById('imageUpload');
    const imagePreviewDiv = document.getElementById('imagePreview');
    const uploadedImage = document.getElementById('uploadedImage');
    const imageFileNameSpan = document.getElementById('imageFileName');
    const clearImageBtn = document.getElementById('clearImageBtn');

    // NEW: Speech-to-text elements
    const recordBtn = document.getElementById('recordBtn');
    const stopBtn = document.getElementById('stopBtn');
    const recordingStatus = document.getElementById('recordingStatus');
    // END NEW

    const generateBtn = document.getElementById('generateBtn');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const flashcardsContainer = document.getElementById('flashcardsContainer');

    // NEW: Speech-to-text recording logic variables
    let mediaRecorder;
    let audioChunks = [];

    // Function to send audio to backend (moved to correct scope)
    async function sendAudioToBackend(audioBlob) {
        recordingStatus.textContent = 'Transcribing and generating flashcards...';
        loadingDiv.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        flashcardsContainer.innerHTML = ''; // Clear previous results

        const formData = new FormData();
        // Append the audio file with a generic name 'input_file'
        formData.append('input_file', audioBlob, 'recording.webm');

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/generate-flashcards`, { // Use existing endpoint
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get flashcards from backend.');
            }

            const data = await response.json();

            if (data.flashcards && data.flashcards.length > 0) {
                data.flashcards.forEach(card => {
                    const flashcardDiv = document.createElement('div');
                    flashcardDiv.classList.add('flashcard');
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
                    `; // Corrected template literal syntax
                    flashcardDiv.addEventListener('click', () => {
                        const front = flashcardDiv.querySelector('.front');
                        const back = flashcardDiv.querySelector('.back');
                        if (front.classList.contains('hidden')) {
                            front.classList.remove('hidden');
                            back.classList.add('hidden');
                            flashcardDiv.classList.remove('flipped');
                        } else {
                            front.classList.add('hidden');
                            back.classList.remove('hidden');
                            flashcardDiv.classList.add('flipped');
                        }
                    });
                    flashcardsContainer.appendChild(flashcardDiv);
                });
            } else {
                errorDiv.textContent = data.error || 'No flashcards could be generated from the audio. Please try again.';
                errorDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error sending audio or processing response:', error);
            errorDiv.textContent = `Error: ${error.message}. Please try again.`; // Corrected syntax here
            errorDiv.classList.remove('hidden');
        } finally {
            loadingDiv.classList.add('hidden');
            recordingStatus.classList.add('hidden'); // Hide status message
            recordBtn.disabled = false; // Re-enable record button
            stopBtn.disabled = true; // Ensure stop is disabled until recording starts again
            generateBtn.disabled = false; // Re-enable generate button
            notesInput.disabled = false; // Re-enable notes input
            imageUpload.disabled = false; // Re-enable image input
            clearImageBtn.disabled = false; // Re-enable image clear
        }
    }


    recordBtn.addEventListener('click', async () => {
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = []; // Clear previous recordings

            // When audio data is available, push it to chunks
            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            // When recording stops, create a Blob and send it
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); // Use webm for compatibility
                sendAudioToBackend(audioBlob); // Function to send audio to backend
            };

            mediaRecorder.start(); // Start recording
            recordingStatus.textContent = 'Recording... (Click Stop when done)';
            recordingStatus.classList.remove('hidden');
            recordBtn.disabled = true;
            stopBtn.disabled = false;
            generateBtn.disabled = true; // Disable generate while recording
            notesInput.disabled = true; // Disable notes input
            imageUpload.disabled = true; // Disable image input
            clearImageBtn.disabled = true; // Disable image clear
        } catch (error) {
            console.error('Error accessing microphone:', error);
            recordingStatus.textContent = 'Microphone access denied or error. Please check browser permissions.';
            recordingStatus.classList.remove('hidden');
            // Re-enable input options if recording couldn't start
            generateBtn.disabled = false;
            notesInput.disabled = false;
            imageUpload.disabled = false;
            clearImageBtn.disabled = false;
        }
    });

    stopBtn.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            recordingStatus.textContent = 'Processing audio...';
            stopBtn.disabled = true;
            recordBtn.disabled = false; // Will be re-enabled after backend response
            // Generate button enabled after audio processed by sendAudioToBackend
        }
    });

    // Existing image upload and clear logic (ensure no duplicates)
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

    clearImageBtn.addEventListener('click', () => {
        imageUpload.value = '';
        uploadedImage.src = '#';
        imageFileNameSpan.textContent = '';
        imagePreviewDiv.classList.add('hidden');
        clearImageBtn.classList.add('hidden');
    });

    // MODIFIED: generateBtn logic to handle only text/image if no recording is active
    generateBtn.addEventListener('click', async () => {
        // If we're recording, this button shouldn't do anything or should be disabled
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            return; // Don't allow generation while recording
        }

        const notes = notesInput.value.trim();
        const imageFile = imageUpload.files[0];

        if (!notes && !imageFile) {
            errorDiv.textContent = 'Please paste some notes or select an image to generate flashcards.';
            errorDiv.classList.remove('hidden');
            return;
        }

        flashcardsContainer.innerHTML = '';
        errorDiv.classList.add('hidden');
        loadingDiv.classList.remove('hidden');
        generateBtn.disabled = true;
        notesInput.disabled = true; // Disable notes input
        imageUpload.disabled = true; // Disable image input
        clearImageBtn.disabled = true; // Disable image clear

        try {
            const formData = new FormData();
            if (notes) {
                formData.append('notes', notes);
            }
            if (imageFile) {
                formData.append('input_file', imageFile); // Changed from 'image' to 'input_file'
            }

            const response = await fetch(`${BACKEND_BASE_URL}/generate-flashcards`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get flashcards from backend.');
            }

            const data = await response.json();

            if (data.flashcards && data.flashcards.length > 0) {
                data.flashcards.forEach(card => {
                    const flashcardDiv = document.createElement('div');
                    flashcardDiv.classList.add('flashcard');
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
                        const front = flashcardDiv.querySelector('.front');
                        const back = flashcardDiv.querySelector('.back');
                        if (front.classList.contains('hidden')) {
                            front.classList.remove('hidden');
                            back.classList.add('hidden');
                            flashcardDiv.classList.remove('flipped');
                        } else {
                            front.classList.add('hidden');
                            back.classList.remove('hidden');
                            flashcardDiv.classList.add('flipped');
                        }
                    });
                    flashcardsContainer.appendChild(flashcardDiv);
                });
            } else {
                errorDiv.textContent = data.error || 'No flashcards could be generated. Please try again.';
                errorDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            errorDiv.textContent = `Error: ${error.message}. Please try again.`;
            errorDiv.classList.remove('hidden');
        } finally {
            loadingDiv.classList.add('hidden');
            generateBtn.disabled = false;
            notesInput.disabled = false;
            imageUpload.disabled = false;
            clearImageBtn.disabled = false;
        }
    });
});