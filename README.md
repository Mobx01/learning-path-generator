# Learning Path Generator

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](#) [![Version](https://img.shields.io/badge/version-1.0.0-blue)](#) [![License](https://img.shields.io/badge/license-MIT-blue)](#)

The Learning Path Generator is a full-stack application designed to create and visualize structured educational journeys. It utilizes a Python backend equipped with AI expansion services to structure topics, while a Next.js frontend renders these topics into interactive learning graphs. This tool is intended for learners and educators seeking a visual, structured approach to mastering new subjects.

## Table of Contents
- [Tech Stack](#tech-stack)
- [Visuals](#visuals)
- [Installation and Setup](#installation-and-setup)
- [Usage Examples](#usage-examples)
- [Time Complexity](#time-complexity)
- [Data Pipeline](#data-pipeline)
- [Project Architecture](#project-architecture)
- [Contributing](#contributing)
- [Changelog](#changelog)
- [License](#license)
- [Contact and Support](#contact-and-support)

## Tech Stack
* **Language:** Python for the backend and TypeScript for the frontend.
* **Framework:** Next.js utilizing the App Router for the frontend interface.
* **Database & Caching:** Supabase for persistent storage and Redis for fast, volatile memory caching.
* **Authentication:** NextAuth is implemented for user session management.
* **Tools:** Node.js package manager (npm) for the frontend and `pip` (via `requirements.txt`) for the backend.

## Installation and Setup

### Prerequisites
Ensure you have the following installed on your local machine:
* Node.js for running the Next.js frontend.
* Python for executing the backend services.
* Redis server running locally or accessible via URL.

### Step-by-Step Installation

1. Clone the repository:
   ```bash
   git clone [https://github.com/yourusername/learning-path-generator.git](https://github.com/yourusername/learning-path-generator.git)
   cd learning-path-generator
   ```

2. Configure and start the Backend:
   Navigate to the backend directory, install dependencies, and run the main server.
   ```bash
   cd backend
   pip install -r requirements.txt
   python main.py
   ```

3. Configure and start the Frontend:
   Open a new terminal, navigate to the frontend directory, install packages, and start the development server.
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Usage Examples

Below are common commands and examples of how the system processes data.

**Frontend Component Integration:**
```tsx
// Example of rendering the core graph component in the frontend
import { LearningPathGraph } from '../components/LearningPathGraph';

export default function PathViewer() {
  return (
    <div>
      <h1>Your Learning Path</h1>
      <LearningPathGraph data="{generatedPathData}"/>
    </div>
  );
}
```

**Backend API Structure:**
```python
# Example of backend routing structure based on the repository
from routes import generator, topics, users

app.include_router(generator.router)
app.include_router(topics.router)
app.include_router(users.router)
```

## Time Complexity
* **Path Generation Algorithm:** O(V + E) where V is the number of topics and E is the dependencies.
* **Graph Rendering:** O(N) for standard node layout passes.
* **Data Retrieval (Redis):** O(1) average time complexity for cached structure lookups.

## Data Pipeline
<img width="1024" height="559" alt="image" src="https://github.com/user-attachments/assets/06b95d5f-9afd-4f13-a3ea-865405449c7d" />

The application implements a three-tier data retrieval strategy to optimize performance and minimize latency:
1. **Redis (Primary Cache):** The system first queries Redis, utilizing its fast, volatile memory to retrieve recently accessed or saved learning structures.
2. **Supabase (Persistent Storage):** If a cache miss occurs in Redis, the pipeline falls back to querying the Supabase database for the requested data.
3. **API Generation (Fallback):** If the data exists in neither Redis nor Supabase, a live API call is executed as a final fallback to generate or fetch the required content.

## Project Architecture
The repository is structured into two main directories to separate concerns:
* `/backend` - Contains the Python API, database configurations (`database.py`), data models, routing (`generator.py`, `topics.py`, `users.py`), and core services like AI expansion and graph processing.
* `/frontend` - Contains the Next.js application, featuring the `LearningPathGraph` UI component, NextAuth integration for user security, and global styling.

## Contributing

We welcome contributions to improve this project. To contribute:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/your-feature-name`).
3. Ensure your code follows the established conventions.
4. Commit your changes (`git commit -m 'Add some feature'`).
5. Push to the branch (`git push origin feature/your-feature-name`).
6. Open a Pull Request.

Please report bugs or request features by opening an issue in the GitHub issue tracker.

## License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.

