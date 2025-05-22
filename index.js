const express = require("express");
const axios = require("axios");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const apiUrl = "https://api.nobitex.ir/market/stats?dstCurrency=usdt";

// Helper: create table if it doesn't exist
async function ensureTable(tableName) {
  const query = `
    CREATE TABLE IF NOT EXISTS "${tableName}" (
      id SERIAL PRIMARY KEY,
      price NUMERIC,
      date DATE,
      time TIME
    )
  `;
  await pool.query(query);
}

// Fetch and store function
async function fetchAndStore() {
  try {
    const apiResponse = await axios.get(apiUrl);
    const stats = apiResponse.data.stats;

    if (!stats || typeof stats !== "object") {
      console.log("No stats object in response");
      return;
    }

    const now = new Date();
    const date = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const time = now.toTimeString().slice(0, 8); // "HH:MM:SS"

    for (const [key, value] of Object.entries(stats)) {
      if (value.isClosed == false) {
        // Ensure the table exists
        await ensureTable(key);
        // Insert row
        await pool.query(
          `INSERT INTO "${key}" (price, date, time) VALUES ($1, $2, $3)`,
          [value.latest, date, time]
        );
      }
    }
    console.log("data added")
  } catch (error) {
    console.error("Error in fetchAndStore:", error.toString());
  }
}

// Run every 15 seconds
setInterval(fetchAndStore, 15000);

app.use(async (req, res) => {
  try {
    await axios.get('https://keep-alive-server-vioa.onrender.com/callback');
    console.log("Hello! The server received your request and notified the remote server.");
  } catch (error) {
    console.log("Hello! The server received your request (Failed to notify remote server).");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
