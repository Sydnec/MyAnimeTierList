const { createServer } = require("http");
const { Server } = require("socket.io");
const next = require("next");
const Database = require("./src/database/db");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.PORT || 3000;

// Prepare the Next.js app
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// Initialiser la base de données
const db = new Database();

// État collaboratif en mémoire (synchronisé avec la DB)
let collaborativeState = {
  animes: [],
  tierAssignments: {},
  tiers: [],
  tierOrders: {},
  connectedUsers: 0,
  lastModified: Date.now(),
};

// Fonction pour charger l'état depuis la base de données
async function loadStateFromDB() {
  try {
    const state = await db.getFullState();
    collaborativeState = {
      ...state,
      connectedUsers: 0,
    };
    console.log(
      `État chargé depuis la base de données: ${state.animes.length} animes, ${state.tiers.length} tiers`
    );
  } catch (error) {
    console.error(
      "Erreur lors du chargement depuis la base de données:",
      error
    );
  }
}

app.prepare().then(async () => {
  // Charger l'état depuis la base de données au démarrage
  await loadStateFromDB();
  const httpServer = createServer(handler);

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Gestion des connexions WebSocket
  io.on("connection", (socket) => {
    collaborativeState.connectedUsers++;
    console.log(
      `Utilisateur connecté: ${socket.id} (Total: ${collaborativeState.connectedUsers})`
    );

    // Envoie l'état initial au nouveau client
    socket.emit("initial-state", collaborativeState);

    // Notifie tous les clients du nombre d'utilisateurs connectés
    io.emit("users-count", collaborativeState.connectedUsers);

    // Ajout d'un anime
    socket.on("anime-add", async (animeData) => {
      console.log(
        "📥 Anime ajouté:",
        animeData.title,
        "ID:",
        animeData.id,
        "MAL_ID:",
        animeData.mal_id
      );
      console.log("📊 État avant ajout:", {
        animes: collaborativeState.animes.length,
        tierAssignments: Object.keys(collaborativeState.tierAssignments).length,
      });

      try {
        // Vérifie si l'anime existe déjà
        const existingIndex = collaborativeState.animes.findIndex((anime) => {
          // Compare d'abord par ID si les deux ont un ID défini
          if (anime.id && animeData.id && anime.id === animeData.id) {
            return true;
          }
          // Compare par mal_id si les deux ont un mal_id défini et non nul
          if (
            anime.mal_id &&
            animeData.mal_id &&
            anime.mal_id === animeData.mal_id
          ) {
            return true;
          }
          return false;
        });

        console.log("🔍 Vérification existence - Index trouvé:", existingIndex);
        if (existingIndex !== -1) {
          console.log(
            "⚠️ Anime déjà existant:",
            collaborativeState.animes[existingIndex].title
          );
        }

        if (existingIndex === -1) {
          // Assigne un ID unique si nécessaire
          if (!animeData.id) {
            animeData.id = animeData.mal_id || Date.now().toString();
            console.log("🆔 ID assigné:", animeData.id);
          }

          console.log("💾 Sauvegarde en base de données...");
          // Sauvegarde en base de données
          await db.addAnime(animeData);
          console.log("✅ Sauvegarde en base de données réussie");

          // Met à jour l'état en mémoire
          collaborativeState.animes.push(animeData);
          collaborativeState.lastModified = Date.now();

          console.log("📊 État après ajout:", {
            animes: collaborativeState.animes.length,
            tierAssignments: Object.keys(collaborativeState.tierAssignments)
              .length,
          });

          console.log(
            "📡 Émission de l'événement anime-added vers tous les clients"
          );
          // Notifie tous les clients
          io.emit("anime-added", animeData);
        } else {
          console.log("❌ Anime non ajouté car il existe déjà");
        }
      } catch (error) {
        console.error("❌ Erreur lors de l'ajout de l'anime:", error);
        socket.emit("error", { message: "Erreur lors de l'ajout de l'anime" });
      }
    });

    // Déplacement d'un anime vers un tier
    socket.on("anime-move", async (data) => {
      const { animeId, tierId, position } = data;
      console.log(
        `Anime ${animeId} déplacé vers tier ${tierId} à la position ${position}`
      );

      try {
        // Sauvegarde en base de données
        if (tierId === "unranked") {
          await db.removeAnimeFromTier(animeId);
        } else {
          await db.assignAnimeToTier(animeId, tierId, position || 0);
        }

        // Met à jour l'état en mémoire
        if (tierId === "unranked") {
          delete collaborativeState.tierAssignments[animeId];
        } else {
          collaborativeState.tierAssignments[animeId] = tierId;
        }

        // Met à jour l'ordre dans le tier
        if (!collaborativeState.tierOrders[tierId]) {
          collaborativeState.tierOrders[tierId] = [];
        }

        // Retire l'anime de tous les autres tiers
        Object.keys(collaborativeState.tierOrders).forEach((tier) => {
          if (tier !== tierId) {
            const index = collaborativeState.tierOrders[tier].indexOf(animeId);
            if (index !== -1) {
              collaborativeState.tierOrders[tier].splice(index, 1);
            }
          }
        });

        // Ajoute à la position spécifiée dans le nouveau tier
        if (tierId !== "unranked") {
          const tierOrder = collaborativeState.tierOrders[tierId];
          const currentIndex = tierOrder.indexOf(animeId);
          if (currentIndex !== -1) {
            tierOrder.splice(currentIndex, 1);
          }

          const insertPosition = Math.min(position || 0, tierOrder.length);
          tierOrder.splice(insertPosition, 0, animeId);
        }

        collaborativeState.lastModified = Date.now();

        // Notifie tous les autres clients (pas l'expéditeur)
        socket.broadcast.emit("anime-moved", data);
      } catch (error) {
        console.error("Erreur lors du déplacement de l'anime:", error);
        socket.emit("error", {
          message: "Erreur lors du déplacement de l'anime",
        });
      }
    });

    // Modification des tiers personnalisés
    socket.on("tiers-update", async (newTiers) => {
      console.log("Tiers mis à jour:", newTiers.length);

      try {
        // Sauvegarde en base de données
        await db.updateTiers(newTiers);

        // Met à jour l'état en mémoire
        collaborativeState.tiers = newTiers;
        collaborativeState.lastModified = Date.now();

        // Notifie tous les autres clients
        socket.broadcast.emit("tiers-updated", newTiers);
      } catch (error) {
        console.error("Erreur lors de la mise à jour des tiers:", error);
        socket.emit("error", {
          message: "Erreur lors de la mise à jour des tiers",
        });
      }
    });

    // Import en lot depuis MAL
    socket.on("bulk-import", async (animes) => {
      console.log(`Import en lot de ${animes.length} animes`);

      try {
        let addedCount = 0;
        const addedAnimes = [];

        for (const animeData of animes) {
          console.log(
            `🔄 Processing anime ${addedCount + 1}/${animes.length}:`,
            animeData.title
          );
          console.log("📋 Anime data:", {
            id: animeData.id,
            mal_id: animeData.mal_id,
            title: animeData.title,
          });

          const existingIndex = collaborativeState.animes.findIndex((anime) => {
            // Compare by ID if both have valid IDs (and not undefined/null)
            if (
              anime.id &&
              animeData.id &&
              anime.id !== undefined &&
              animeData.id !== undefined &&
              anime.id === animeData.id
            ) {
              return true;
            }
            // Compare by mal_id if both have valid mal_ids (not undefined/null/NaN)
            if (
              anime.mal_id &&
              animeData.mal_id &&
              anime.mal_id !== undefined &&
              animeData.mal_id !== undefined &&
              !isNaN(anime.mal_id) &&
              !isNaN(animeData.mal_id) &&
              anime.mal_id === animeData.mal_id
            ) {
              return true;
            }
            return false;
          });

          console.log("🔍 Existing index found:", existingIndex);

          if (existingIndex === -1) {
            if (!animeData.id) {
              animeData.id =
                animeData.mal_id || (Date.now() + addedCount).toString();
            }

            console.log("💾 Adding to database:", animeData.title);
            // Sauvegarde en base de données
            await db.addAnime(animeData);

            // Met à jour l'état en mémoire
            collaborativeState.animes.push(animeData);
            addedAnimes.push(animeData);
            addedCount++;
            console.log("✅ Successfully added:", animeData.title);
          } else {
            console.log("⚠️ Anime already exists:", animeData.title);
          }
        }

        if (addedCount > 0) {
          collaborativeState.lastModified = Date.now();
          console.log(
            `📡 Emitting bulk-imported event with ${addedAnimes.length} animes`
          );
          io.emit("bulk-imported", addedAnimes);
        }

        console.log(
          `✅ Bulk import completed: ${addedCount} animes added out of ${animes.length} processed`
        );
      } catch (error) {
        console.error("Erreur lors de l'import en lot:", error);
        socket.emit("error", { message: "Erreur lors de l'import en lot" });
      }
    });

    // Suppression d'un anime
    socket.on("anime-delete", async (animeId) => {
      console.log("🗑️ Suppression d'anime:", animeId);
      console.log("📊 État avant suppression:", {
        animes: collaborativeState.animes.length,
        tierAssignments: Object.keys(collaborativeState.tierAssignments).length,
      });

      try {
        // Supprime de la base de données (anime + affectations)
        console.log("💾 Suppression en base de données...");
        const result = await db.deleteAnime(animeId);
        console.log("✅ Suppression en base de données réussie:", result);

        // Si la suppression a réussi, mettre à jour l'état en mémoire
        if (result.animeChanges > 0) {
          // Trouver l'anime à supprimer dans l'état (par ID ou mal_id)
          const animeToRemove = collaborativeState.animes.find(
            (anime) => anime.id === animeId || anime.mal_id === animeId
          );

          if (animeToRemove) {
            console.log(
              "🎯 Anime trouvé dans l'état:",
              animeToRemove.title,
              "ID:",
              animeToRemove.id
            );

            // Supprime de l'état en mémoire en utilisant le bon ID
            const realId = animeToRemove.id;
            collaborativeState.animes = collaborativeState.animes.filter(
              (anime) => anime.id !== realId
            );
            delete collaborativeState.tierAssignments[realId];

            // Retire de tous les ordres de tiers
            Object.keys(collaborativeState.tierOrders).forEach((tierId) => {
              if (collaborativeState.tierOrders[tierId]) {
                const index =
                  collaborativeState.tierOrders[tierId].indexOf(realId);
                if (index !== -1) {
                  collaborativeState.tierOrders[tierId].splice(index, 1);
                  console.log(`🔄 Retiré de tier ${tierId}`);
                }
              }
            });

            collaborativeState.lastModified = Date.now();

            console.log(
              "📡 Émission de l'événement anime-deleted vers les autres clients avec ID:",
              realId
            );
            // Notifie tous les autres clients (pas l'expéditeur) avec le vrai ID
            socket.broadcast.emit("anime-deleted", realId);
          } else {
            console.log("⚠️ Anime non trouvé dans l'état en mémoire");
          }
        } else {
          console.log("⚠️ Aucun anime supprimé de la base de données");
        }

        console.log("📊 État après suppression:", {
          animes: collaborativeState.animes.length,
          tierAssignments: Object.keys(collaborativeState.tierAssignments)
            .length,
        });
      } catch (error) {
        console.error("❌ Erreur lors de la suppression de l'anime:", error);
        socket.emit("error", {
          message: "Erreur lors de la suppression de l'anime",
        });
      }
    });

    // Mise à jour d'un anime existant (pour les images enrichies)
    socket.on("anime-update", async (updatedAnime) => {
      console.log(
        "🔄 Mise à jour d'anime:",
        updatedAnime.title,
        "avec image:",
        updatedAnime.image
      );

      try {
        // Trouve l'anime existant dans l'état
        const existingIndex = collaborativeState.animes.findIndex((anime) => {
          return (
            (anime.id && updatedAnime.id && anime.id === updatedAnime.id) ||
            (anime.mal_id &&
              updatedAnime.mal_id &&
              anime.mal_id === updatedAnime.mal_id)
          );
        });

        if (existingIndex !== -1) {
          // Met à jour en base de données
          await db.addAnime(updatedAnime); // addAnime fait un INSERT OR REPLACE

          // Met à jour l'état en mémoire
          collaborativeState.animes[existingIndex] = {
            ...collaborativeState.animes[existingIndex],
            ...updatedAnime,
          };

          collaborativeState.lastModified = Date.now();

          console.log(`✅ Anime mis à jour: ${updatedAnime.title}`);

          // Notifie tous les clients de la mise à jour
          io.emit("anime-updated", updatedAnime);
        } else {
          console.log(
            `⚠️ Anime non trouvé pour mise à jour: ${updatedAnime.title}`
          );
        }
      } catch (error) {
        console.error("❌ Erreur lors de la mise à jour de l'anime:", error);
        socket.emit("error", {
          message: "Erreur lors de la mise à jour de l'anime",
        });
      }
    });

    // Synchronisation d'urgence (si un client détecte une désynchronisation)
    socket.on("request-sync", () => {
      socket.emit("full-sync", collaborativeState);
    });

    // Déconnexion
    socket.on("disconnect", () => {
      collaborativeState.connectedUsers--;
      console.log(
        `Utilisateur déconnecté: ${socket.id} (Total: ${collaborativeState.connectedUsers})`
      );

      // Notifie les clients restants
      io.emit("users-count", collaborativeState.connectedUsers);
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      db.close();
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log("> Socket.io server running for collaborative features");
    });
});

// Gestion de la fermeture propre
process.on("SIGINT", () => {
  console.log("Arrêt du serveur...");
  db.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Arrêt du serveur...");
  db.close();
  process.exit(0);
});
