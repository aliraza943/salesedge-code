# SalesEdge Codebase Overview

This document provides a comprehensive overview of the SalesEdge application's codebase, including its architecture, features, and key components.

## Project Overview

SalesEdge is a mobile-first personal assistant for insurance professionals, designed to streamline their workflow by managing calendar events, RFPs (Requests for Proposal), sales pipelines, and broker relationships. The application is built with a focus on voice-first interaction, allowing users to manage their data through natural language conversations with an AI assistant.

The project consists of a React Native mobile application for iOS and Android, a web-based dashboard for desktop users, and a Node.js backend that provides a tRPC API for data management and AI-powered features.

## Tech Stack

The application is built with a modern tech stack, including:

| Category | Technology | Description |
| :--- | :--- | :--- |
| **Frontend (Mobile)** | React Native, Expo | Cross-platform mobile app development. |
| **Frontend (Web)** | React, Vite | A fast and modern web development build tool. |
| **Backend** | Node.js, Express | A popular and versatile JavaScript runtime and web framework. |
| **API** | tRPC | End-to-end typesafe APIs for TypeScript. |
| **Database** | MySQL (via Drizzle ORM) | A popular open-source relational database. |
| **Styling** | Tailwind CSS, NativeWind | A utility-first CSS framework for rapid UI development. |
| **AI** | Gemini 2.5 Flash | Used for natural language understanding and generation in the chat feature. |
| **Voice Transcription**| Whisper | Used for converting voice input to text. |

## Codebase Architecture

The codebase is organized into a monorepo structure, with the mobile app, web dashboard, and server-side code all contained within the `salesedge-code` directory. The key directories are:

-   `app/`: Contains the React Native mobile application code, built with Expo and Expo Router for navigation.
-   `web-dashboard/`: Contains the React web application for the desktop dashboard.
-   `server/`: Contains the Node.js backend, including the tRPC routers, database schema, and AI integration logic.
-   `drizzle/`: Contains the database schema and migration files for Drizzle ORM.
-   `lib/`: Contains shared code used by both the mobile and web applications, such as the data provider and utility functions.
-   `hooks/`: Contains custom React hooks, such as `useAuth` for authentication.
-   `components/`: Contains reusable React components used throughout the application.

## Key Features

The SalesEdge application offers a rich set of features designed to help insurance professionals manage their daily workflow:

### Home Screen

The home screen provides a dashboard with a quick overview of the user's day, including:

-   A personalized greeting and the current date.
-   A "Today's Attack Plan" card that summarizes the day's events.
-   Quick action buttons for common tasks.
-   Statistics on active RFPs, open deals, and the total pipeline value.
-   Export functionality for generating PDF and Excel reports.

### AI-Powered Chat

The chat screen provides a conversational interface for interacting with the application's data. Users can:

-   Send text messages to the AI assistant.
-   Use voice input for hands-free interaction.
-   Create, update, and query events, RFPs, and deals using natural language.
-   The AI assistant has access to the user's data to provide context-aware responses.

### RFP Management

The RFP screen allows users to track and manage their Requests for Proposal. Key features include:

-   A list of RFPs grouped by status (Draft, Recommended, Sold).
-   The ability to create new RFPs with voice input.
-   A detailed view of each RFP with all its information.
-   The ability to move RFPs through the different stages of the sales process.

### Calendar

The calendar screen provides a visual overview of the user's schedule, with features such as:

-   A month view with indicators for days with events.
-   A list of events for the selected day.
-   The ability to create and edit events.

### Sales Pipeline

The sales screen provides a view of the user's sales pipeline, including:

-   A summary of the total pipeline value, won value, and win rate.
-   A list of deals with their current stage.
-   The ability to add new deals and move them through the sales process.

### Broker Management

The brokers screen allows users to manage their relationships with brokers, with features such as:

-   A list of all brokers with search functionality.
-   A detail screen for each broker with a log of conversation notes.
-   The ability to add new brokers and conversation notes.

## Data Management

SalesEdge uses a "cloud-first" approach to data management, with a central `DataProvider` that acts as a single source of truth for all application data. The data management system is designed to be resilient and work both online and offline:

-   **Cloud Storage**: When the user is authenticated, all data is stored in a MySQL database in the cloud and accessed via the tRPC API.
-   **Local Cache**: The application maintains a local cache of the data using AsyncStorage, which allows for fast initial loads and offline access.
-   **Synchronization**: Data is automatically synchronized between the local cache and the cloud database, ensuring that the user's data is always up-to-date across all their devices.

## AI Integration

AI is a core component of the SalesEdge application, providing a natural and intuitive way for users to interact with their data. The AI integration is handled by the backend, which uses the Gemini 2.5 Flash model for natural language understanding and generation. The key AI-powered features are:

-   **Conversational Chat**: The chat feature allows users to manage their data using natural language. The AI assistant can understand complex requests and perform actions such as creating events, updating RFPs, and querying the user's schedule.
-   **Voice Transcription**: The application uses Whisper for voice transcription, allowing users to dictate information and have it automatically converted to text. This is used in the chat feature for hands-free interaction and in the RFP creation form for quickly filling out fields.

## Web Dashboard

In addition to the mobile application, SalesEdge also provides a web-based dashboard for desktop users. The web dashboard provides a more spacious and comprehensive view of the user's data, with all the same features as the mobile app. The web dashboard is built with React and Vite and communicates with the same backend as the mobile app, ensuring data consistency across both platforms.

## Deployment and Build

The SalesEdge application is built and deployed using modern tools and practices:

-   **Mobile App**: The mobile app is built with Expo, which simplifies the process of building and deploying React Native applications.
-   **Web Dashboard**: The web dashboard is built with Vite, a fast and modern web development build tool.
-   **Backend**: The backend is a standard Node.js application that can be deployed to any cloud platform that supports Node.js.

This overview provides a high-level understanding of the SalesEdge codebase. For more detailed information, please refer to the source code and the `design.md` document in the repository.
