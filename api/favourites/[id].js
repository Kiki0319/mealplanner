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

  const { id } = req.query || {};
  if (!id) return res.status(400).json({ error: 'Missing id param' });

  if (req.method === 'DELETE') {
    try {
      const deleted = await Favourite.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ error: 'Favourite not found' });
      return res.json({ message: 'Favourite removed' });
    } catch (err) {
      console.error('❌ Error deleting favourite (serverless):', err.message || err);
      return res.status(500).json({ error: 'Failed to delete favourite' });
    }
  }

  res.setHeader('Allow', 'DELETE');
  return res.status(405).end('Method Not Allowed');
};
