const express = require("express");
require("dotenv").config();
const app = express();
const path = require("path");
const port = process.env.PORT;
const pg = require("pg");

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client
  .connect()
  .then(() => {
    console.log("Connected to database");
  })
  .catch((err) => {
    console.log("Error connecting to database", err);
  });

app.use(express.json());

app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname + "/index.html"));
});

app.get("/questions", async function (req, res) {
  try {
    const result = await client.query(`
    SELECT 
      (SELECT count(true) FROM public.answers WHERE is_correct IS TRUE) as score,
      (SELECT count(true) FROM answers) as answers_total,
      (
        SELECT
          questions.uuid
        FROM questions
        WHERE
          questions.uuid NOT IN (
            SELECT question_uuid FROM answers
          )
        LIMIT 1
      ) as question_index,
      (SELECT COALESCE(array_to_json(array_agg(row_to_json(array_row))),'[]'::json) FROM (
        SELECT
          questions.uuid,
          questions.question,
          questions.option_a,
          questions.option_b,
          questions.option_c,
          questions.option_d
        FROM questions
      ) array_row) as questions;
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).send("Failed to retrieve questions");
  }
});

app.put("/reset", async function (req, res) {
  try {
    await client.query(`TRUNCATE answers;`);

    const data = await client.query(`
    SELECT 
      (SELECT count(true) FROM public.answers WHERE is_correct IS TRUE) as score,
      (SELECT count(true) FROM public.answers) as answers_total,
      (
        SELECT
          questions.uuid
        FROM questions
        WHERE
          questions.uuid NOT IN (
            SELECT question_uuid FROM answers
          )
        LIMIT 1
      ) as question_index`);
    res.json(data.rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).send("Failed to retrieve questions");
  }
});

app.put("/submit", async function (req, res) {
  var question_uuid = req.body.question_uuid;
  var choice = req.body.choice.toUpperCase();

  const data = await client.query(
    `
  SELECT correct_answer FROM public.questions WHERE uuid = $1
  `,
    [question_uuid]
  );

  const is_correct = data.rows[0].correct_answer === choice;
  console.log("is_correct", data.rows[0], choice, is_correct);

  try {
    await client.query(
      `
      INSERT INTO public.answers (question_uuid,choice,is_correct) VALUES ($1, $2,$3)`,
      [question_uuid, choice, is_correct]
    );

    const data = await client.query(`
    SELECT 
      (SELECT count(true) FROM public.answers WHERE is_correct IS TRUE) as score,
      (SELECT count(true) FROM public.answers) as answers_total,
      (
        SELECT
          questions.uuid
        FROM questions
        WHERE
          questions.uuid NOT IN (
            SELECT question_uuid FROM answers
          )
        LIMIT 1
      ) as question_index`);
    res.json(data.rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).send("Failed to record answer");
  }
});

app.put("/submit", async function (req, res) {
  try {
    console.log(req.body);
    // const asd = await client.query(
    //   `SELECT correct_answer FROM questions WHERE uuid = $1`,
    //   [question_uuid]
    // );
    const result = await client.query(
      `INSERT INTO answers (question_uuid, choice, is_correct) VALUES ($1, $2, $3)`,
      [req.body.question_uuid, req.body.choice, true]
    );

    const data = await client.query(`
      (SELECT count(true) FROM answers) as answers_total,
      SELECT (
        SELECT 
        questions.uuid
        FROM questions
        WHERE
          questions.uuid NOT IN (
            SELECT question_uuid FROM answers
          )
            LIMIT 1
      ) as question_index
    `);
    res.json(data.rows[0]);
  } catch (err) {
    console.log("Error submitting data", err);
    res.status(500).send("Error submitting data");
  }
});

app.get("/style.css", function (req, res) {
  res.sendFile(path.join(__dirname + "/style.css"));
});

app.get("/app.js", function (req, res) {
  res.sendFile(path.join(__dirname + "/app.js"));
});

console.log(`PLANNING TO USE PORT: ${port}`);
app.listen(port, "0.0.0.0", () => console.log(`Listening on port ${port}!`));
