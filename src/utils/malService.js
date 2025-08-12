// Service pour interagir avec l'API MyAnimeList (Jikan API)
// Documentation: https://docs.api.jikan.moe/

const JIKAN_BASE_URL = "https://api.jikan.moe/v4";

// Délai entre les requêtes pour respecter les limites de l'API
const API_DELAY = 1000; // 1 seconde entre les requêtes

let lastRequestTime = 0;

// Helper pour respecter les limites de taux
const waitForRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < API_DELAY) {
    const waitTime = API_DELAY - timeSinceLastRequest;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
};

export class MALService {
  // Recherche d'animes par titre
  static async searchAnime(query, limit = 10) {
    if (!query.trim()) return [];

    try {
      await waitForRateLimit();

      const response = await fetch(
        `${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(
          query
        )}&limit=${limit}&order_by=popularity&sort=asc`
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error("Erreur lors de la recherche d'animes:", error);
      return [];
    }
  }

  // Récupère les animes d'un utilisateur MyAnimeList (statut "completed" uniquement)
  static async getUserCompletedAnimes(username) {
    try {
      const animes = [];
      let page = 1;
      let hasNextPage = true;

      while (hasNextPage && page <= 10) {
        // Limite à 10 pages pour éviter les timeouts
        await waitForRateLimit();

        const response = await fetch(
          `${JIKAN_BASE_URL}/users/${username}/animelist/completed?page=${page}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Utilisateur non trouvé ou profil privé");
          }
          throw new Error(`Erreur API: ${response.status}`);
        }

        const data = await response.json();

        if (data.data && data.data.length > 0) {
          animes.push(
            ...data.data.map((item) => ({
              mal_id: item.anime.mal_id,
              title: item.anime.title,
              title_english: item.anime.title_english,
              title_japanese: item.anime.title_japanese,
              title_synonyms: item.anime.title_synonyms,
              images: item.anime.images,
              year: item.anime.year,
              score: item.anime.score,
              genres: item.anime.genres,
              synopsis: item.anime.synopsis,
              status: item.anime.status,
              type: item.anime.type,
              episodes: item.anime.episodes,
              aired: item.anime.aired,
              user_score: item.score,
            }))
          );

          hasNextPage = data.pagination?.has_next_page || false;
          page++;
        } else {
          hasNextPage = false;
        }
      }

      return animes;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération de la liste utilisateur:",
        error
      );
      throw error;
    }
  }

  // Récupère les détails d'un anime spécifique
  static async getAnimeDetails(animeId) {
    try {
      await waitForRateLimit();

      const response = await fetch(`${JIKAN_BASE_URL}/anime/${animeId}`);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des détails de l'anime:",
        error
      );
      return null;
    }
  }

  // Récupère les animes populaires
  static async getPopularAnimes(limit = 25) {
    try {
      await waitForRateLimit();

      const response = await fetch(
        `${JIKAN_BASE_URL}/top/anime?type=tv&filter=bypopularity&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des animes populaires:",
        error
      );
      return [];
    }
  }
}
