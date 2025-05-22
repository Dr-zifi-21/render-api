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
    console.log("Before API");
    const apiResponse = await axios.get(apiUrl);
    const stats = apiResponse.data.stats;
    console.log("After API");

    if (!stats || typeof stats !== "object") {
      console.log("No stats object in response");
      return;
    }

    const now = new Date();
    const date = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const time = now.toTimeString().slice(0, 8); // "HH:MM:SS"

    console.log("Before for loop");
    for (const [key, value] of Object.entries(stats)) {
      console.log("Before if statement");
      if (value.isClosed == false) {
        console.log("Inside if statement");
        // Ensure the table exists
        await ensureTable(key);
        console.log("After ensureTable");
        // Insert row
        await pool.query(
          `INSERT INTO "${key}" (price, date, time) VALUES ($1, $2, $3)`,
          [value.latest, date, time]
        );
        console.log("After insert query");
      }
      console.log("After if statement");
    }
    console.log("After for loop");
  } catch (error) {
    console.error("Error in fetchAndStore:", error.toString());
  }
}

// Run every 15 seconds
setInterval(fetchAndStore, 15000);

app.get("/", (req, res) => res.send("Stats API poller is running!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
