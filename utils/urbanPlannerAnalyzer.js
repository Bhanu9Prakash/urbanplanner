/**
 * Enhanced Urban Planning Image Analyzer Utility
 * Uses Google Generative AI to analyze urban spaces and suggest incremental improvements
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Analyze an urban space image and generate improvement suggestions
 * @param {string} inputImagePath - Path to the uploaded image
 * @returns {Promise<Object>} - Analysis results and recommended improvements
 */
async function analyzeUrbanSpace(inputImagePath) {
  try {
    // Read the input image as base64
    const imageData = fs.readFileSync(inputImagePath);
    const imageBase64 = imageData.toString("base64");
    const mimeType = getMimeType(inputImagePath);

    // Initialize the Gemini reasoning model
    const thinkingModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-thinking-exp", // Reasoning-focused model
      generationConfig: {
        temperature: 0.2, // Lower temperature for more analytical responses
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048,
      },
    });

    // Create prompt parts with the image
    const analysisPrompt = createUrbanAnalysisPrompt();
    const promptParts = [
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
      { text: analysisPrompt },
    ];

    console.log("Analyzing urban space image...");

    // Generate the urban planning analysis
    const response = await thinkingModel.generateContent(promptParts);
    const analysisText = response.response.text();

    // Parse the analysis to extract structured data
    const parsedAnalysis = parseAnalysisResponse(analysisText);

    return parsedAnalysis;
  } catch (error) {
    console.error("Error analyzing urban space:", error);
    throw error;
  }
}

/**
 * Generate an improved version of an urban space based on analysis with incremental changes
 * @param {string} inputImagePath - Path to the uploaded image
 * @param {Object} analysis - The urban planning analysis results
 * @param {string} outputDir - Directory to save the enhanced images
 * @param {boolean} incremental - Whether to generate incremental changes
 * @returns {Promise<Object>} - Details about the improvements and image paths
 */
async function visualizeUrbanImprovements(
  inputImagePath,
  analysis,
  outputDir,
  incremental = false,
) {
  try {
    // Read the input image as base64
    const imageData = fs.readFileSync(inputImagePath);
    const imageBase64 = imageData.toString("base64");
    const mimeType = getMimeType(inputImagePath);

    // Prepare result object
    const timestamp = Date.now();
    const result = {
      finalImagePath: path.join(outputDir, `improved-${timestamp}.png`),
      incrementalImages: [],
      incrementalChanges: [],
    };

    // Initialize the model with image generation capabilities
    const imageModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp", // Image generation model
      generationConfig: {
        responseModalities: ["Text", "Image"],
        temperature: 0.7, // Higher temperature for more creative results
        topP: 1,
        topK: 32,
      },
    });

    if (
      incremental &&
      analysis.improvement_recommendations &&
      analysis.improvement_recommendations.length > 0
    ) {
      // Generate incremental changes by applying one recommendation at a time
      console.log("Generating incremental urban improvements...");

      // Create incremental changes data
      const recommendations = analysis.improvement_recommendations;

      // Prepare the base image to be modified
      let currentImageBase64 = imageBase64;
      let currentImagePath = inputImagePath;

      // Process each recommendation incrementally
      for (let i = 0; i < recommendations.length; i++) {
        const rec = recommendations[i];

        // Create a focused prompt for this specific improvement
        const incrementalPrompt = createIncrementalPrompt(
          rec,
          i + 1,
          recommendations.length,
        );

        // Create prompt parts with the current image
        const promptParts = [
          {
            inlineData: {
              mimeType,
              data: currentImageBase64,
            },
          },
          { text: incrementalPrompt },
        ];

        // Generate the improved image for this specific change
        console.log(
          `Generating improvement ${i + 1}/${recommendations.length}: ${rec.category}`,
        );
        const response = await imageModel.generateContent(promptParts);

        // Process the response to extract the generated image
        let imageGenerated = false;

        for (const part of response.response.candidates[0].content.parts) {
          if (part.inlineData) {
            // Save the incremental image
            const incrementalImagePath = path.join(
              outputDir,
              `improved-${timestamp}-step-${i + 1}.png`,
            );
            const generatedImageData = part.inlineData.data;
            const buffer = Buffer.from(generatedImageData, "base64");
            fs.writeFileSync(incrementalImagePath, buffer);

            // Update for the next iteration
            currentImageBase64 = generatedImageData;
            currentImagePath = incrementalImagePath;

            // Add to results
            result.incrementalImages.push(incrementalImagePath);
            result.incrementalChanges.push({
              id: i,
              category: rec.category,
              description: rec.recommendation,
              benefits: rec.expected_benefits,
            });

            imageGenerated = true;
            console.log(
              `Incremental improvement ${i + 1} saved to ${incrementalImagePath}`,
            );

            // If this is the final improvement, save it as the final image too
            if (i === recommendations.length - 1) {
              fs.copyFileSync(incrementalImagePath, result.finalImagePath);
            }
          }
        }

        if (!imageGenerated) {
          console.warn(
            `No image was generated for incremental improvement ${i + 1}`,
          );
        }
      }

      // If no incremental images were generated, fall back to the non-incremental approach
      if (result.incrementalImages.length === 0) {
        console.log("Falling back to non-incremental approach...");
        return await generateFinalImage(
          imageModel,
          imageBase64,
          mimeType,
          analysis,
          result.finalImagePath,
        );
      }

      return result;
    } else {
      // Generate a single final image with all improvements
      console.log("Generating final urban improvement visualization...");
      return await generateFinalImage(
        imageModel,
        imageBase64,
        mimeType,
        analysis,
        result.finalImagePath,
      );
    }
  } catch (error) {
    console.error("Error generating urban improvement visualization:", error);
    throw error;
  }
}

/**
 * Generate the final image with all improvements
 * @param {Object} imageModel - The initialized model
 * @param {string} imageBase64 - Base64 image data
 * @param {string} mimeType - Image MIME type
 * @param {Object} analysis - Analysis data
 * @param {string} outputPath - Where to save the image
 * @returns {Promise<Object>} - Result object
 */
async function generateFinalImage(
  imageModel,
  imageBase64,
  mimeType,
  analysis,
  outputPath,
) {
  // Create a generation prompt based on the analysis
  const visualizationPrompt = createVisualizationPrompt(analysis);

  // Create prompt parts with the image
  const promptParts = [
    {
      inlineData: {
        mimeType,
        data: imageBase64,
      },
    },
    { text: visualizationPrompt },
  ];

  // Generate the improved urban space image
  const response = await imageModel.generateContent(promptParts);

  // Process the response to extract the generated image
  let imageGenerated = false;

  for (const part of response.response.candidates[0].content.parts) {
    if (part.inlineData) {
      const generatedImageData = part.inlineData.data;
      const buffer = Buffer.from(generatedImageData, "base64");
      fs.writeFileSync(outputPath, buffer);
      imageGenerated = true;
      console.log(`Improved urban design image saved to ${outputPath}`);
    }
  }

  if (!imageGenerated) {
    throw new Error("No image was generated in the response");
  }

  return {
    finalImagePath: outputPath,
    incrementalImages: [outputPath],
    incrementalChanges: analysis.improvement_recommendations.map((rec, i) => ({
      id: i,
      category: rec.category,
      description: rec.recommendation,
      benefits: rec.expected_benefits,
    })),
  };
}

/**
 * Create a detailed prompt for urban space analysis
 * @returns {string} - Analysis prompt
 */
function createUrbanAnalysisPrompt() {
  return `As an expert urban planner, analyze this urban space in detail and identify areas for improvement.

Please respond in the following JSON format structure:
{
  "current_assessment": {
    "overall_description": "Brief description of the urban space",
    "identified_issues": [
      {
        "category": "One of: Walkability, Transportation, Public Space, Greenery, Safety, Accessibility, Infrastructure, or Other",
        "details": "Detailed description of the issue"
      },
      ...
    ]
  },
  "improvement_recommendations": [
    {
      "category": "Same categories as above",
      "recommendation": "Specific improvement recommendation",
      "expected_benefits": "Expected benefits of this change"
    },
    ...
  ],
  "urban_planning_principles": [
    "List of 3-5 key urban planning principles that would improve this space"
  ]
}

Focus on practical improvements that could realistically be implemented and would significantly enhance the livability, sustainability, and functionality of this urban space. Consider walkability, public transportation access, green spaces, community gathering areas, safety features, and accessibility.

Important: Limit the recommendations to 3-5 key improvements that would have the most impact. For each recommendation, be specific and actionable.`;
}

/**
 * Create a prompt for an incremental improvement
 * @param {Object} recommendation - The specific recommendation to implement
 * @param {number} stepNumber - The current step number
 * @param {number} totalSteps - Total number of steps
 * @returns {string} - Incremental visualization prompt
 */
function createIncrementalPrompt(recommendation, stepNumber, totalSteps) {
  return `You are a skilled urban planner and architectural visualizer. I need you to make ONE SPECIFIC CHANGE to this urban space image.

IMPROVEMENT (${stepNumber} of ${totalSteps}): ${recommendation.category}
${recommendation.recommendation}

CRITICAL REQUIREMENTS:
1. Make ONLY this ONE specific change to the image. Do not add any other improvements.
2. Keep the image photorealistic - not a sketch, drawing or cartoon.
3. Maintain the EXACT same perspective, angle, scale, and composition as the original.
4. Preserve all buildings, people, vehicles, and infrastructure EXCEPT for the specific area you are improving.
5. Maintain all lighting conditions, weather, and time of day exactly as in the original.
6. Make the change VISUALLY OBVIOUS - ensure it's clearly visible what has been improved.
7. Avoid adding text, labels, or annotations to the image.

The goal is to show incremental, realistic improvements that could actually be implemented. This will be part of a sequence showing step-by-step enhancements, so it's crucial that ONLY the specified change is made while everything else remains identical to the previous image.

Generate a photorealistic visualization showing ONLY this specific urban improvement implemented in the space.`;
}

/**
 * Create a prompt for the visual improvement generation based on analysis
 * @param {Object} analysis - The urban planning analysis
 * @returns {string} - Visualization prompt
 */
function createVisualizationPrompt(analysis) {
  const recommendations = analysis.improvement_recommendations
    .map((rec) => `- ${rec.recommendation}`)
    .join("\n");

  const principles = analysis.urban_planning_principles
    .map((principle) => `- ${principle}`)
    .join("\n");

  return `Transform this urban space image according to best urban planning practices. Create a realistic visualization that incorporates the following specific improvements:

${recommendations}

Apply these urban planning principles:
${principles}

CRITICAL REQUIREMENTS:
1. Make REALISTIC and PRACTICAL changes that could actually be implemented in this exact location
2. Maintain the EXACT same perspective, angle, and scale as the original image
3. The result must be PHOTOREALISTIC - not a sketch, drawing, or cartoon
4. Keep the same buildings and major infrastructure, but enhance them with the suggested improvements
5. Preserve the character and unique identity of the original location
6. Do not add floating text, labels, arrows, or UI elements to the image

IMPORTANT: Do not create an entirely new scene. The improved version should be clearly recognizable as the same location with specific enhancements applied. Someone familiar with this location should be able to recognize it after the improvements.

Generate a detailed visualization showing how these urban improvements would look when implemented at this exact location.`;
}

/**
 * Parse the analysis response into a structured object
 * @param {string} analysisText - The raw text from the model
 * @returns {Object} - Structured analysis object
 */
function parseAnalysisResponse(analysisText) {
  try {
    // Try to extract JSON from the response text
    const jsonMatch =
      analysisText.match(/```json\n([\s\S]*)\n```/) ||
      analysisText.match(/{[\s\S]*}/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    }

    // If no JSON found, create a structured format from the text
    console.warn(
      "Could not parse analysis response as JSON, providing structured format",
    );
    return {
      current_assessment: {
        overall_description: "Urban space requiring improvements",
        identified_issues: [
          {
            category: "General",
            details: "Please see the full analysis text below",
          },
        ],
      },
      improvement_recommendations: [
        {
          category: "General",
          recommendation: "See full analysis text",
          expected_benefits: "Multiple benefits detailed in analysis",
        },
      ],
      urban_planning_principles: [
        "Improved walkability",
        "Enhanced public spaces",
        "Increased greenery",
        "Better sustainability",
      ],
      raw_analysis: analysisText,
    };
  } catch (error) {
    console.error("Error parsing analysis response:", error);
    // Return a fallback structured format
    return {
      current_assessment: {
        overall_description: "Urban space analysis completed",
        identified_issues: [
          {
            category: "General",
            details: "Analysis text could not be structured properly",
          },
        ],
      },
      improvement_recommendations: [
        {
          category: "General",
          recommendation: "See raw analysis text below",
          expected_benefits: "Various urban improvements",
        },
      ],
      urban_planning_principles: [
        "Improved walkability",
        "Enhanced public spaces",
        "Increased greenery",
      ],
      raw_analysis: analysisText,
    };
  }
}

/**
 * Get the MIME type based on the file extension
 * @param {string} filePath - Path to the file
 * @returns {string} - MIME type
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

module.exports = { analyzeUrbanSpace, visualizeUrbanImprovements };
