# JARVIS-OS

A cinematic, open-source JARVIS-style HUD powered by the Gemini Live API, featuring real-time vision mode, local OS control backend, and deep voice integration. Designed to look and feel like Iron Man's J.A.R.V.I.S.

Created by **AbdulRahman-T** (AB).

## Features

- **Gemini Live API Integration**: Real-time voice and vision with the deepest, most mature available AI voice (`Charon` as default).
- **Vision Mode**: Accesses webcam to "see" your environment and describe it.
- **Local OS Backend Backend**: Python local server allowing JARVIS to complete desktop requests (e.g. open apps, adjust volume, send notifications, fetch OS stats, move apps between displays).
- **Live Widgets & Tools**: JARVIS can natively fetch the latest World News and real-time Weather.
- **Cinematic UI**: Custom particle orb reacting to audio levels, scanlines, crosshairs, and real-time logs.
- **Persistent Settings**: Customize names, titles, idle timeouts, local backend connections, and more directly from the UI.
- **Responsive Interface**: Settings and visuals resize effectively for different devices.

## Setup Instructions

### 1. Clone the Repository

If you are downloading this for the first time, use `git clone` (do not use `git pull`):

```bash
git clone https://github.com/AbdulRahman-T/JARVIS-OS.git
cd JARVIS-OS
```

### 2. The Frontend (React/Vite)

Run the frontend locally. Since it uses Vite, it works out-of-the-box using normal Node processes.

1. Install dependencies via **npx** and **npm**:
   ```bash
   npm install
   ```

2. Start the application:
   ```bash
   npm run dev
   # Or using npx:
   npx vite
   ```

### 2. Configure Environment Variables

Create a `.env` file in the root of the project (if not present) and add your `GEMINI_API_KEY`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```
*(Get one for free at Google AI Studio)*

> **Note**: This environment variable is for your local deployment. Alternatively, you can use the built-in UI Settings panel on the web interface to input a Custom API Key or switch the API Provider to **OpenRouter** if you prefer running it without environment variables or using an alternative inference provider.

### 4. The Local Backend (OS Control)

To allow the web app to control your computer (opening apps, setting volume), you must run the Python local server.

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Create and activate a Virtual Environment (Highly Recommended to avoid 'externally-managed-environment' errors on macOS/Linux):
   ```bash
   # On macOS/Linux:
   python3 -m venv venv
   source venv/bin/activate
   
   # On Windows:
   python -m venv venv
   venv\Scripts\activate
   ```

3. Install python dependencies:
   ```bash
   # Ensure your virtual environment is activated first!
   pip install -r requirements.txt 
   ```

4. Run the FastAPI server on port 8000:
   ```bash
   # On Windows:
   python main.py
   
   # On macOS/Linux:
   python3 main.py
   ```

### 5. Setting up Ngrok (For tunneling from web to local)

Since modern browsers enforce HTTPS and secure contexts, connecting to `localhost:8000` from an HTTPS hosted frontend often requires a tunnel to bridge the traffic securely.

1. Install **ngrok** on your system (from [ngrok.com](https://ngrok.com)).
2. Expose your local port `8000`:
   ```bash
   ngrok http 8000
   ```
3. Copy the secure Ngrok Forwarding URL (e.g., `https://1234.ngrok-free.app`).
4. Paste it into the **Local Host Link URL** field in the JARVIS Settings UI on the application page.

---
*Built to be open-source, local-controllable, and free.*
