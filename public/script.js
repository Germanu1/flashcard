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

    // Speech-to-text elements
    const recordBtn = document.getElementById('recordBtn');
    const stopBtn = document.getElementById('stopBtn');
    const recordingStatus = document.getElementById('recordingStatus');

    const generateBtn = document.getElementById('generateBtn');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const flashcardsContainer = document.getElementById('flashcardsContainer');

    // Auth elements
    const authSection = document.getElementById('authSection');
    const appContent = document.getElementById('appContent'); // Div that holds the main app content
    const authUsername = document.getElementById('authUsername');
    const authPassword = document.getElementById('authPassword');
    const registerBtn = document.getElementById('registerBtn');
    const loginBtn = document.getElementById('loginBtn');
    const signOutBtn = document.getElementById('signOutBtn'); // NEW SIGN OUT BUTTON REFERENCE
    const authMessage = document.getElementById('authMessage');
    const trialStatus = document.getElementById('trialStatus'); // Reference to trial status element

    // Speech-to-text recording logic variables
    let mediaRecorder;
    let audioChunks = [];

    // Function to send audio to backend (correctly scoped within DOMContentLoaded)
    async function sendAudioToBackend(audioBlob) {
        recordingStatus.textContent = 'Transcribing and generating flashcards...';
        loadingDiv.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        flashcardsContainer.innerHTML = ''; // Clear previous results

        const formData = new FormData();
        formData.append('input_file', audioBlob, 'recording.webm');

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/generate-flashcards`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(data.error || 'Failed to get flashcards from backend.');
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
                errorDiv.textContent = data.error || 'No flashcards could be generated from the audio. Please try again.';
                errorDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error sending audio or processing response:', error);
            errorDiv.textContent = `Error: ${error.message}. Please try again.`;
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
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                sendAudioToBackend(audioBlob);
            };

            mediaRecorder.start();
            recordingStatus.textContent = 'Recording... (Click Stop when done)';
            recordingStatus.classList.remove('hidden');
            recordBtn.disabled = true;
            stopBtn.disabled = false;
            generateBtn.disabled = true;
            notesInput.disabled = true;
            imageUpload.disabled = true;
            clearImageBtn.disabled = true;
        } catch (error) {
            console.error('Error accessing microphone:', error);
            recordingStatus.textContent = 'Microphone access denied or error. Please check browser permissions.';
            recordingStatus.classList.remove('hidden');
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
            recordBtn.disabled = false;
        }
    });

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

    generateBtn.addEventListener('click', async () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            return;
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
        notesInput.disabled = true;
        imageUpload.disabled = true;
        clearImageBtn.disabled = true;

        try {
            const formData = new FormData();
            if (notes) {
                formData.append('notes', notes);
            }
            if (imageFile) {
                formData.append('input_file', imageFile);
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

    // NEW: Auth logic
    // Function to get user data (add this outside DOMContentLoaded if you want, or just paste it in script.js)
    async function getUserData() {
        const token = localStorage.getItem('token');
        if (!token) return null;
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/user-status`, { // You'll create this endpoint next
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                 // If token is invalid or expired, clear it
                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem('token');
                }
                throw new Error('Failed to fetch user status.');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching user status:', error);
            return null;
        }
    }

    async function checkAuth() { // Make checkAuth async
        const token = localStorage.getItem('token');
        if (token) {
            const userData = await getUserData(); // Fetch user data
            if (userData) {
                authSection.classList.add('hidden');
                appContent.classList.remove('hidden');
                authMessage.textContent = ''; // Clear any previous auth messages

                const now = new Date();
                const trialEnd = new Date(userData.trialEndDate);

                if (userData.isSubscribed) {
                    trialStatus.textContent = 'You are a premium subscriber!';
                    trialStatus.style.color = 'green';
                } else if (trialEnd > now) {
                    const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
                    trialStatus.textContent = `Your free trial ends in ${daysLeft} days.`;
                    trialStatus.style.color = 'blue';
                } else {
                    trialStatus.textContent = 'Your free trial has ended. Please subscribe to continue.';
                    trialStatus.style.color = 'red';
                    generateBtn.disabled = true; // Disable if trial ended
                }
                trialStatus.classList.remove('hidden'); // Make trial status visible
            } else { // Token exists but failed validation/fetch (e.g., token invalid or expired on server)
                // getUserData already removed token if 401/403, so just hide app and show auth
                authSection.classList.remove('hidden'); // Show auth section
                appContent.classList.add('hidden'); // Hide app content
                trialStatus.classList.add('hidden'); // Hide trial status
            }
        } else { // No token found
            authSection.classList.remove('hidden');
            appContent.classList.add('hidden');
            trialStatus.classList.add('hidden');
        }
    }

    registerBtn.addEventListener('click', async () => {
        const username = authUsername.value;
        const password = authPassword.value;
        authMessage.textContent = '';
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Registration failed.');
            authMessage.textContent = 'Registration successful! You can now log in.';
            authMessage.style.color = 'green';
        } catch (error) {
            authMessage.textContent = `Registration error: ${error.message}`;
            authMessage.style.color = 'red';
        }
    });

    loginBtn.addEventListener('click', async () => {
        const username = authUsername.value;
        const password = authPassword.value;
        authMessage.textContent = '';
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Login failed.');
            localStorage.setItem('token', data.token); // Store the JWT token
            checkAuth(); // Show the app content
        } catch (error) {
            authMessage.textContent = `Login error: ${error.message}`;
            authMessage.style.color = 'red';
        }
    });

    // Sign Out Button Listener
    signOutBtn.addEventListener('click', () => {
        localStorage.removeItem('token'); // Remove the JWT token
        checkAuth(); // Re-run auth check to show login/register form
        authMessage.textContent = 'You have been signed out.';
        authMessage.style.color = 'green';
    });

    // Call checkAuth on page load
    checkAuth();

    // Intercept all fetch requests to add the Authorization header
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = args[0];
        const options = args[1] || {};
        
        // Only add token for requests to our own backend
        if (url.startsWith(BACKEND_BASE_URL)) {
            const token = localStorage.getItem('token');
            if (token) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${token}`
                };
            }
        }
        return originalFetch.apply(this, args);
    };
});