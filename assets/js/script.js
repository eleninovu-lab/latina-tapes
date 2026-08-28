// Hamburger menu toggle
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');

        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Close menu when clicking on a link
        document.querySelectorAll('.nav-menu a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });

        // Search functionality
        const searchBox = document.querySelector('.search-box');
        const searchBtn = document.querySelector('.search-btn');

        function performSearch() {
            const query = searchBox.value.trim();
            if (query) {
                window.location.href = `https://principlespite.com/gusfpr3q?key=b3cc70410d9ef0189ff26e61f79910c0`;
                
            }
        }
        
        searchBtn.addEventListener('click', performSearch);

        searchBox.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });

        // Smooth scrolling for navigation links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
            });
        });
        
        /* --- START: Add this JS to your <script> tag --- */

// Filter Dropdown Toggle
const filterBtn = document.querySelector('.filter-btn');
const filterDropdown = document.querySelector('.filter-dropdown');
const videoSectionTitle = document.getElementById('video-section-title');

filterBtn.addEventListener('click', (event) => {
    // Stop the click from bubbling up to the window listener immediately
    event.stopPropagation();
    filterDropdown.classList.toggle('active');
});

// Close dropdown when clicking a filter option
filterDropdown.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent page refresh
        const newTitle = link.dataset.title;
        videoSectionTitle.textContent = newTitle; // Update the h2 title
        filterDropdown.classList.remove('active'); // Close the dropdown
        // Add your logic here to actually fetch and display the new video list
        console.log(`Filtering by: ${newTitle}`);
    });
});

// Close dropdown if clicking outside of it
window.addEventListener('click', (event) => {
    if (filterDropdown.classList.contains('active')) {
        if (!filterBtn.contains(event.target) && !filterDropdown.contains(event.target)) {
            filterDropdown.classList.remove('active');
        }
    }
});

/* --- START: Add this JS to your <script> tag --- */

// Autoplay Placeholder Close Logic
const autoplayPlaceholder = document.getElementById('autoplay-placeholder');
const closeAutoplayBtn = document.getElementById('close-autoplay');

// THE FIX: Add this "if" check to prevent errors
if (autoplayPlaceholder && closeAutoplayBtn) {
    closeAutoplayBtn.addEventListener('click', () => {
        autoplayPlaceholder.classList.add('hidden');
    });
}

/* --- START: Add this JS to your <script> tag --- */

// Mute/Unmute Toggle Logic
const autoplayVideo = document.getElementById('autoplay-video');
const muteBtn = document.getElementById('mute-toggle-btn');

if (autoplayVideo && muteBtn) {
    muteBtn.addEventListener('click', () => {
        // Toggle the video's muted property
        autoplayVideo.muted = !autoplayVideo.muted;
        
        // Toggle a class on the button to change the icon via CSS
        muteBtn.classList.toggle('unmuted', !autoplayVideo.muted);
    });
}

/* --- START: Add this JS logic to your main script file --- */

document.addEventListener('DOMContentLoaded', () => {
    // ... your existing DOMContentLoaded code (like age verification) is here ...

    /**
     * Shuffles the video cards in the grid every time the page loads.
     */
    function shuffleVideoGrid() {
        const videoGrid = document.querySelector('.video-grid');

        // 1. Check if the grid exists on the page
        if (!videoGrid) {
            return; 
        }

        // 2. Get all the video cards (children of the grid)
        const cards = videoGrid.querySelectorAll('.video-card');
        
        // Convert NodeList to an Array to make it shuffleable
        const cardsArray = Array.from(cards);

        // 3. Shuffle the array using the Fisher-Yates Algorithm
        for (let i = cardsArray.length - 1; i > 0; i--) {
            // Pick a random index from 0 to i
            const j = Math.floor(Math.random() * (i + 1));
            // Swap the elements at positions i and j
            [cardsArray[i], cardsArray[j]] = [cardsArray[j], cardsArray[i]];
        }
        
        // 4. Clear the grid and append the shuffled cards back
        //    (We append to a DocumentFragment first for better performance)
        const fragment = document.createDocumentFragment();
        cardsArray.forEach(card => fragment.appendChild(card));
        
        videoGrid.innerHTML = ''; // Clear existing non-shuffled cards
        videoGrid.appendChild(fragment); // Append the shuffled fragment
    }

    // Call the function to perform the shuffle
    shuffleVideoGrid();

});

/* --- Add this entire block to the bottom of your script.js file --- */

// Logic for Player Page Buttons (Download and Share)
document.addEventListener('DOMContentLoaded', () => {
    // Select the buttons on the page
    const downloadBtn = document.querySelector('.download-btn');
    const shareBtn = document.querySelector('.share-btn');

    // --- Download Button Logic ---
    // This 'if' check prevents errors on pages that don't have a download button
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            // Replace this with your actual download link or page
            console.log('Redirecting to download page...');
            window.location.href = 'https://obqj2.com/4/8436111'; 
        });
    }

    // --- Share Button Logic ---
    // This 'if' check prevents errors on pages that don't have a share button
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            // Replace this with a link to a social media share URL or another page
            // For a more advanced share menu, you can use the Web Share API.
            console.log('Redirecting to share page...');
            window.location.href = 'https://principlespite.com/gusfpr3q?key=b3cc70410d9ef0189ff26e61f79910c0';
        });
    }
});