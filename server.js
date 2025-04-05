/**
 * Urban Planning Advisor - Enhanced Backend Server
 * Express server that handles image uploads and AI-powered urban analysis with incremental visualization
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  analyzeUrbanSpace,
  visualizeUrbanImprovements,
} = require("./utils/urbanPlannerAnalyzer");
require("dotenv").config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `upload-${uniqueSuffix}${ext}`);
  },
});

// Configure multer for file uploads
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
      return cb(new Error("Only JPG, JPEG, and PNG files are allowed"));
    }
    cb(null, true);
  },
});

// Serve static files from public directory
app.use(express.static("public"));
app.use(express.json());

// Create directories for results if they don't exist
const resultsDir = path.join(__dirname, "public", "results");
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

// API endpoint for urban space analysis and improvement
app.post(
  "/api/analyze-urban-space",
  upload.single("image"),
  async (req, res) => {
    try {
      // Check if image was uploaded
      if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
      }

      // Check if incremental visualization is requested
      const incremental = req.query.incremental === "true";
      console.log(
        `Incremental visualization: ${incremental ? "enabled" : "disabled"}`,
      );

      // Set paths for input and output
      const imagePath = req.file.path;
      const timestamp = Date.now();

      try {
        // Step 1: Analyze the urban space
        console.log("Starting urban space analysis...");
        const analysis = await analyzeUrbanSpace(imagePath);

        // Step 2: Generate visualization based on analysis
        console.log("Generating urban improvement visualization...");
        const visualizationResult = await visualizeUrbanImprovements(
          imagePath,
          analysis,
          resultsDir,
          incremental,
        );

        // Ensure the incremental image paths are correctly formatted
        if (
          visualizationResult.incrementalImages &&
          visualizationResult.incrementalImages.length > 0
        ) {
          // Log all generated images for debugging
          console.log(
            "Generated incremental images:",
            visualizationResult.incrementalImages,
          );

          // Convert all paths to URL format
          const incrementalImageUrls =
            visualizationResult.incrementalImages.map(
              (filename) => `/results/${path.basename(filename)}`,
            );

          console.log("Formatted image URLs:", incrementalImageUrls);

          // Return the analysis results with properly formatted URLs
          return res.json({
            success: true,
            analysis: analysis,
            imageUrl: `/results/${path.basename(visualizationResult.finalImagePath)}`,
            incrementalImages: incrementalImageUrls,
            incrementalChanges: visualizationResult.incrementalChanges,
          });
        } else {
          // No incremental images, just return the final image
          console.log(
            "No incremental images generated, returning final image only",
          );

          return res.json({
            success: true,
            analysis: analysis,
            imageUrl: `/results/${path.basename(visualizationResult.finalImagePath)}`,
            incrementalImages: [
              `/results/${path.basename(visualizationResult.finalImagePath)}`,
            ],
            incrementalChanges: visualizationResult.incrementalChanges,
          });
        }
      } catch (error) {
        console.error("Error processing request:", error);

        // Attempt to clean up any temporary files in case of error
        try {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        } catch (cleanupError) {
          console.warn("Error cleaning up temp file:", cleanupError);
        }

        res.status(500).json({
          error: "Failed to process urban space image",
          details: error.message,
        });
      }
    } catch (error) {
      console.error("Error processing request:", error);
      res.status(500).json({
        error: "Failed to process urban space image",
        details: error.message,
      });
    }
  },
);

// Set a cleanup interval to remove old files (every hour)
setInterval(
  () => {
    try {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      // Clean up uploads directory
      if (fs.existsSync(path.join(__dirname, "uploads"))) {
        fs.readdirSync(path.join(__dirname, "uploads")).forEach((file) => {
          const filePath = path.join(__dirname, "uploads", file);
          const stats = fs.statSync(filePath);

          if (stats.mtimeMs < oneHourAgo) {
            fs.unlinkSync(filePath);
            console.log(`Cleaned up old upload: ${filePath}`);
          }
        });
      }

      // Clean up results directory
      if (fs.existsSync(resultsDir)) {
        fs.readdirSync(resultsDir).forEach((file) => {
          const filePath = path.join(resultsDir, file);
          const stats = fs.statSync(filePath);

          if (stats.mtimeMs < oneHourAgo) {
            fs.unlinkSync(filePath);
            console.log(`Cleaned up old result: ${filePath}`);
          }
        });
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  },
  60 * 60 * 1000,
); // Run every hour

// Start the server
app.listen(PORT, () => {
  console.log(`Urban Planning Advisor running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
