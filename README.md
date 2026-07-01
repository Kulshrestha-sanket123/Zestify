# Zestify 🎵

Zestify is a full-stack web-based music streaming application designed to provide a seamless, Spotify-like listening experience. It features real-time audio controls, dynamic playlist management, and synchronized lyrics support.

---

### 🌐 Live Demo
Check out the live version of Zestify here: https://zestify-backend-ts1c.onrender.com/

---

## 🚀 Features

* **Real-time Audio Streaming**: Smooth playback control using the native HTML Audio API.
* **Dynamic UI**: Interactive song cards with real-time visualization powered by the Canvas API.
* **Lyrics Support**: An integrated lyrics panel that updates dynamically with the active track.
* **Playlist Management**: Users can create, organize, and manage their personal music collections.
* **Responsive Design**: Optimized layout providing a consistent experience across all screen sizes.
* **Secure Session Management**: Reliable user authentication and session handling for a personalized experience.

## 🛠️ Tech Stack

* **Frontend**: HTML5, CSS3, JavaScript (ES6+), Canvas API, HTML Audio API
* **Backend**: Node.js, Express.js
* **Database**: MongoDB
* **Tools**: Git/GitHub, VS Code

## 🧠 Challenges & Solutions

* **UI/Database Synchronization**: Syncing the database state with the UI for song card visualization was challenging. I solved this by implementing an efficient state management pattern that triggers UI updates upon successful database queries.
* **Footer Control Syncing**: Aligning the global footer audio controls with individual song card interactions required complex event delegation. I structured the DOM events to ensure a "single source of truth" for the audio state.

## 📈 Key Learnings

This project significantly improved my technical skills in:
* **Session Management**: Implementing secure and persistent user sessions within an Express.js environment.
* **Data Handling**: Managing asynchronous data flow between the MongoDB database and the client-side frontend.
* **DOM Manipulation**: Utilizing advanced techniques for dynamic UI updates based on real-time audio playback progress.

## 👨‍💻 Author

Sanket Kulshrestha

Computer Science Engineering Student | Full-Stack Developer

GitHub: https://github.com/Kulshrestha-sanket123

LinkedIn: https://www.linkedin.com/in/sanket-kulshrestha-739108292/

Developed with passion for music and code.

## ⚙️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/Kulshrestha-sanket123/Zestify.git](https://github.com/Kulshrestha-sanket123/Zestify.git)
   cd Zestify
