/**
 * Urban Planning Advisor - Vue.js Application
 * Enhanced with incremental visualization capabilities
 */

document.addEventListener("DOMContentLoaded", function () {
  const { createApp } = Vue;

  createApp({
    data() {
      return {
        // UI state
        isDragging: false,
        previewVisible: false,
        resultVisible: false,
        isProcessing: false,
        activeTab: "comparison",
        showHistoryModal: false,
        downloadStatus: "",
        imageDebug: false,
        imageLoadErrors: [],

        // File/image data
        uploadedFile: null,
        previewImageUrl: "",
        originalImageUrl: "",
        resultImageUrl: "",

        // Analysis results
        analysisResults: {},

        // Incremental improvements visualization
        improvements: [],
        currentChangeIndex: 0,
        generatedImages: [], // Will store URLs to the incrementally improved images

        // Saved analyses
        savedAnalyses: [],
      };
    },

    computed: {
      tabs() {
        return [
          { id: "comparison", label: "Interactive View" },
          { id: "analysis", label: "Detailed Analysis" },
          { id: "recommendations", label: "Recommendations" },
        ];
      },

      currentChange() {
        if (!this.improvements || this.improvements.length === 0) return null;
        return this.improvements[this.currentChangeIndex];
      },

      currentImageUrl() {
        if (!this.generatedImages || this.generatedImages.length === 0) {
          console.log("No images available, returning original");
          return this.originalImageUrl || "";
        }

        const index = Math.min(
          this.currentChangeIndex,
          this.generatedImages.length - 1,
        );
        console.log(
          `Selecting image ${index} from ${this.generatedImages.length} images`,
        );
        return this.generatedImages[index];
      },
    },

    mounted() {
      // Load saved analyses from localStorage
      this.loadSavedAnalyses();

      // Add listeners for keyboard navigation through changes
      document.addEventListener("keydown", this.handleKeyboardNavigation);

      console.log("Vue app mounted successfully");
    },

    beforeUnmount() {
      document.removeEventListener("keydown", this.handleKeyboardNavigation);
    },

    methods: {
      /*** File Handling ***/

      triggerFileInput() {
        console.log("Triggering file input");
        if (this.$refs.fileInput) {
          this.$refs.fileInput.click();
        }
      },

      onDragOver() {
        this.isDragging = true;
      },

      onDragLeave() {
        this.isDragging = false;
      },

      onFileDrop(event) {
        this.isDragging = false;
        if (event.dataTransfer.files.length) {
          this.handleFileSelect(event.dataTransfer.files[0]);
        }
      },

      onFileChange(event) {
        console.log("File input changed");
        if (event.target.files.length) {
          this.handleFileSelect(event.target.files[0]);
        }
      },

      handleFileSelect(file) {
        // Validate file type and size
        const validTypes = ["image/jpeg", "image/jpg", "image/png"];
        const maxSize = 15 * 1024 * 1024; // 15MB

        if (!validTypes.includes(file.type)) {
          alert("Please upload a JPG, JPEG or PNG file.");
          return;
        }

        if (file.size > maxSize) {
          alert("File size exceeds 15MB limit.");
          return;
        }

        this.uploadedFile = file;
        console.log("File selected:", file.name);

        // Read and display the file
        const reader = new FileReader();
        reader.onload = (e) => {
          this.previewImageUrl = e.target.result;
          this.previewVisible = true;
        };
        reader.readAsDataURL(file);
      },

      resetUpload() {
        this.uploadedFile = null;
        this.previewImageUrl = "";
        this.previewVisible = false;
      },

      /*** Analysis & Visualization ***/

      async analyzeUrbanSpace() {
        if (!this.uploadedFile) return;

        this.resultVisible = true;
        this.isProcessing = true;

        // Save current preview for comparison
        this.originalImageUrl = this.previewImageUrl;

        try {
          console.log("Starting urban space analysis...");
          const formData = new FormData();
          formData.append("image", this.uploadedFile);

          // Add query parameter to request incremental changes
          const response = await fetch(
            "/api/analyze-urban-space?incremental=true",
            {
              method: "POST",
              body: formData,
            },
          );

          const data = await response.json();
          console.log("API response received:", data);

          if (data.success) {
            // Store the analysis results
            this.analysisResults = data.analysis;
            this.resultImageUrl = data.imageUrl;

            // Setup the incremental improvements
            this.setupIncrementalChanges(data);

            // Preload all images to ensure they're ready when needed
            this.preloadImages(this.generatedImages);

            // Save to localStorage
            this.saveAnalysisToHistory();
          } else {
            throw new Error(data.error || "Failed to analyze urban space");
          }
        } catch (error) {
          console.error("Error analyzing urban space:", error);
          alert(`Error: ${error.message || "Failed to analyze urban space"}`);
        } finally {
          this.isProcessing = false;
        }
      },

      setupIncrementalChanges(data) {
        console.log("Setting up incremental changes with data:", data);

        // Clear existing data
        this.improvements = [];
        this.generatedImages = [];

        if (data.incrementalChanges && data.incrementalChanges.length > 0) {
          // If the server provides incremental changes
          console.log(
            "Using server-provided incremental changes:",
            data.incrementalChanges.length,
          );
          this.improvements = data.incrementalChanges;

          // Make sure we have the full URLs for the incremental images
          if (data.incrementalImages && data.incrementalImages.length > 0) {
            console.log(
              "Found incremental images:",
              data.incrementalImages.length,
            );

            // Ensure all image paths start with /results/ if they don't include the full path
            this.generatedImages = data.incrementalImages.map((img) => {
              if (img.startsWith("/")) {
                return img; // Already has path
              } else {
                return `/results/${img}`; // Add path
              }
            });

            console.log("Processed image URLs:", this.generatedImages);
          } else {
            // Fallback to final image if no incremental images
            console.log("No incremental images found, using final image");
            this.generatedImages = [data.imageUrl];
          }
        } else {
          // Fallback: Create synthetic changes from recommendations
          console.log("Creating synthetic changes from recommendations");
          const recommendations =
            this.analysisResults.improvement_recommendations || [];

          recommendations.forEach((rec, index) => {
            this.improvements.push({
              id: index,
              category: rec.category,
              description: rec.recommendation,
              benefits: rec.expected_benefits,
            });
          });

          // In fallback mode, we only have the final image
          this.generatedImages = [data.imageUrl];
        }

        console.log("Final improvements array:", this.improvements.length);
        console.log("Final images array:", this.generatedImages.length);

        // Reset to the first change
        this.currentChangeIndex = 0;
      },

      preloadImages(urls) {
        console.log("Preloading images:", urls);
        urls.forEach((url) => {
          if (url) {
            const img = new Image();
            img.src = url;
          }
        });
      },

      /*** Incremental Navigation ***/

      prevChange() {
        if (this.currentChangeIndex > 0) {
          this.currentChangeIndex--;
          this.refreshCurrentImage();
        }
      },

      nextChange() {
        if (this.currentChangeIndex < this.improvements.length - 1) {
          this.currentChangeIndex++;
          this.refreshCurrentImage();
        }
      },

      refreshCurrentImage() {
        // Force image refresh by temporarily clearing and resetting
        const currentIndex = this.currentChangeIndex;
        const currentUrl = this.generatedImages[currentIndex];

        if (!currentUrl) return;

        // If the URL has a cache buster, remove it first
        const baseUrl = currentUrl.split("?")[0];

        // Add a cache buster to force reload
        this.generatedImages[currentIndex] = `${baseUrl}?t=${Date.now()}`;

        console.log(
          `Refreshed image URL: ${currentUrl} → ${this.generatedImages[currentIndex]}`,
        );
      },

      handleKeyboardNavigation(event) {
        // Only handle keyboard when results are visible
        if (!this.resultVisible) return;

        if (event.key === "ArrowLeft") {
          this.prevChange();
        } else if (event.key === "ArrowRight") {
          this.nextChange();
        }
      },

      showChangeForIssue(issueIndex) {
        // Find the corresponding recommendation for this issue
        if (!this.analysisResults.current_assessment?.identified_issues) return;

        const issue =
          this.analysisResults.current_assessment.identified_issues[issueIndex];
        if (!issue || !this.analysisResults.improvement_recommendations) return;

        const recIndex =
          this.analysisResults.improvement_recommendations.findIndex(
            (rec) => rec.category === issue.category,
          );

        if (recIndex !== -1) {
          this.showChangeForRecommendation(recIndex);
        }
      },

      showChangeForRecommendation(recIndex) {
        // Switch to the comparison tab and show the relevant change
        this.activeTab = "comparison";

        if (!this.analysisResults.improvement_recommendations) return;

        // Find the matching improvement by category
        const recommendation =
          this.analysisResults.improvement_recommendations[recIndex];
        if (!recommendation) return;

        const improvementIndex = this.improvements.findIndex(
          (imp) => imp.category === recommendation.category,
        );

        if (improvementIndex !== -1) {
          this.currentChangeIndex = improvementIndex;
          this.refreshCurrentImage();
        }

        // Scroll to the comparison section
        const element = document.getElementById("comparison-tab");
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      },

      /*** Image Handling ***/

      handleImageError(type) {
        console.error(
          `Failed to load ${type} image:`,
          type === "original" ? this.originalImageUrl : this.currentImageUrl,
        );
        this.imageLoadErrors.push({
          type,
          url:
            type === "original" ? this.originalImageUrl : this.currentImageUrl,
          time: new Date().toISOString(),
        });

        // If it's the result image that failed, try to fix the URL path
        if (
          type === "result" &&
          this.currentChangeIndex < this.generatedImages.length
        ) {
          const oldUrl = this.generatedImages[this.currentChangeIndex];
          // If URL doesn't start with /results/ and doesn't have a leading slash, add /results/
          if (!oldUrl.includes("/results/") && !oldUrl.startsWith("/")) {
            this.generatedImages[this.currentChangeIndex] =
              `/results/${oldUrl}`;
            console.log(
              `Fixed URL path: ${oldUrl} → ${this.generatedImages[this.currentChangeIndex]}`,
            );
          }
        }
      },

      handleImageLoad() {
        console.log("Image loaded successfully:", this.currentImageUrl);
      },

      /*** History Management ***/

      loadSavedAnalyses() {
        try {
          const savedData = localStorage.getItem("urbanPlanningAnalyses");
          if (savedData) {
            this.savedAnalyses = JSON.parse(savedData);
            console.log(`Loaded ${this.savedAnalyses.length} saved analyses`);
          }
        } catch (error) {
          console.error("Error loading saved analyses:", error);
          this.savedAnalyses = [];
        }
      },

      saveAnalysisToHistory() {
        const newAnalysis = {
          id: Date.now(),
          originalImageDataUrl: this.originalImageUrl,
          resultImageUrl: this.resultImageUrl,
          analysis: this.analysisResults,
          improvements: this.improvements,
          generatedImages: this.generatedImages,
          timestamp: new Date().toISOString(),
        };

        this.savedAnalyses.unshift(newAnalysis);
        console.log(
          `Saved new analysis to history, now have ${this.savedAnalyses.length} saved analyses`,
        );

        // Keep only the last 20 analyses
        if (this.savedAnalyses.length > 20) {
          this.savedAnalyses = this.savedAnalyses.slice(0, 20);
        }

        // Save to localStorage
        localStorage.setItem(
          "urbanPlanningAnalyses",
          JSON.stringify(this.savedAnalyses),
        );
      },

      loadSavedAnalysis(index) {
        const analysis = this.savedAnalyses[index];
        if (!analysis) return;

        console.log(`Loading saved analysis #${index}`);

        // Load the analysis data
        this.originalImageUrl = analysis.originalImageDataUrl;
        this.resultImageUrl = analysis.resultImageUrl;
        this.analysisResults = analysis.analysis;

        // Set up the incremental view
        this.improvements = analysis.improvements || [];
        this.generatedImages = analysis.generatedImages || [
          analysis.resultImageUrl,
        ];
        this.currentChangeIndex = 0;

        // Show the result section
        this.resultVisible = true;
        this.isProcessing = false;

        // Reset tabs to first tab
        this.activeTab = "comparison";

        // Close the modal
        this.showHistoryModal = false;

        // Preload the images
        this.preloadImages(this.generatedImages);
      },

      deleteHistoryItem(itemId) {
        this.savedAnalyses = this.savedAnalyses.filter(
          (item) => item.id !== itemId,
        );
        localStorage.setItem(
          "urbanPlanningAnalyses",
          JSON.stringify(this.savedAnalyses),
        );
      },

      /*** Download Functions ***/

      downloadImage() {
        if (!this.resultImageUrl) return;

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const link = document.createElement("a");
        link.href = this.resultImageUrl;
        link.download = `urban-improvement-${timestamp}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Show download feedback
        this.downloadStatus = "Downloaded!";
        setTimeout(() => {
          this.downloadStatus = "";
        }, 2000);
      },

      downloadHistoryImage(imageUrl) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = `urban-improvement-${timestamp}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },

      downloadReport() {
        if (!this.analysisResults.current_assessment) return;

        // Generate a simple report in text format
        let reportText = "URBAN PLANNING ANALYSIS REPORT\n";
        reportText += "==============================\n\n";
        reportText += `Date: ${new Date().toLocaleString()}\n\n`;

        reportText += "CURRENT ASSESSMENT\n";
        reportText += "------------------\n";
        reportText += `${this.analysisResults.current_assessment.overall_description}\n\n`;

        reportText += "IDENTIFIED ISSUES\n";
        reportText += "----------------\n";
        this.analysisResults.current_assessment.identified_issues.forEach(
          (issue, i) => {
            reportText += `${i + 1}. ${issue.category}: ${issue.details}\n`;
          },
        );
        reportText += "\n";

        reportText += "RECOMMENDATIONS\n";
        reportText += "---------------\n";
        this.analysisResults.improvement_recommendations.forEach((rec, i) => {
          reportText += `${i + 1}. ${rec.category}: ${rec.recommendation}\n`;
          reportText += `   Benefits: ${rec.expected_benefits}\n\n`;
        });

        reportText += "URBAN PLANNING PRINCIPLES\n";
        reportText += "-------------------------\n";
        this.analysisResults.urban_planning_principles.forEach(
          (principle, i) => {
            reportText += `${i + 1}. ${principle}\n`;
          },
        );

        // Create and trigger download
        const blob = new Blob([reportText], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

        const link = document.createElement("a");
        link.href = url;
        link.download = `urban-analysis-report-${timestamp}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },

      /*** Utility Functions ***/

      getCategoryIcon(category) {
        // Choose an appropriate icon based on category
        if (!category) return "fas fa-exclamation-circle";

        const lowerCategory = category.toLowerCase();

        if (lowerCategory.includes("walk")) return "fas fa-walking";
        if (lowerCategory.includes("transport")) return "fas fa-bus";
        if (lowerCategory.includes("green")) return "fas fa-leaf";
        if (lowerCategory.includes("public")) return "fas fa-users";
        if (lowerCategory.includes("safe")) return "fas fa-shield-alt";
        if (lowerCategory.includes("access")) return "fas fa-universal-access";
        if (lowerCategory.includes("infra")) return "fas fa-road";

        return "fas fa-exclamation-circle";
      },

      formatDate(dateString) {
        return new Date(dateString).toLocaleString();
      },

      resetAll() {
        this.resetUpload();
        this.resultVisible = false;
        this.originalImageUrl = "";
        this.resultImageUrl = "";
        this.analysisResults = {};
        this.improvements = [];
        this.generatedImages = [];
        this.currentChangeIndex = 0;
        this.activeTab = "comparison";
      },
    },
  }).mount("#app");
});
