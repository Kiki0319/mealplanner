// script.js

// If running locally, use local backend. Otherwise use relative paths so Vercel front+api work on same domain.
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000'
  : '';


const searchForm = document.getElementById("search-form");
const ingredientsInput = document.getElementById("ingredients-input");
const dietSelect = document.getElementById("diet-select");
const searchStatus = document.getElementById("search-status");
const resultsContainer = document.getElementById("results");

const favouritesStatus = document.getElementById("favourites-status");
const favouritesContainer = document.getElementById("favourites");

// ---- Helpers ----
function setSearchStatus(message) {
  searchStatus.textContent = message || "";
}

function setFavouritesStatus(message) {
  favouritesStatus.textContent = message || "";
}

function createRecipeCard(recipe, options = {}) {
  const { showSaveButton = true, showRemoveButton = false, favId = null } = options;

  const card = document.createElement("div");
  card.className = "recipe-card";

  const imageWrapper = document.createElement("div");
  imageWrapper.className = "recipe-image-wrapper";

  const img = document.createElement("img");
  img.className = "recipe-image";
  img.src = recipe.image || "https://via.placeholder.com/400x300?text=No+Image";
  img.alt = recipe.title || "Recipe image";

  imageWrapper.appendChild(img);

  const content = document.createElement("div");
  content.className = "recipe-content";

  const title = document.createElement("h3");
  title.className = "recipe-title";
  title.textContent = recipe.title || "Untitled recipe";

  const meta = document.createElement("div");
  meta.className = "recipe-meta";

  const metaParts = [];
  if (recipe.readyInMinutes) {
    metaParts.push(`${recipe.readyInMinutes} min`);
  }
  if (recipe.calories) {
    metaParts.push(`${Math.round(recipe.calories)} kcal`);
  }
  meta.textContent = metaParts.join(" · ");

  const badgeRow = document.createElement("div");
  badgeRow.className = "badge-row";
  (recipe.diets || []).forEach((diet) => {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = diet;
    badgeRow.appendChild(badge);
  });

  const actions = document.createElement("div");
  actions.className = "recipe-actions";

  if (recipe.sourceUrl) {
    const link = document.createElement("a");
    link.href = recipe.sourceUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View recipe";
    actions.appendChild(link);
  }

  if (showSaveButton) {
    const saveBtn = document.createElement("button");
    saveBtn.className = "btn secondary";
    saveBtn.type = "button";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => {
      saveFavourite(recipe);
    });
    actions.appendChild(saveBtn);
  }

  if (showRemoveButton && favId) {
    const removeBtn = document.createElement("button");
    removeBtn.className = "btn";
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      removeFavourite(favId);
    });
    actions.appendChild(removeBtn);
  }

  content.appendChild(title);
  if (metaParts.length > 0) content.appendChild(meta);
  if (badgeRow.children.length > 0) content.appendChild(badgeRow);
  if (actions.children.length > 0) content.appendChild(actions);

  card.appendChild(imageWrapper);
  card.appendChild(content);
  return card;
}

// ---- Fetch recipes from backend ----
async function searchRecipes(ingredients, diet) {
  setSearchStatus("Searching...");
  resultsContainer.innerHTML = "";

  const params = new URLSearchParams();
  params.set("ingredients", ingredients);
  if (diet) params.set("diet", diet);

  try {
    const res = await fetch(`${API_BASE_URL}/api/search?${params.toString()}`);
    if (!res.ok) {
      throw new Error("Search request failed");
    }
    const data = await res.json();
    const recipes = data.recipes || [];

    if (recipes.length === 0) {
      setSearchStatus("No recipes found. Try different ingredients.");
      return;
    }

    setSearchStatus(`Found ${recipes.length} recipes.`);
    recipes.forEach((r) => {
      const card = createRecipeCard(r, { showSaveButton: true });
      resultsContainer.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    setSearchStatus("Something went wrong while searching.");
  }
}

// ---- Favourites: fetch ----
async function loadFavourites() {
  setFavouritesStatus("Loading favourites...");
  favouritesContainer.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE_URL}/api/favourites`);
    if (!res.ok) {
      throw new Error("Failed to fetch favourites");
    }
    const data = await res.json();
    const favourites = data.favourites || [];

    if (favourites.length === 0) {
      setFavouritesStatus("No saved recipes yet.");
      return;
    }

    setFavouritesStatus(`You have ${favourites.length} saved recipes.`);
    favourites.forEach((fav) => {
      const recipe = {
        recipeId: fav.recipeId,
        title: fav.title,
        image: fav.image,
        sourceUrl: fav.sourceUrl,
        calories: fav.calories,
        readyInMinutes: fav.readyInMinutes,
        diets: fav.diets,
      };
      const card = createRecipeCard(recipe, {
        showSaveButton: false,
        showRemoveButton: true,
        favId: fav._id,
      });
      favouritesContainer.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    setFavouritesStatus("Failed to load favourites.");
  }
}

// ---- Favourites: save ----
async function saveFavourite(recipe) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/favourites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recipe),
    });

    if (!res.ok) {
      throw new Error("Failed to save favourite");
    }

    const data = await res.json();
    console.log(data);
    loadFavourites();
  } catch (err) {
    console.error(err);
    alert("Could not save this recipe.");
  }
}

// ---- Favourites: remove ----
async function removeFavourite(favId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/favourites/${favId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error("Failed to delete favourite");
    }
    loadFavourites();
  } catch (err) {
    console.error(err);
    alert("Could not remove this recipe.");
  }
}

// ---- Event listeners ----
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const ingredients = ingredientsInput.value.trim();
  const diet = dietSelect.value.trim();

  if (!ingredients) {
    setSearchStatus("Please enter at least one ingredient.");
    return;
  }

  searchRecipes(ingredients, diet);
});

// Load favourites when page loads
window.addEventListener("DOMContentLoaded", () => {
  loadFavourites();
});
