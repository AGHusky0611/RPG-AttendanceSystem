// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC50Ija28AsLBHSp-EuoLeG-JbmNMV3dZE",
    authDomain: "rpg-attendance.firebaseapp.com",
    projectId: "rpg-attendance",
    storageBucket: "rpg-attendance.appspot.com",
    messagingSenderId: "323974864826",
    appId: "1:323974864826:web:77e8380ee6ead6fb290783",
    measurementId: "G-9RF29JB7R2"
};

// Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Data store for all students
const studentData = new Map();
let currentStudent = null;

/**
 * Parses CSV text into the studentData Map.
 * @param {string} text The raw CSV text.
 * @param {number} idCol The column index for the SLU ID.
 * @param {number} nameCol The column index for the Name.
 * @param {boolean} isOfficerList A flag to handle the different CSV formats.
 */
function parseCsv(text, idCol, nameCol, isOfficerList = false) {
    const lines = text.split('\n').slice(3); // Skip header lines
    for (const line of lines) {
        const columns = line.split(',');
        if (columns.length > Math.max(idCol, nameCol)) {
            let id = columns[idCol]?.trim();
            const name = columns[nameCol]?.trim().replace(/"/g, '');

            if (isOfficerList && id.includes('@')) {
                id = id.split('@')[0]; // Extract ID from email
            }

            if (id && name && /^\d+$/.test(id)) { // Ensure ID is a number
                studentData.set(id, name);
            }
        }
    }
}

/**
 * Fetches and loads all student data from the CSV files.
 */
async function loadStudentData() {
    try {
        // Correctly fetch and parse the Officers list
        const officerResponse = await fetch('res/OfficersList.csv');
        const officerText = await officerResponse.text();
        // For OfficersList.csv: ID is in email (col 3), Name is in col 0
        parseCsv(officerText, 3, 0, true);

        // Correctly fetch and parse the Members list
        const memberResponse = await fetch('res/MembersList.csv');
        const memberText = await memberResponse.text();
        // For MembersList.csv: ID is in col 2, Name is in col 1
        parseCsv(memberText, 2, 1);

        console.log(`Loaded ${studentData.size} students.`);
    } catch (error) {
        console.error("Error loading student data:", error);
        alert("Failed to load student lists. Please check the file paths.");
    }
}

// DOM Elements
const idInput = document.getElementById('id-input');
const confirmationArea = document.getElementById('confirmation-area');
const studentNameEl = document.getElementById('student-name');
const statusMessageEl = document.getElementById('status-message');
const presentButton = document.getElementById('present-button');

// Modal Elements
const guestModal = document.getElementById('guest-modal');
const guestNameInput = document.getElementById('guest-name-input');
const confirmGuestButton = document.getElementById('confirm-guest-button');
const cancelGuestButton = document.getElementById('cancel-guest-button');
let guestIdToRegister = null;


idInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        const enteredId = idInput.value.trim();
        statusMessageEl.textContent = ''; // Clear previous messages

        // Validate input
        if (enteredId === '') {
            statusMessageEl.textContent = 'Please enter your SLU ID.';
            return; // Stop if input is empty
        }
        if (!/^\d+$/.test(enteredId)) {
            statusMessageEl.textContent = 'SLU ID must contain only numbers.';
            idInput.value = ''; // Clear the invalid input
            return; // Stop if input is not a number
        }

        if (studentData.has(enteredId)) {
            const name = studentData.get(enteredId);
            currentStudent = { id: enteredId, name: name };
            studentNameEl.textContent = name;
            confirmationArea.style.display = 'block';
        } else {
            // Handle unregistered members with custom modal
            currentStudent = null;
            confirmationArea.style.display = 'none';
            guestIdToRegister = enteredId; // Store ID temporarily
            guestModal.style.display = 'flex'; // Show the modal
            guestNameInput.focus();
        }
    }
});

confirmGuestButton.addEventListener('click', () => {
    const guestName = guestNameInput.value.trim();
    if (guestIdToRegister && guestName) {
        registerGuest(guestIdToRegister, guestName); // Pass the name here
        guestModal.style.display = 'none';
        guestIdToRegister = null;
        guestNameInput.value = '';
    } else {
        alert('Please enter your name.');
    }
});

cancelGuestButton.addEventListener('click', () => {
    guestModal.style.display = 'none';
    statusMessageEl.textContent = 'Registration cancelled.';
    idInput.value = '';
    idInput.focus();
    guestIdToRegister = null;
    guestNameInput.value = '';
});

/**
 * Adds a new guest record to the 'guests' collection in Firestore.
 * @param {string} guestId The ID of the guest to add.
 * @param {string} guestName The name of the guest.
 */
async function registerGuest(guestId, guestName) { // Receive guestName as a parameter
    if (!guestId || !guestName) return;

    statusMessageEl.textContent = 'Registering guest...';
    try {
        const guestRef = doc(db, 'guests', guestId);
        // Add the 'name' field to the object being saved
        await setDoc(guestRef, {
            slu_id: guestId,
            name: guestName,
            timestamp: serverTimestamp()
        });
        
        statusMessageEl.textContent = `Welcome, ${guestName}! You are registered as a guest.`;
    } catch (error) {
        console.error("Error writing guest document: ", error);
        statusMessageEl.textContent = 'Error registering guest. Please try again.';
    } finally {
        // Reset UI
        idInput.value = '';
        idInput.focus();
    }
}

presentButton.addEventListener('click', async () => {
    if (!currentStudent) return;

    statusMessageEl.textContent = 'Marking present...';
    try {
        const attendanceRef = doc(db, 'attendance', currentStudent.id);
        await setDoc(attendanceRef, {
            name: currentStudent.name,
            slu_id: currentStudent.id,
            timestamp: serverTimestamp()
        });
        
        statusMessageEl.textContent = `Welcome, ${currentStudent.name}! You are marked present.`;
    } catch (error) {
        console.error("Error writing document: ", error);
        statusMessageEl.textContent = 'Error saving attendance. Please try again.';
    } finally {
        // Reset UI
        idInput.value = '';
        currentStudent = null;
        confirmationArea.style.display = 'none';
        idInput.focus();
    }
});


// Load data when the script runs
loadStudentData();