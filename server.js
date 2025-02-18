const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config(); // ✅ Load environment variables from .env

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Use the environment variable instead of hardcoding the connection string
mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000, // Set timeout
}).then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch(err => {
      console.error("❌ MongoDB Connection Error:", err);
      process.exit(1); // Exit if connection fails
  });

let activeCollection = "defaultCollection";

// ✅ Schema for storing metadata of sheets
const metadataSchema = new mongoose.Schema({
    sheetNames: [String],  
});

const Metadata = mongoose.model("TableMetadata", metadataSchema);

// ✅ Set active collection
app.post("/api/setCollection", (req, res) => {
    activeCollection = req.body.collection;
    res.json({ message: `Active collection set to ${activeCollection}` });
});

// ✅ Add new sheet
app.post("/api/addSheet", async (req, res) => {
    const { sheetName } = req.body;

    if (!sheetName) {
        return res.status(400).json({ success: false, message: "Sheet name is required!" });
    }

    try {
        let metadata = await Metadata.findOne();
        if (!metadata) {
            metadata = new Metadata({ sheetNames: [sheetName] });
        } else if (!metadata.sheetNames.includes(sheetName)) {
            metadata.sheetNames.push(sheetName);
        } else {
            return res.json({ success: false, message: "Sheet already exists!" });
        }

        await metadata.save();
        res.json({ success: true, message: "Sheet added successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error adding sheet" });
    }
});

// ✅ Get all available sheets
app.get("/api/getSheets", async (req, res) => {
    try {
        let metadata = await Metadata.findOne();
        res.json({ sheets: metadata ? metadata.sheetNames : [] });
    } catch (error) {
        res.status(500).json({ error: "Error fetching sheets" });
    }
});

// ✅ Define schema for storing table data
const tableSchema = new mongoose.Schema({
    collectionName: String,
    rows: Number,
    columns: Number,
    data: [
        {
            row: Number,
            col: Number,
            value: String,
        },
    ],
});
const TableModel = mongoose.model("SheetData", tableSchema);

// ✅ Fetch table data
app.get("/api/getTable", async (req, res) => {
    try {
        const table = await TableModel.findOne({ collectionName: activeCollection });

        if (!table) {
            return res.json({ metadata: { rows: 5, columns: 5 }, data: [] });
        }

        res.json({ metadata: { rows: table.rows, columns: table.columns }, data: table.data });
    } catch (error) {
        res.status(500).json({ error: "Error fetching table data" });
    }
});

// ✅ Save or update table data
app.post("/api/saveTable", async (req, res) => {
    const { rows, columns, data } = req.body;
    try {
        await TableModel.findOneAndUpdate(
            { collectionName: activeCollection },
            { rows, columns, data },
            { upsert: true }
        );
        res.json({ message: "Table data saved successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error saving table data" });
    }
});

// ✅ DELETE Sheet API
app.delete("/api/deleteSheet", async (req, res) => {
    const { sheetName } = req.body;

    if (!sheetName) {
        return res.status(400).json({ success: false, message: "Sheet name is required!" });
    }

    try {
        // Step 1: Remove sheet name from metadata
        let metadata = await Metadata.findOne();
        if (metadata) {
            metadata.sheetNames = metadata.sheetNames.filter(name => name !== sheetName);
            await metadata.save();
        }

        // Step 2: Delete sheet data from "SheetData" collection
        const deleteResult = await TableModel.deleteOne({ collectionName: sheetName });

        if (deleteResult.deletedCount > 0) {
            res.json({ success: true, message: `Sheet "${sheetName}" deleted successfully.` });
        } else {
            res.status(404).json({ success: false, message: "Sheet not found!" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error", error });
    }
});

// ✅ Default route
app.get("/", (req, res) => {
    res.send("✅ API is running!");
});

// ✅ Export app for Vercel
module.exports = app;
