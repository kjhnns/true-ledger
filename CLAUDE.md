# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

True Ledger (branded as "expensu") is a React Native financial tracking application built with Expo. It parses bank statement PDFs using OpenAI's API, categorizes transactions, and provides analytics on income, expenses, and savings.

## Development Commands

### Running the App
```bash
npm start                # Start with cache clear and tunnel
npx expo start -c        # Alternative: Clear cache and start
npm run android          # Run on Android
npm run ios              # Run on iOS
npm run web              # Run web version
```

### Testing
```bash
npm test                 # Run all tests with Jest (runs in band)
```

### Linting & Building
```bash
npm run lint             # Run ESLint via Expo
npm run deploy           # Deploy staging update via EAS
```

### Installation
```bash
npm install              # Installs dependencies and runs postinstall script
```

Note: The postinstall script (`create-wasm-stub.js`) creates a WASM stub required for the build process.

## Architecture

### Database Layer (SQLite)
- **Core:** `lib/db.ts` manages database initialization, file path handling via SecureStore, and schema setup
- **Schema:** Three main tables:
  - `entities`: Categories (expense/income/savings) and bank accounts with hierarchical support (parent_id)
  - `statements`: Uploaded bank statements with processing status tracking
  - `transactions`: Individual transactions linked to statements with sender/recipient entities
- **Database Location:** Dynamically configurable; path stored in SecureStore (`db-file-path-v1`)
- Default categories are seeded on init from `lib/defaultCategories.ts`

### Entity System
- **Types:** `bank`, `expense`, `income`, `savings` (see `lib/entities.ts`)
- Entities represent both bank accounts and transaction categories
- Hierarchical structure: expense categories can have parent/child relationships
- Each entity has a `prompt` field used to guide OpenAI classification
- Currency is tracked per entity (defaults to USD for categories)

### Statement Processing Flow
1. **Upload:** User selects PDF and bank account (`app/index.tsx`)
2. **Create Statement:** Record created in DB with status='new' (`lib/statements.ts`)
3. **OpenAI Processing:** (`lib/openai.ts`)
   - Upload PDF to OpenAI Files API
   - Create thread with file_search tool
   - Assistant extracts transactions using system prompt + entity list + bank-specific prompt
   - Returns JSON with transactions array
4. **Transaction Creation:** Parsed transactions saved to DB
5. **Status Updates:** Statement progresses through: `new` → `processed` → `reviewed` → `published`

### Transaction Review Workflow
- Transactions start unreviewed (`reviewed_at` is NULL)
- User reviews transactions in statement detail view (`app/statements/[id].tsx`)
- Marking all transactions as reviewed updates statement status to 'reviewed'
- Shared transactions track split amounts for expense sharing

### Analytics (`lib/analytics.ts`)
- **Key Metrics:** Income, expenses, savings, cashflow, savings ratio, split credit
- **Time Scoping:** Uses `lib/timeScope.ts` for date range calculations (month, quarter, year, all-time)
- **Aggregations:** Expense summaries by parent category, transaction counts by bank
- **Export:** CSV export with camelCase entity keys for reviewed transactions

### OpenAI Integration
- **Files:** `lib/openai.ts` handles Assistant API with file_search
- **Prompts:** System prompt template + entity list + bank-specific prompts
- **Learning:** `learnFromTransactions()` generates improved bank prompts from example transactions
- **Keys:** API key stored in SecureStore (`openai_api_key`)
- **Assistant:** Created on-demand and ID persisted (`openai_assistant_id`)

### Routing (Expo Router)
- File-based routing in `app/` directory
- Main tabs: Import (`index.tsx`), Analysis (`analysis.tsx`), Settings (`settings.tsx`)
- Dynamic routes: `/statements/[id]`, `/bank-accounts/[id]`
- Intent filter configured for PDF sharing on Android (see `app.json`)

### UI Framework
- **Library:** react-native-paper with custom theme (`app/theme.ts`)
- **Layout:** Root layout in `app/_layout.tsx` wraps app in PaperProvider
- **Navigation:** Bottom navigation for main tabs, stack navigation for detail views
- **Modals:** Upload modal with two screens (form + processing), Learn modal for prompt refinement

## Key Files

- `lib/db.ts`: Database initialization and connection management
- `lib/entities.ts`: CRUD operations for banks and categories
- `lib/statements.ts`: Statement lifecycle management
- `lib/transactions.ts`: Transaction CRUD with review tracking
- `lib/openai.ts`: OpenAI API integration for PDF parsing
- `lib/analytics.ts`: Financial calculations and CSV export
- `app/index.tsx`: Main app shell with bottom navigation
- `app/statements/[id].tsx`: Transaction review interface

## Testing

- **Framework:** Jest with ts-jest preset
- **Location:** `__tests__/` directory
- **Mocking:** SQLite mocked via `test-utils/sqliteMock.ts`
- **Coverage:** DB operations, analytics, OpenAI processing, UI components
- **Config:** `jest.config.js` - ESM support, node environment

## Database Management

The app supports local database file management:
- View current DB path in Settings
- Import/export database files via `app/local-db.tsx`
- Database file can be changed at runtime (closes old connection, opens new)
- Delete database via settings (recreates with fresh schema)

## Babel Configuration

IMPORTANT: `babel.config.js` must maintain exact plugin order:
1. `expo-router/babel` (for file-based routing)
2. `react-native-reanimated/plugin` (MUST be last)

Violating this order causes bundling failures. If you encounter Babel errors, verify this order and clear Metro cache with `npx expo start -c`.

## Platform-Specific Notes

- **Android:** Intent filter enables "Share to expensu" for PDF files
- **iOS:** Bundle identifier: `com.johannesklumpe.expensu`
- **Web:** Metro bundler with static output
- **New Architecture:** Enabled (`newArchEnabled: true` in `app.json`)
