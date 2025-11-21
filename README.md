<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1sHRE4WYr2F_BDFG_d1ooPexIBSs4BPCH

## Run Locally

**Prerequisites:**  Node.js (v16 or higher)

### Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API Keys:**

   Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your API keys:
   ```
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   TRANSCRIPT_API_KEY=your_transcript_api_key_here  # Optional - fallback APIs available
   ```

   **Where to get API keys:**
   - **Gemini API Key** (REQUIRED): Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - **Transcript API Key** (OPTIONAL): Get from [TranscriptAPI.com](https://www.transcriptapi.com/)
     - Note: The app has free fallback transcript APIs, so this is optional for testing

3. **Run the development server:**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`

### Troubleshooting

**Issue: "GEMINI_API_KEY is not configured"**
- Make sure you created a `.env` file (not `.env.txt` or any other name)
- Verify your API key is valid and not expired
- Restart the dev server after adding the API key

**Issue: "Transcript is fetched but clips are not generated"**
- This usually means the Gemini API key is missing or invalid
- Check the browser console for detailed error messages
- Verify your `.env` file has `GEMINI_API_KEY=...` with a valid key

## Deploy to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard:
   - `GEMINI_API_KEY` - Your Gemini API key (REQUIRED)
   - `TRANSCRIPT_API_KEY` - Your Transcript API key (OPTIONAL)
4. Deploy!
