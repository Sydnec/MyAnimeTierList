"use client";

import { useState, useRef } from "react";
import { MALService } from "../utils/malService";
import styles from "./AnimeSearch.module.css";

export default function AnimeSearch({
  onAnimeAdd,
  onBulkImport,
  collection,
  emitAnimeUpdate,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  
  // État pour les notifications d'ajout d'anime
  const [addNotification, setAddNotification] = useState(null);

  // Recherche d'animes via l'API Jikan
  const searchAnimes = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSelectedIndex(0);
      return;
    }

    setIsSearching(true);

    try {
      const results = await MALService.searchAnime(query, 10);
      setSearchResults(results);
      setSelectedIndex(0);
    } catch (error) {
      console.error("Erreur de recherche:", error);
      setSearchResults([]);
      setSelectedIndex(0);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Debounce la recherche
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      searchAnimes(value);
    }, 500);
  };

  const handleAddAnime = (anime) => {
    if (onAnimeAdd) {
      // Normalise l'objet anime pour s'assurer que l'image est dans le bon champ
      const normalizedAnime = {
        ...anime,
        image:
          anime.images?.jpg?.image_url ||
          anime.images?.jpg?.small_image_url ||
          anime.images?.jpg?.large_image_url ||
          anime.image ||
          "/placeholder-anime.svg",
      };

      // Vérifier si l'anime existe déjà dans la collection
      let notificationType = "success";
      let notificationMessage = "";

      if (collection) {
        const existingAnime = collection.findAnime(normalizedAnime.title);
        if (existingAnime) {
          notificationType = "warning";
          notificationMessage = `📝 "${normalizedAnime.title}" est déjà dans votre liste`;
        } else {
          notificationMessage = `✅ "${normalizedAnime.title}" ajouté avec succès !`;
        }
      } else {
        notificationMessage = `✅ "${normalizedAnime.title}" ajouté avec succès !`;
      }

      // Afficher la notification
      setAddNotification({
        type: notificationType,
        message: notificationMessage,
        anime: normalizedAnime
      });

      // Masquer la notification après 4 secondes
      setTimeout(() => setAddNotification(null), 4000);

      // Ajouter l'anime (même s'il existe déjà, la logique de fusion se fera ailleurs)
      onAnimeAdd(normalizedAnime);
    }

    // Remet le champ de recherche à zéro
    setSearchTerm("");
    setSearchResults([]);
    setSelectedIndex(0);

    // Remet le focus sur le champ de recherche
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (searchResults.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, searchResults.length - 1)
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (searchResults[selectedIndex]) {
          handleAddAnime(searchResults[selectedIndex]);
        }
        break;
      case "Escape":
        setSearchResults([]);
        setSelectedIndex(0);
        break;
    }
  };

  // Parse le XML de MyAnimeList
  const parseMALXML = (xmlText) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");

      // Vérifier s'il y a des erreurs de parsing
      const parseError = xmlDoc.querySelector("parsererror");
      if (parseError) {
        throw new Error("Fichier XML invalide");
      }

      const animeElements = xmlDoc.querySelectorAll("anime");
      const animes = [];

      animeElements.forEach((anime) => {
        const status = anime.querySelector("my_status")?.textContent;
        console.log("🔍 Processing anime with status:", status);

        // Importer seulement les animes "Completed" (status = 2 ou "Completed")
        if (status === "2" || status === "Completed") {
          const malId = anime.querySelector("series_animedb_id")?.textContent;
          const title = anime.querySelector("series_title")?.textContent;
          const episodes = anime.querySelector("series_episodes")?.textContent;
          const type = anime.querySelector("series_type")?.textContent;
          const score = anime.querySelector("my_score")?.textContent;

          console.log("✅ Found completed anime:", {
            malId,
            title,
            episodes,
            type,
            score,
          });

          if (malId && title) {
            console.log("🔍 Raw malId value:", malId, "type:", typeof malId);

            const parsedMalId = parseInt(malId);
            console.log(
              "🔍 Parsed malId:",
              parsedMalId,
              "isNaN:",
              isNaN(parsedMalId)
            );

            // Only proceed if we have a valid mal_id
            if (!isNaN(parsedMalId)) {
              const animeData = {
                mal_id: parsedMalId,
                id: parsedMalId, // Use mal_id as id
                title: title,
                episodes: episodes ? parseInt(episodes) : null,
                type: type || "Unknown",
                user_score: score ? parseInt(score) : null,
                image: "/placeholder-anime.svg", // Simplified for now
              };

              console.log("📦 Created anime object:", animeData);
              animes.push(animeData);
            } else {
              console.warn(
                "⚠️ Skipping anime with invalid mal_id:",
                malId,
                "for title:",
                title
              );
            }
          }
        }
      });

      return animes;
    } catch (error) {
      console.error("Erreur parsing XML:", error);
      throw new Error("Impossible de parser le fichier XML");
    }
  };

  // Gestion des fichiers
  const handleFileSelect = (file) => {
    if (!file) return;

    if (file.type !== "text/xml" && !file.name.endsWith(".xml")) {
      setImportStatus("❌ Veuillez sélectionner un fichier XML");
      return;
    }

    setIsImporting(true);
    setImportStatus("Lecture du fichier XML...");

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const xmlContent = e.target.result;
        const parsedAnimes = parseMALXML(xmlContent);

        if (parsedAnimes.length === 0) {
          setImportStatus("❌ Aucun anime completed trouvé dans le XML");
          return;
        }

        setImportStatus(`Importation de ${parsedAnimes.length} animes...`);

        if (collection && onBulkImport) {
          onBulkImport(parsedAnimes);
          setImportStatus(
            `✅ ${parsedAnimes.length} animes importés avec succès !`
          );

          // Enrichir automatiquement avec les images MAL
          enrichAnimesWithImages(parsedAnimes);
        }
      } catch (error) {
        console.error("Erreur d'import XML:", error);
        setImportStatus(`❌ ${error.message}`);
      } finally {
        setIsImporting(false);
        setTimeout(() => setImportStatus(""), 5000);
      }
    };

    reader.onerror = () => {
      setImportStatus("❌ Erreur lors de la lecture du fichier");
      setIsImporting(false);
    };

    reader.readAsText(file);
  };

  // Gestion du drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  // Enrichissement des animes avec les images MAL
  const enrichAnimesWithImages = async (animes) => {
    setImportStatus("🔄 Récupération des images depuis MyAnimeList...");
    let processed = 0;

    // Traitement par petits lots pour éviter la surcharge
    const batchSize = 5;
    const enrichedAnimes = [];

    for (let i = 0; i < animes.length; i += batchSize) {
      const batch = animes.slice(i, i + batchSize);

      const batchPromises = batch.map(async (anime, batchIndex) => {
        try {
          // Délai progressif pour respecter les limites de l'API
          await new Promise((resolve) =>
            setTimeout(resolve, batchIndex * 1500)
          );

          const animeDetails = await MALService.getAnimeDetails(anime.mal_id);

          if (animeDetails && animeDetails.images?.jpg?.image_url) {
            const enrichedAnime = {
              ...anime,
              image: animeDetails.images.jpg.image_url,
              year: animeDetails.aired?.prop?.from?.year || anime.year,
              genres: animeDetails.genres?.map((g) => g.name) || [],
              synopsis: animeDetails.synopsis || null,
            };

            console.log(`✅ Image récupérée pour: ${anime.title}`);

            // Émettre la mise à jour pour sauvegarder l'image en base
            if (emitAnimeUpdate) {
              emitAnimeUpdate(enrichedAnime);
            }

            return enrichedAnime;
          } else {
            console.log(`⚠️ Pas d'image trouvée pour: ${anime.title}`);
            return anime; // Retourne l'anime original si pas d'image
          }
        } catch (error) {
          console.error(`❌ Erreur image pour ${anime.title}:`, error);
          return anime; // Retourne l'anime original en cas d'erreur
        }
      });

      const batchResults = await Promise.all(batchPromises);
      enrichedAnimes.push(...batchResults);
      processed += batch.length;

      setImportStatus(`🔄 Images: ${processed}/${animes.length} traitées`);
    }

    // Ne pas re-importer, les mises à jour individuelles sont suffisantes
    // Les images seront maintenant persistées en base via emitAnimeUpdate

    setImportStatus("✅ Import terminé avec images !");
    setTimeout(() => setImportStatus(""), 3000);
  };

  return (
    <div className={styles.searchContainer}>
      {/* Barres de recherche côte à côte */}
      <div className={styles.searchBars}>
        <div className={styles.searchSection}>
          <h3>🔍 Rechercher un anime</h3>
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="Tapez le nom d'un anime..."
              value={searchTerm}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              ref={searchInputRef}
              className={styles.searchInput}
            />
          </div>
          
          {/* Notification d'ajout d'anime */}
          {addNotification && (
            <div
              className={`${styles.addNotification} ${
                addNotification.type === "warning" ? styles.warning : styles.success
              }`}
            >
              <div className={styles.notificationContent}>
                <div className={styles.notificationMessage}>
                  {addNotification.message}
                </div>
                {addNotification.anime.image && addNotification.anime.image !== "/placeholder-anime.svg" && (
                  <img
                    src={addNotification.anime.image}
                    alt={addNotification.anime.title}
                    className={styles.notificationImage}
                  />
                )}
              </div>
              <button
                className={styles.notificationClose}
                onClick={() => setAddNotification(null)}
                title="Fermer"
              >
                ×
              </button>
            </div>
          )}
        </div>

        <div className={styles.importSection}>
          <h3>📋 Import MyAnimeList</h3>

          <div
            className={`${styles.dropZone} ${
              isDragOver ? styles.dragOver : ""
            } ${isImporting ? styles.importing : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".xml"
              style={{ display: "none" }}
            />

            <div className={styles.dropZoneContent}>
              <div className={styles.dropZoneIcon}>📁</div>
              <div className={styles.dropZoneText}>
                <strong>Glissez un fichier XML</strong> ou cliquez pour
                parcourir
              </div>
              <div className={styles.dropZoneInstructions}>
                <a
                  href="https://myanimelist.net/panel.php?go=export"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  Exporter depuis MAL
                </a>
              </div>
            </div>
          </div>

          {importStatus && (
            <div
              className={`${styles.status} ${
                importStatus.includes("❌") ? styles.error : styles.success
              }`}
            >
              {importStatus}
            </div>
          )}
        </div>
      </div>

      {/* Résultats de recherche */}
      {searchResults.length > 0 && (
        <div className={styles.results}>
          <div className={styles.resultsList}>
            {searchResults.map((anime, index) => (
              <div
                key={anime.mal_id}
                className={`${styles.resultItem} ${
                  index === selectedIndex ? styles.selected : ""
                }`}
                onClick={() => handleAddAnime(anime)}
              >
                <img
                  src={
                    anime.images?.jpg?.small_image_url ||
                    "/placeholder-anime.svg"
                  }
                  alt={anime.title}
                  className={styles.resultImage}
                />
                <div className={styles.resultInfo}>
                  <h4>{anime.title}</h4>
                  {anime.year && (
                    <span className={styles.year}>({anime.year})</span>
                  )}
                  <div className={styles.metadata}>
                    {anime.type && (
                      <span className={styles.type}>{anime.type}</span>
                    )}
                    {anime.episodes && (
                      <span className={styles.episodes}>
                        {anime.episodes} ép.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
