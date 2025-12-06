// server.js
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const cors = require("cors");

const app = express();

// ----- Basic config -----
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const RECIPE_API_ID = process.env.RECIPE_API_ID;
const RECIPE_API_KEY = process.env.RECIPE_API_KEY;
const RECIPE_API_BASE_URL =
  process.env.RECIPE_API_BASE_URL || "https://api.edamam.com/api/recipes/v2";

if (!MONGODB_URI || !RECIPE_API_ID || !RECIPE_API_KEY || !RECIPE_API_BASE_URL) {
  console.error("❌ Missing one of MONGODB_URI / RECIPE_API_ID / RECIPE_API_KEY / RECIPE_API_BASE_URL in .env");
  process.exit(1);
}

// ----- CORS (allow Vercel frontend) -----
// 把这个数组里换成你自己的 Vercel 域名
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:4173",
  "https://your-project.vercel.app" // TODO: change this
];

if (process.env.NODE_ENV !== 'production') {
  // during development allow all origins to simplify testing
  app.use(cors());
} else {
  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        // Deny CORS without throwing an exception to avoid crashing the server
        return callback(null, false);
      },
    })
  );
}

// ----- Middlewares -----
app.use(express.json());

// ----- MongoDB connection -----
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// ----- Mongoose schema -----
const favouriteSchema = new mongoose.Schema({
  recipeId: { type: String, required: true },
  title: String,
  image: String,
  sourceUrl: String,
  calories: Number,
  readyInMinutes: Number,
  diets: [String],
  createdAt: { type: Date, default: Date.now },
});

const Favourite = mongoose.model("Favourite", favouriteSchema);

// ----- Route: health check -----
app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "MealPlanner backend running" });
});

// helper: map our diet select to Edamam params
function mapDietToEdamam(diet) {
  // returns { dietParam, healthParam }
  let dietParam = null;
  let healthParam = null;

  switch (diet) {
    case "high-protein":
      dietParam = "high-protein";
      break;
    case "low-calorie":
      // Edamam 没有 low-calorie，用 low-fat 代替一个健康选项
      dietParam = "low-fat";
      break;
    case "vegetarian":
      healthParam = "vegetarian";
      break;
    case "vegan":
      healthParam = "vegan";
      break;
    default:
      break;
  }

  return { dietParam, healthParam };
}

// ----- Route: search recipes (Edamam) -----
app.get("/api/search", async (req, res) => {
  const { ingredients, diet } = req.query;

  if (!ingredients) {
    return res.status(400).json({ error: "Missing 'ingredients' query param" });
  }

  const { dietParam, healthParam } = mapDietToEdamam(diet);

  try {
    const params = {
      type: "public",
      q: ingredients,
      app_id: RECIPE_API_ID,
      app_key: RECIPE_API_KEY,
    };

    if (dietParam) params.diet = dietParam;
    if (healthParam) params.health = healthParam;

    const response = await axios.get(RECIPE_API_BASE_URL, {
      params,
      headers: {
        // Edamam v2 may require the account user header in some accounts
        'Edamam-Account-User': RECIPE_API_ID,
      },
    });

    const data = response.data;

    // Edamam: data.hits is array; each hit has .recipe
    const recipes = (data.hits || []).map((hit) => {
      const r = hit.recipe || {};
      const uri = r.uri || "";
      // use uri as id (encode to be safe)
      const recipeId = encodeURIComponent(uri);

      // calories per recipe; optionally divide by servings if you want per serving
      let calories = null;
      if (typeof r.calories === "number") {
        calories = r.calories;
      }

      const readyInMinutes = typeof r.totalTime === "number" && r.totalTime > 0
        ? r.totalTime
        : null;

      const diets = [];
      if (Array.isArray(r.dietLabels)) diets.push(...r.dietLabels);
      if (Array.isArray(r.healthLabels)) diets.push(...r.healthLabels);

      return {
        recipeId,
        title: r.label || "Untitled recipe",
        image: r.image || "",
        sourceUrl: r.url || "",
        calories,
        readyInMinutes,
        diets,
      };
    });

    res.json({ recipes });
  } catch (err) {
    console.error("❌ Error fetching recipes from Edamam:", err.message);
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", err.response.data);
    }
    res.status(500).json({ error: "Failed to fetch recipes" });
  }
});

// ----- Route: get favourites -----
app.get("/api/favourites", async (_req, res) => {
  try {
    const favourites = await Favourite.find().sort({ createdAt: -1 }).lean();
    res.json({ favourites });
  } catch (err) {
    console.error("❌ Error fetching favourites:", err.message);
    res.status(500).json({ error: "Failed to fetch favourites" });
  }
});

// ----- Route: add favourite -----
app.post("/api/favourites", async (req, res) => {
  try {
    const { recipeId, title, image, sourceUrl, calories, readyInMinutes, diets } = req.body;

    if (!recipeId || !title) {
      return res.status(400).json({ error: "Missing recipeId or title" });
    }

    const existing = await Favourite.findOne({ recipeId });
    if (existing) {
      return res.status(200).json({ message: "Already in favourites" });
    }

    const fav = new Favourite({
      recipeId,
      title,
      image: image || "",
      sourceUrl: sourceUrl || "",
      calories: calories || null,
      readyInMinutes: readyInMinutes || null,
      diets: Array.isArray(diets) ? diets : [],
    });

    const saved = await fav.save();
    res.status(201).json({ message: "Added to favourites", favourite: saved });
  } catch (err) {
    console.error("❌ Error saving favourite:", err.message);
    res.status(500).json({ error: "Failed to save favourite" });
  }
});

// ----- Route: delete favourite -----
app.delete("/api/favourites/:id", async (req, res) => {
  try {
    const deleted = await Favourite.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Favourite not found" });
    }
    res.json({ message: "Favourite removed" });
  } catch (err) {
    console.error("❌ Error deleting favourite:", err.message);
    res.status(500).json({ error: "Failed to delete favourite" });
  }
});

// ----- Start server -----
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
