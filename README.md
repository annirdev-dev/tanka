# Tanka

Fuel price comparison app for Portugal, built on the [API Aberta](https://apiaberta.pt/) fuel prices endpoint (data sourced from DGEG).

## Structure

- `app/` — Expo (React Native + TypeScript) mobile app, backend via Supabase Edge Functions

## Getting started

1. Register a free API key at https://apiaberta.pt/dados/combustivel
2. App:
   ```bash
   cd app
   cp .env.example .env   # fill in API_ABERTA_KEY and Supabase values
   npm install
   npx expo start
   ```
