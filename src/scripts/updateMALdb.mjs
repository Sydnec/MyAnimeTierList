import Database from "../database/db.js";
import { MALService } from "../utils/malService.js";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

(async () => {
  const db = new Database();

  try {
    // Récupère uniquement les animes sans mal_id
    const animes = await db.manualSelect("SELECT * FROM animes WHERE mal_id IS NULL");
    let updatedCount = 0;

    for (const anime of animes) {
      const defaultSearchTitle = anime.title || anime.title_english || anime.title_japanese;
      if (!defaultSearchTitle) {
        console.warn(`⏭️ Pas de titre pour l'anime:`, anime);
        continue;
      }
      // Demande à l'utilisateur le terme de recherche (pré-rempli avec le titre trouvé)
      // const searchTitle = await new Promise((resolve) => {
      //   rl.question(`\nTerme de recherche pour cet anime [${defaultSearchTitle}] : `, (input) => {
      //     resolve(input.trim() ? input.trim() : defaultSearchTitle);
      //   });
      // });
      // Mise en évidence du titre trouvé en BDD (en vert)
      const green = "\x1b[32m";
      const reset = "\x1b[0m";
      console.log(`\n🔎 Recherche pour: ${green}${searchTitle}${reset}`);
      const results = await MALService.searchAnime(searchTitle, 25);
      if (!results || results.length === 0) {
        console.warn(`❌ Aucun résultat pour: ${searchTitle}`);
        continue;
      }
      // Sélection automatique si correspondance exacte sur le titre, le titre japonais ou l'image
      let autoIdx = results.findIndex(
        (res) =>
          res.title === searchTitle ||
          (res.title_japanese && res.title_japanese === searchTitle) ||
          (anime.image && (
            res.images?.jpg?.image_url === anime.image ||
            res.images?.jpg?.small_image_url === anime.image ||
            res.images?.jpg?.large_image_url === anime.image ||
            res.image_url === anime.image
          ))
      );
      let idx;
      if (autoIdx !== -1) {
        idx = autoIdx;
        console.log(`🟢 Sélection automatique du résultat ${idx + 1} : ${results[idx].title}`);
      } else {
        results.forEach((res, i) => {
          console.log(`${i + 1}. ${res.title} (${res.year || res.aired?.prop?.from?.year || "?"})`);
        });
        const answer = await new Promise((resolve) => {
          rl.question("Numéro du bon anime (ou Enter pour ignorer, x pour supprimer) : ", resolve);
        });
        if (answer.trim().toLowerCase() === 'x') {
          await db.deleteAnime(anime.id);
          console.log(`🗑️ Anime supprimé de la BDD: ${searchTitle}`);
          continue;
        }
        idx = parseInt(answer) - 1;
        if (isNaN(idx) || idx < 0 || idx >= results.length) {
          console.log("⏭️ Ignoré.");
          continue;
        }
      }
      const chosen = results[idx];
      const malData = await MALService.getAnimeDetails(chosen.mal_id);
      if (!malData) {
        console.warn(`❌ Impossible de récupérer les infos MAL pour mal_id=${chosen.mal_id}`);
        continue;
      }
      // Validation auto de l'URL de l'image
      let imageUrl =
        malData.images?.jpg?.image_url ||
        malData.images?.jpg?.small_image_url ||
        malData.images?.jpg?.large_image_url ||
        malData.image_url ||
        "/placeholder-anime.svg";
      // Vérifie que l'URL est accessible (HTTP 200)
      if (imageUrl && imageUrl.startsWith("http")) {
        try {
          const res = await fetch(imageUrl, { method: "HEAD" });
          if (!res.ok) {
            console.warn(`⚠️ Image inaccessible (${res.status}): ${imageUrl}`);
            imageUrl = "/placeholder-anime.svg";
          }
        } catch (e) {
          console.warn(`⚠️ Erreur lors de la vérification de l'image: ${imageUrl}`);
          imageUrl = "/placeholder-anime.svg";
        }
      }
      const updatedAnime = {
        id: malData.mal_id,
        mal_id: malData.mal_id,
        title: malData.title_english || malData.title || malData.title_japanese,
        title_english: malData.title_english,
        title_japanese: malData.title_japanese,
        image: imageUrl,
        score: malData.score,
        year: malData.aired?.prop?.from?.year || null,
        season: malData.season || null,
        episodes: malData.episodes,
        status: malData.status,
        genres: malData.genres ? malData.genres.map((g) => g.name) : [],
      };
      // Remplace l'appel à addAnime par une requête UPDATE directe
      const updateQuery = `UPDATE animes SET
        id = ?,
        mal_id = ?,
        title = ?,
        title_english = ?,
        title_japanese = ?,
        image = ?,
        score = ?,
        year = ?,
        season = ?,
        episodes = ?,
        status = ?,
        genres = ?,
        updated_at = CURRENT_TIMESTAMP
        WHERE rowid = (SELECT rowid FROM animes WHERE id = ? LIMIT 1)`;
      const params = [
        malData.mal_id,
        malData.mal_id,
        malData.title || malData.title_english || malData.title_japanese,
        malData.title_english,
        malData.title_japanese,
        imageUrl,
        malData.score,
        malData.aired?.prop?.from?.year || null,
        malData.season || null,
        malData.episodes,
        malData.status,
        JSON.stringify(malData.genres ? malData.genres.map((g) => g.name) : []),
        anime.id // id d'origine pour cibler la bonne ligne
      ];
      await db.manualRun(updateQuery, params);
      updatedCount++;
      console.log(`✅ Anime mis à jour: ${malData.title_english || malData.title || malData.title_japanese} (mal_id=${malData.mal_id})`);
    }
    console.log(`\n🎉 Mise à jour terminée : ${updatedCount} animes mis à jour.`);
    rl.close();
  } catch (error) {
    console.error("Erreur lors de la mise à jour:", error);
    rl.close();
  } finally {
    db.close();
  }
})();
