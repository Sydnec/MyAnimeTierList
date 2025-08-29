const sqlite3 = require("sqlite3").verbose();
const path = require("path");

class Database {
  constructor() {
    this.dbPath = path.join(__dirname, "../../data/myanime-tierlist.db");
    this.db = null;
    this.initializeDatabase();
  }

  initializeDatabase() {
    // Créer le dossier data s'il n'existe pas
    const fs = require("fs");
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Connexion à la base de données
    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        console.error("Erreur lors de la connexion à SQLite:", err.message);
      } else {
        console.log("Connexion réussie à la base de données SQLite");
        this.createTables();
      }
    });
  }

  createTables() {
    // Table pour les animes
    this.db.run(
      `
      CREATE TABLE IF NOT EXISTS animes (
        id TEXT PRIMARY KEY,
        mal_id INTEGER,
        title TEXT NOT NULL,
        title_english TEXT,
        title_original TEXT,
        image TEXT,
        score REAL,
        year INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
      (err) => {
        if (err) {
          console.error("Erreur création table animes:", err);
        }
      }
    );

    // Table pour les tiers personnalisés
    this.db.run(
      `
      CREATE TABLE IF NOT EXISTS tiers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        position INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
      (err) => {
        if (err) {
          console.error("Erreur création table tiers:", err);
        } else {
          // Insérer les tiers par défaut seulement si la table est vide
          this.db.get('SELECT COUNT(*) as count FROM tiers', (err, row) => {
            if (err) {
              console.error('Erreur lors de la vérification du nombre de tiers:', err);
            } else if (row.count === 0) {
              this.initializeDefaultTiers();
            }
          });
        }
      }
    );

    // Table pour les affectations des animes aux tiers
    this.db.run(
      `
      CREATE TABLE IF NOT EXISTS tier_assignments (
        anime_id TEXT,
        tier_id TEXT,
        position INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (anime_id),
        FOREIGN KEY (anime_id) REFERENCES animes(id),
        FOREIGN KEY (tier_id) REFERENCES tiers(id)
      )
    `,
      (err) => {
        if (err) {
          console.error("Erreur création table tier_assignments:", err);
        }
      }
    );
  }

  initializeDefaultTiers() {
    const defaultTiers = [
      { id: "S", name: "S - Légendaire", color: "#ff6b6b", position: 0 },
      { id: "A", name: "A - Excellent", color: "#4ecdc4", position: 1 },
      { id: "B", name: "B - Très bon", color: "#45b7d1", position: 2 },
      { id: "C", name: "C - Bon", color: "#96ceb4", position: 3 },
      { id: "D", name: "D - Moyen", color: "#feca57", position: 4 },
    ];

    defaultTiers.forEach((tier) => {
      this.db.run(
        `INSERT OR IGNORE INTO tiers (id, name, color, position) VALUES (?, ?, ?, ?)`,
        [tier.id, tier.name, tier.color, tier.position]
      );
    });
  }

  // Méthodes pour les animes
  async addAnime(animeData) {
    console.log("🗃️ Database.addAnime appelée avec:", {
      id: animeData.id,
      mal_id: animeData.mal_id,
      title: animeData.title,
    });

    return new Promise((resolve, reject) => {
      const {
        id,
        mal_id,
        title,
        title_english,
        title_original,
        image,
        score,
        year,
      } = animeData;

      this.db.run(
        `INSERT OR REPLACE INTO animes 
         (id, mal_id, title, title_english, title_original, image, score, year, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          id,
          mal_id,
          title,
          title_english,
          title_original,
          image,
          score,
          year,
        ],
        function (err) {
          if (err) {
            console.error("🗃️ Erreur SQL dans addAnime:", err);
            reject(err);
          } else {
            console.log(
              "🗃️ Anime ajouté en base - lastID:",
              this.lastID,
              "changes:",
              this.changes
            );
            resolve({ id: this.lastID, changes: this.changes });
          }
        }
      );
    });
  }

  async getAllAnimes() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, mal_id, title, title_english, title_original, image, score, year FROM animes ORDER BY title`,
        [],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            // Parser les genres JSON
            const animes = rows.map((row) => ({
              ...row,
              genres: row.genres ? JSON.parse(row.genres) : [],
            }));
            resolve(animes);
          }
        }
      );
    });
  }

  async deleteAnime(animeId) {
    console.log(
      "🗃️ Database.deleteAnime appelée avec ID:",
      animeId,
      "type:",
      typeof animeId
    );
    return new Promise(async (resolve, reject) => {
      try {
        // D'abord, essayons de trouver l'anime par son ID string
        let animeToDelete = null;

        // Chercher par ID exact
        const exactMatch = await new Promise((res, rej) => {
          this.db.get(
            `SELECT id FROM animes WHERE id = ?`,
            [animeId],
            (err, row) => {
              if (err) rej(err);
              else res(row);
            }
          );
        });

        if (exactMatch) {
          animeToDelete = exactMatch.id;
          console.log("🎯 Anime trouvé par ID exact:", animeToDelete);
        } else {
          // Si pas trouvé par ID exact, chercher par mal_id
          console.log(
            "🔍 Anime non trouvé par ID exact, recherche par mal_id..."
          );
          const malIdMatch = await new Promise((res, rej) => {
            this.db.get(
              `SELECT id FROM animes WHERE mal_id = ?`,
              [animeId],
              (err, row) => {
                if (err) rej(err);
                else res(row);
              }
            );
          });

          if (malIdMatch) {
            animeToDelete = malIdMatch.id;
            console.log("🎯 Anime trouvé par mal_id:", animeToDelete);
          }
        }

        if (!animeToDelete) {
          console.log("❌ Anime non trouvé avec ID/mal_id:", animeId);
          resolve({ tierChanges: 0, animeChanges: 0 });
          return;
        }

        // Supprimer d'abord les affectations aux tiers
        console.log(
          "🗃️ Suppression des affectations de tiers pour:",
          animeToDelete
        );
        const tierResult = await new Promise((res, rej) => {
          this.db.run(
            `DELETE FROM tier_assignments WHERE anime_id = ?`,
            [animeToDelete],
            function (err) {
              if (err) rej(err);
              else res({ changes: this.changes });
            }
          );
        });
        console.log(
          "🗃️ Affectations supprimées:",
          tierResult.changes,
          "lignes"
        );

        // Ensuite supprimer l'anime
        console.log("🗃️ Suppression de l'anime:", animeToDelete);
        const animeResult = await new Promise((res, rej) => {
          this.db.run(
            `DELETE FROM animes WHERE id = ?`,
            [animeToDelete],
            function (err) {
              if (err) rej(err);
              else res({ changes: this.changes });
            }
          );
        });
        console.log("🗃️ Anime supprimé:", animeResult.changes, "lignes");

        resolve({
          tierChanges: tierResult.changes,
          animeChanges: animeResult.changes,
        });
      } catch (error) {
        console.error("🗃️ Erreur dans deleteAnime:", error);
        reject(error);
      }
    });
  }

  // Méthodes pour les tiers
  async getAllTiers() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM tiers ORDER BY position ASC`,
        [],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  async updateTiers(tiers) {
    return new Promise(async (resolve, reject) => {
      try {
        // Supprimer tous les tiers existants
        await new Promise((res, rej) => {
          this.db.run(`DELETE FROM tiers`, [], (err) => {
            if (err) rej(err);
            else res();
          });
        });

        // Insérer les nouveaux tiers
        for (let i = 0; i < tiers.length; i++) {
          const tier = tiers[i];
          await new Promise((res, rej) => {
            this.db.run(
              `INSERT INTO tiers (id, name, color, position) VALUES (?, ?, ?, ?)`,
              [tier.id, tier.name, tier.color, i],
              (err) => {
                if (err) rej(err);
                else res();
              }
            );
          });
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Méthodes pour les affectations
  async assignAnimeToTier(animeId, tierId, position = 0) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO tier_assignments (anime_id, tier_id, position, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [animeId, tierId, position],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  }

  async removeAnimeFromTier(animeId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM tier_assignments WHERE anime_id = ?`,
        [animeId],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  }

  async getTierAssignments() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM tier_assignments ORDER BY tier_id, position ASC`,
        [],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            // Convertir en Map pour compatibilité avec le code existant
            const assignments = {};
            const orders = {};

            rows.forEach((row) => {
              assignments[row.anime_id] = row.tier_id;

              if (!orders[row.tier_id]) {
                orders[row.tier_id] = [];
              }
              orders[row.tier_id].push(row.anime_id);
            });

            resolve({ assignments, orders });
          }
        }
      );
    });
  }

  async getFullState() {
    try {
      const t0 = Date.now();
      const animes = await this.getAllAnimes();
      const t1 = Date.now();
      const tiers = await this.getAllTiers();
      const t2 = Date.now();
      const { assignments, orders } = await this.getTierAssignments();
      const t3 = Date.now();

      console.log(`[PERF] getAllAnimes: ${t1 - t0}ms, getAllTiers: ${t2 - t1}ms, getTierAssignments: ${t3 - t2}ms`);

      return {
        animes,
        tiers,
        tierAssignments: assignments,
        tierOrders: orders,
        lastModified: Date.now(),
      };
    } catch (error) {
      console.error("Erreur lors de la récupération de l'état complet:", error);
      throw error;
    }
  }

  async updateAnime(id, setQuery) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE animes SET ${setQuery} WHERE id = ?`,
        [id],
        function (err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }

  async manualSelect(query) {
    return new Promise((resolve, reject) => {
      this.db.all(
        query,
        [],
        function (err, rows) {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async manualRun(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error(
            "Erreur lors de la fermeture de la base de données:",
            err.message
          );
        } else {
          console.log("Connexion à la base de données fermée");
        }
      });
    }
  }
}

module.exports = Database;
