# HireLoop Server

Backend REST API for **HireLoop**, a job portal and recruitment platform built with Express, MongoDB, and Stripe. It provides role-based access control for job seekers, recruiters, and administrators, along with job management, application tracking, and Stripe Checkout payment verification for premium accounts.

---

## Tech Stack

- **Runtime:** Node.js (ES Modules)
- **Framework:** [Express 5](https://expressjs.com/)
- **Database:** [MongoDB](https://www.mongodb.com/) (official Node.js driver)
- **Payments:** [Stripe](https://stripe.com/)
- **Middleware & Config:** `cors`, `dotenv`

---

## Project Structure

```text
hireloop-server/
├── index.js          # Express app, MongoDB connection, middleware, and API routes
├── package.json      # Project metadata and dependencies
├── .gitignore        # Ignored files (node_modules, .env, .vercel)
└── README.md         # Project documentation
```

---

## Getting Started

### Prerequisites

- **Node.js** (v18+ recommended)
- **MongoDB** database (local instance or MongoDB Atlas)
- **Stripe** account and secret API key

### Installation

1. **Clone the repository:**

   ```bash
   git clone <your-repository-url>
   cd hireloop-server
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment variables:**

   Create a `.env` file in the root directory and add the following variables:

   ```env
   PORT=8000
   MONGODB_URI=your_mongodb_connection_string
   STRIPE_SECRET_KEY=your_stripe_secret_key
   ```

   | Variable | Required | Default | Description |
   | --- | --- | --- | --- |
   | `PORT` | No | `8000` | Port the Express server listens on |
   | `MONGODB_URI` | Yes | — | MongoDB connection URI (connects to the `hireloopdb` database) |
   | `STRIPE_SECRET_KEY` | Yes | — | Stripe secret key used to verify Checkout sessions |

4. **Run the server:**

   ```bash
   node index.js
   ```

   The server will start on `http://localhost:8000` (or the port specified in `PORT`).

---

## Database Collections

The server connects to the `hireloopdb` MongoDB database and uses the following collections:

- `user` — User accounts, roles (`seeker`, `recruiter`, `admin`), and `premium` status
- `session` — Active bearer authentication tokens mapped to `userId`
- `jobs` — Job postings created by recruiters
- `applications` — Job applications submitted by seekers
- `payments` — Verified Stripe payment records

---

## Authentication & Authorization

Protected endpoints require a Bearer token in the `Authorization` header:

```http
Authorization: Bearer <token>
```

Tokens are validated against the `session` collection, and the associated user is loaded from `user`. Role-based access is enforced via middleware:

- **Seeker (`seeker`)** — Can submit job applications
- **Recruiter (`recruiter`)** — Can create job postings and view applications for their own jobs
- **Admin (`admin`)** — Can view all users, update user roles, and view applications for any job

---

## API Endpoints

### Health Check

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/` | Public | Verifies the server is running |

### Users

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/users` | Bearer + `admin` | Retrieve all users |
| `GET` | `/users/:id/premium` | Public | Check whether a user has `premium` status |
| `PATCH` | `/users/:id/role` | Bearer + `admin` | Update a user's role (`{ "role": "..." }`) |

### Jobs

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/jobs` | Bearer + `recruiter` | Create a new job posting |
| `GET` | `/jobs` | Public | List jobs with optional query filters (`jobType`, `isRemote`, `category`, `recruiterId`, `search`) |
| `GET` | `/jobs/:id` | Public | Get details for a single job by ID |
| `DELETE` | `/jobs/:id` | Public | Delete a job by ID |

> **Search & Filtering (`GET /jobs`):**
> - `jobType` — Filter by job type
> - `isRemote` — Filter by remote status (`true` / `false`)
> - `category` — Filter by job category
> - `recruiterId` — Filter by recruiter ID
> - `search` — Case-insensitive regex search across `title`, `companyName`, `responsibilities`, and `requirements`

### Applications

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/applications` | Bearer + `seeker` | Submit a new job application |
| `GET` | `/applications` | Bearer | List applications sorted by `appliedAt` descending (supports `userId` and `jobId` query params; `jobId` requires the job's recruiter or an `admin`) |
| `GET` | `/applications/count` | Public | Get total application count (supports optional `userId` query param) |
| `PATCH` | `/applications/:id` | Public | Update an application's status (`{ "status": "..." }`) |

### Payments

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/payments/checkout-verify` | Public | Verify a Stripe Checkout `sessionId`, record the payment, and upgrade the user (`metadata.userId`) to `premium: true` |

**Example request body for `POST /payments/checkout-verify`:**

```json
{
  "sessionId": "cs_test_..."
}
```

---

## Deployment

The project includes `.vercel` configuration and exports the Express `app` as the default export from `index.js`, making it compatible with serverless deployments such as Vercel as well as standard Node.js hosting.

---

## License

This project is licensed under the **ISC** License.
