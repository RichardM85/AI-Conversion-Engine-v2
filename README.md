# AI Conversion Engine

A simple React MVP landing page and real AI analysis flow for an AI Conversion Engine SaaS concept.

## Features

- Premium SaaS-style landing page
- URL input field with `Analyze Page` CTA
- Loading state after submit
- Real AI-powered result screen
- Before and after comparison
- Original and optimized headline/CTA
- Three key improvement points

## Tech

- React
- Vite
- Local Node API server
- OpenAI or OpenRouter

## Environment Setup

Create a `.env` file in the project root.

Example:

```bash
OPENAI_API_KEY=your_openai_key_here
OPENAI_MODEL=gpt-4.1-mini
```

Or with OpenRouter:

```bash
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=openai/gpt-4.1-mini
```

## Getting Started

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in your terminal.

## Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```text
ai-conversion-engine/
  index.html
  package.json
  vite.config.js
  server.js
  .env.example
  .gitignore
  README.md
  src/
    main.jsx
    App.jsx
    styles.css
```

## Notes

- The frontend sends the URL, audience, and brand voice to `/api/analyze`.
- The local API fetches the product page, extracts visible content, and asks an LLM for optimized copy.
- You need a valid API key for OpenAI or OpenRouter before analysis will work.
