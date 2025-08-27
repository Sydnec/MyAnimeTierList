// Structure de données pour un anime unifié
// Regroupe toutes les saisons d'un anime en une seule entité

export class AnimeData {
  constructor(data) {
    this.id = data.id || data.mal_id;
    // Champs principaux selon la base SQL
    this.title = data.title;
    this.title_english = data.title_english || null;
    this.title_original = data.title_original || data.title_japanese || null;
    // Pour compatibilité, on garde le titre anglais prioritaire pour baseTitle
    this.baseTitle = this.extractBaseTitle(this.title_english || this.title || this.title_original);
    this.image =
      data.image ||
      data.images?.jpg?.image_url ||
      data.images?.jpg?.small_image_url ||
      data.images?.jpg?.large_image_url ||
      data.image_url ||
      "/placeholder-anime.svg";
    this.year = data.year || this.extractYear(data.aired);
    this.genres = data.genres || [];
    this.synopsis = data.synopsis;
    this.score = data.score;
    this.status = data.status;
    this.type = data.type;
  }

  // Extrait le titre de base en supprimant les indicateurs de saison
  extractBaseTitle(title) {
    if (!title) return "";

    // Supprime les patterns courants de saison
    const seasonPatterns = [
      / Season \d+$/i,
      / S\d+$/i,
      / \d+(nd|rd|th) Season$/i,
      / Part \d+$/i,
      / Cour \d+$/i,
      / \d+$/,
      /: Season \d+$/i,
      /: Part \d+$/i,
      / \((Season |Part )?\d+\)$/i,
    ];

    let baseTitle = title.trim();
    for (const pattern of seasonPatterns) {
      baseTitle = baseTitle.replace(pattern, "").trim();
    }

    return baseTitle || title;
  }

  // Extrait l'année de diffusion
  extractYear(aired) {
    if (aired?.from) {
      return new Date(aired.from).getFullYear();
    }
    return null;
  }

  // Fusion deux animes (différentes saisons) en un seul
  static mergeAnimes(anime1, anime2) {
    // Garde l'anime avec l'année la plus ancienne comme principal
    const mainAnime = anime1.year <= anime2.year ? anime1 : anime2;
    const otherAnime = anime1.year <= anime2.year ? anime2 : anime1;

    // Met à jour les titres si nécessaire
    if (!mainAnime.title_english && otherAnime.title_english) {
      mainAnime.title_english = otherAnime.title_english;
    }

    // Préserve la meilleure image disponible
    if (!mainAnime.image || mainAnime.image === "/placeholder-anime.svg") {
      if (otherAnime.image && otherAnime.image !== "/placeholder-anime.svg") {
        mainAnime.image = otherAnime.image;
      }
    }

    return mainAnime;
  }
}

// Classe pour gérer une collection d'animes uniques
export class AnimeCollection {
  constructor() {
    this.animes = new Map(); // Map par baseTitle pour un accès rapide
  }

  // Ajoute un anime à la collection (gère automatiquement les doublons)
  addAnime(animeData) {
    // Si c'est déjà un AnimeData, on ne le recrée pas
    const anime =
      animeData instanceof AnimeData ? animeData : new AnimeData(animeData);
    const baseTitle = anime.baseTitle.toLowerCase();

    if (this.animes.has(baseTitle)) {
      // Merge avec l'anime existant
      const existingAnime = this.animes.get(baseTitle);
      const mergedAnime = AnimeData.mergeAnimes(existingAnime, anime);
      this.animes.set(baseTitle, mergedAnime);
    } else {
      this.animes.set(baseTitle, anime);
    }

    return this.animes.get(baseTitle);
  }

  // Récupère tous les animes uniques
  getAllAnimes() {
    return Array.from(this.animes.values());
  }

  // Recherche un anime par titre
  findAnime(title) {
    const baseTitle = new AnimeData({ title })
      .extractBaseTitle(title)
      .toLowerCase();
    return this.animes.get(baseTitle);
  }
}
