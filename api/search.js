const axios = require('axios');
const connect = require('../lib/mongoose');

module.exports = async (req, res) => {
  // simple health for GET
  try {
    // ensure DB connection established (some deployments may not need DB for search, but keep consistent)
    await connect();
  } catch (err) {
    // don't fail search if DB is not required, but log
    console.error('DB connect warning (search):', err.message || err);
  }

  const { ingredients, diet } = req.query || {};
  if (!ingredients) return res.status(400).json({ error: "Missing 'ingredients' query param" });

  const RECIPE_API_ID = process.env.RECIPE_API_ID;
  const RECIPE_API_KEY = process.env.RECIPE_API_KEY;
  const RECIPE_API_BASE_URL = process.env.RECIPE_API_BASE_URL || 'https://api.edamam.com/api/recipes/v2';

  try {
    const params = {
      type: 'public',
      q: ingredients,
      app_id: RECIPE_API_ID,
      app_key: RECIPE_API_KEY,
    };

    // map diet param similar to original helper
    if (diet) {
      if (diet === 'high-protein') params.diet = 'high-protein';
      else if (diet === 'low-calorie') params.diet = 'low-fat';
      else if (diet === 'vegetarian') params.health = 'vegetarian';
      else if (diet === 'vegan') params.health = 'vegan';
    }

    const response = await axios.get(RECIPE_API_BASE_URL, {
      params,
      headers: {
        'Edamam-Account-User': RECIPE_API_ID,
      },
    });

    const data = response.data;
    const recipes = (data.hits || []).map((hit) => {
      const r = hit.recipe || {};
      const uri = r.uri || '';
      const recipeId = encodeURIComponent(uri);
      let calories = null;
      if (typeof r.calories === 'number') calories = r.calories;
      const readyInMinutes = typeof r.totalTime === 'number' && r.totalTime > 0 ? r.totalTime : null;
      const diets = [];
      if (Array.isArray(r.dietLabels)) diets.push(...r.dietLabels);
      if (Array.isArray(r.healthLabels)) diets.push(...r.healthLabels);

      return {
        recipeId,
        title: r.label || 'Untitled recipe',
        image: r.image || '',
        sourceUrl: r.url || '',
        calories,
        readyInMinutes,
        diets,
      };
    });

    res.json({ recipes });
  } catch (err) {
    console.error('❌ Error fetching recipes from Edamam (serverless):', err.message || err);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    }
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
};
