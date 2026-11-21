import express from "express";
import cors from "cors";
import "dotenv/config";
import Stripe from "stripe";

const app = express();
const port = process.env.PORT || 8000;

app.use(express.json());
app.use(cors());
import { MongoClient, ObjectId } from "mongodb";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const client = new MongoClient(process.env.MONGODB_URI);

const myLogger = async (req, res, next) => {
  console.log("now hitting api: ", req.url, req.headers);
  next();
};

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const connectedClient = await connectToMongoDB();
console.log(connectedClient);

const db = connectedClient.db("hireloopdb");
const users = db.collection("user");
const sessions = db.collection("session");
const jobs = db.collection("jobs");
const applications = db.collection("applications");
const payments = db.collection("payments");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res
      .status(401)
      .json({ message: "Unauthorized", error: "Token not found" });
  }
  const query = { token };
  const session = await sessions.findOne(query);
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const userId = session.userId;
  const userQuery = { _id: new ObjectId(userId) };
  const user = await users.findOne(userQuery);
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  req.user = user;
  next();
};

// must call after verifyToken
const verifySeeker = async (req, res, next) => {
  if (req.user.role !== "seeker") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

const verifyRecruiter = async (req, res, next) => {
  if (req.user.role !== "recruiter") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

const verifyAdmin = async (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

// users related APIS
app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const data = await users.find().toArray();
    res.send(data);
  } catch (error) {
    console.error("Error fetching all users:", error);
    res.status(500).json({ message: "Failed to fetch all users" });
  }
});

app.get("/users/:id/premium", async (req, res) => {
  const { id } = req.params;
  const result = await users.findOne(
    { _id: new ObjectId(id) },
    { projection: { premium: 1 } },
  );
  res.send(result);
});

app.patch("/users/:id/role", verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const result = await users.updateOne(
    { _id: new ObjectId(id) },
    { $set: { role: req.body.role } },
  );
  res.send(result);
});

app.post("/jobs", verifyToken, verifyRecruiter, async (req, res) => {
  try {
    const job = req.body;
    const result = await jobs.insertOne(job);
    res.status(201).send(result);
  } catch (error) {
    console.error("Error inserting job:", error);
    res.status(500).json({ message: "Failed to create job" });
  }
});

app.get("/jobs", async (req, res) => {
  try {
    const query = {};
    console.log("Query : ", req.query);
    if (req.query) {
      if (req.query.jobType) {
        query.jobType = req.query.jobType;
      }
      if (req.query.isRemote) {
        query.isRemote = req.query.isRemote === "true";
      }
      if (req.query.category) {
        query.category = req.query.category;
      }
      if (req.query.recruiterId) {
        query.recruiterId = req.query.recruiterId;
      }

      if (req.query.search) {
        query.$or = [
          { title: { $regex: req.query.search, $options: "i" } },
          { companyName: { $regex: req.query.search, $options: "i" } },
          { responsibilities: { $regex: req.query.search, $options: "i" } },
          { requirements: { $regex: req.query.search, $options: "i" } },
        ];
      }
    }
    const job = await jobs.find(query).toArray();
    res.send(job);
  } catch (error) {
    console.error("Error fetching all jobs:", error);
    res.status(500).json({ message: "Failed to fetch all jobs" });
  }
});

app.get("/jobs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid job ID" });
    }
    const job = await jobs.findOne({ _id: new ObjectId(id) });
    if (!job) {
      return res.status(404).send({ message: "Job not found" });
    }
    res.send(job);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch job details" });
  }
});

app.delete("/jobs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await jobs.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    console.error("Error deleting jobs:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// application related apis
app.post("/applications", verifyToken, verifySeeker, async (req, res) => {
  try {
    const application = req.body;
    const result = await applications.insertOne(application);
    res.status(201).send(result);
  } catch (error) {
    console.error("Error inserting applications:", error);
    res.status(500).json({ message: "Failed to create applcations" });
  }
});

app.get("/applications", verifyToken, async (req, res) => {
  // console.log("headers on the server: ", req.headers);
  try {
    const query = {};

    if (req.query.userId) {
      query.userId = req.query.userId;
    }
    if (req.query.jobId) {
      const jobQuery = { _id: new ObjectId(req.query.jobId) };
      const job = await jobs.findOne(jobQuery);
      if (
        job.recruiterId !== req.user._id.toString() &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({ message: "Forbidden" });
      }
      query.jobId = req.query.jobId;
    }

    const application = await applications
      .find(query)
      .sort({ appliedAt: -1 })
      .toArray();

    res.send(application);
  } catch (error) {
    console.error("Error fetching all applications:", error);
    res.status(500).json({ message: "Failed to fetch all applications" });
  }
});

app.get("/applications/count", async (req, res) => {
  try {
    const query = {};

    if (req.query.userId) {
      query.userId = req.query.userId;
    }
    const result = await applications.countDocuments(query);
    res.send({ count: result });
  } catch (error) {
    console.error("Error fetching all applications:", error);
    res.status(500).json({ message: "Failed to fetch all applications" });
  }
});

app.patch("/applications/:id", async (req, res) => {
  const { id } = req.params;
  const result = await applications.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: req.body.status } },
  );
  res.send(result);
});

// payment related apis
app.post("/payments/checkout-verify", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.send({ success: false, message: "Sesion id is required!" });
  }
  const { status, payment_status, customer_email, metadata, payment_intent } =
    await stripe.checkout.sessions.retrieve(sessionId);

  // 1. is used new session
  // 2. check if the session id for the currently logged in user
  // 2. insert sessionId to the payment collection
  // 4. update user info as a premium user

  if (status === "complete" && payment_status === "paid") {
    const sessionQuery = { sessionId };
    const existingPayment = await payments.findOne(sessionQuery);
    if (existingPayment) {
      return res.send({ success: false, message: "Payment already verified!" });
    }

    const payment = {
      sessionId,
      status,
      payment_status,
      customer_email,
      userId: metadata.userId,
      payment_date: new Date(),
      payment_intent,
    };
    const result = await payments.insertOne(payment);

    // update the user table
    const query = { _id: new ObjectId(metadata.userId) };

    const updatedDoc = {
      $set: {
        premium: true,
      },
    };
    const updatedResult = await users.updateOne(query, updatedDoc);
    res.send({ success: true, result, updatedResult });
    return;
  }
  res.send({ success: false, message: "Payment verification is failed" });
});

app.get("/", (req, res) => {
  res.send("Hello Limon! Your server is running fine!");
});

app.listen(port, () => {
  console.log(`Limons server on port ${port}`);
});
