// Structure de données pour un anime unifié
// Regroupe toutes les saisons d'un anime en une seule entité

export class AnimeData {
  constructor(data) {
    this.id = data.mal_id || data.id;
    this.title = data.title || data.title_english || data.title_japanese;
    this.titles = {
      default: data.title,
      english: data.title_english,
      japanese: data.title_japanese,
      synonyms: data.title_synonyms || [],
    };
    this.baseTitle = this.extractBaseTitle(this.title);

    // Préserve l'image existante si elle existe déjà
    this.image =
      data.image || // Image déjà normalisée
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

    // Données spécifiques à la gestion des saisons
    this.seasons = data.seasons || []; // Toutes les saisons de cet anime
    this.mainSeasonId = data.mainSeasonId || this.id; // ID de la saison principale/première
    this.isMainEntry = data.isMainEntry !== undefined ? data.isMainEntry : true; // Si c'est l'entrée principale pour cet anime
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

  // Ajoute une saison à cet anime
  addSeason(seasonData) {
    const existingSeason = this.seasons.find((s) => s.id === seasonData.id);
    if (!existingSeason) {
      this.seasons.push({
        id: seasonData.id,
        title: seasonData.title,
        year: seasonData.year,
        status: seasonData.status,
        episodes: seasonData.episodes,
      });
    }
  }

  // Vérifie si deux animes sont le même (différentes saisons)
  static isSameAnime(anime1, anime2) {
    // Comparaison par titre de base
    if (anime1.baseTitle.toLowerCase() === anime2.baseTitle.toLowerCase()) {
      return true;
    }

    // Comparaison par titres alternatifs
    const allTitles1 = [
      anime1.titles.default,
      anime1.titles.english,
      anime1.titles.japanese,
      ...anime1.titles.synonyms,
    ]
      .filter(Boolean)
      .map((t) => t.toLowerCase());

    const allTitles2 = [
      anime2.titles.default,
      anime2.titles.english,
      anime2.titles.japanese,
      ...anime2.titles.synonyms,
    ]
      .filter(Boolean)
      .map((t) => t.toLowerCase());

    // Vérifie si un titre correspond
    for (const title1 of allTitles1) {
      for (const title2 of allTitles2) {
        if (title1 === title2) return true;

        // Comparaison de base après suppression des indicateurs de saison
        const base1 = new AnimeData({ title: title1 }).extractBaseTitle(title1);
        const base2 = new AnimeData({ title: title2 }).extractBaseTitle(title2);
        if (base1 && base2 && base1 === base2) return true;
      }
    }

    return false;
  }

  // Fusion deux animes (différentes saisons) en un seul
  static mergeAnimes(anime1, anime2) {
    // Garde l'anime avec l'année la plus ancienne comme principal
    const mainAnime = anime1.year <= anime2.year ? anime1 : anime2;
    const otherAnime = anime1.year <= anime2.year ? anime2 : anime1;

    // Ajoute la saison de l'autre anime
    mainAnime.addSeason(otherAnime);

    // Met à jour les titres si nécessaire
    if (!mainAnime.titles.english && otherAnime.titles.english) {
      mainAnime.titles.english = otherAnime.titles.english;
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

  // Import depuis une liste MyAnimeList
  importFromMAL(malData) {
    const importedAnimes = [];

    for (const item of malData) {
      const importedAnime = this.addAnime(item);
      importedAnimes.push(importedAnime);
    }

    return importedAnimes;
  }
}
