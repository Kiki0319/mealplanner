const connect = require('../../lib/mongoose');
const mongoose = require('mongoose');

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

module.exports = async (req, res) => {
  await connect();

  const Favourite = mongoose.models.Favourite || mongoose.model('Favourite', favouriteSchema);

  if (req.method === 'GET') {
    try {
      const favourites = await Favourite.find().sort({ createdAt: -1 }).lean();
      return res.json({ favourites });
    } catch (err) {
      console.error('❌ Error fetching favourites (serverless):', err.message || err);
      return res.status(500).json({ error: 'Failed to fetch favourites' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { recipeId, title, image, sourceUrl, calories, readyInMinutes, diets } = req.body || {};
      if (!recipeId || !title) return res.status(400).json({ error: 'Missing recipeId or title' });

      const existing = await Favourite.findOne({ recipeId });
      if (existing) return res.status(200).json({ message: 'Already in favourites' });

      const fav = new Favourite({
        recipeId,
        title,
        image: image || '',
        sourceUrl: sourceUrl || '',
        calories: calories || null,
        readyInMinutes: readyInMinutes || null,
        diets: Array.isArray(diets) ? diets : [],
      });

      const saved = await fav.save();
      return res.status(201).json({ message: 'Added to favourites', favourite: saved });
    } catch (err) {
      console.error('❌ Error saving favourite (serverless):', err.message || err);
      return res.status(500).json({ error: 'Failed to save favourite' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end('Method Not Allowed');
};
