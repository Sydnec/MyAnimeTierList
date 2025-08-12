"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

// Fonctions de persistance localStorage
const saveToLocalStorage = (state) => {
  try {
    localStorage.setItem("myanime-tierlist-state", JSON.stringify(state));
  } catch (error) {
    console.error("Erreur sauvegarde localStorage:", error);
  }
};

const loadFromLocalStorage = () => {
  try {
    const saved = localStorage.getItem("myanime-tierlist-state");
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error("Erreur chargement localStorage:", error);
  }
  return {
    animes: [],
    tierAssignments: {},
    tiers: [],
    tierOrders: {},
  };
};

export function useCollaborativeState() {
  const [mounted, setMounted] = useState(false);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState(0);
  const [collaborativeState, setCollaborativeState] = useState({
    animes: [],
    tierAssignments: {},
    tiers: [],
    tierOrders: {},
  });

  const stateRef = useRef(collaborativeState);
  const listenersRef = useRef({});

  // Charge l'état depuis localStorage au montage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const localState = loadFromLocalStorage();
      setCollaborativeState(localState);
    }
  }, []);

  // Sauvegarde automatique dans localStorage à chaque changement d'état
  useEffect(() => {
    if (mounted && typeof window !== "undefined") {
      saveToLocalStorage(collaborativeState);
    }
  }, [collaborativeState, mounted]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    stateRef.current = collaborativeState;
  }, [collaborativeState]);

  useEffect(() => {
    // Ne se connecte que côté client après montage
    if (!mounted) return;

    console.log("Tentative de connexion Socket.io...");

    // Initialise la connexion Socket.io
    const socketInstance = io({
      autoConnect: true,
      transports: ["websocket", "polling"],
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      maxReconnectionAttempts: 5,
    });

    socketInstance.on("connect", () => {
      console.log("Connecté au serveur collaboratif");
      setIsConnected(true);
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("Déconnecté du serveur collaboratif:", reason);
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (error) => {
      console.error("Erreur de connexion Socket.io:", error);
      setIsConnected(false);
    });

    // Réception de l'état initial
    socketInstance.on("initial-state", (state) => {
      console.log("État initial reçu:", state);
      setCollaborativeState({
        animes: state.animes || [],
        tierAssignments: state.tierAssignments || {},
        tiers: state.tiers || [],
        tierOrders: state.tierOrders || {},
      });
    });

    // Nombre d'utilisateurs connectés
    socketInstance.on("users-count", (count) => {
      setConnectedUsers(count);
    });

    // Anime ajouté par un autre utilisateur
    socketInstance.on("anime-added", (anime) => {
      console.log("Anime ajouté par un autre utilisateur:", anime.title);
      setCollaborativeState((prev) => ({
        ...prev,
        animes: [...prev.animes, anime],
      }));

      // Notifie les listeners
      if (listenersRef.current.onAnimeAdded) {
        listenersRef.current.onAnimeAdded(anime);
      }
    });

    // Anime déplacé par un autre utilisateur
    socketInstance.on("anime-moved", (data) => {
      console.log("Anime déplacé par un autre utilisateur:", data);
      const { animeId, tierId, position } = data;

      setCollaborativeState((prev) => {
        const newTierAssignments = { ...prev.tierAssignments };
        newTierAssignments[animeId] = tierId;

        const newTierOrders = { ...prev.tierOrders };

        // Retire l'anime de tous les autres tiers
        Object.keys(newTierOrders).forEach((tier) => {
          if (tier !== tierId) {
            const index = newTierOrders[tier]?.indexOf(animeId);
            if (index !== -1) {
              newTierOrders[tier] = [...newTierOrders[tier]];
              newTierOrders[tier].splice(index, 1);
            }
          }
        });

        // Ajoute à la position spécifiée dans le nouveau tier
        if (!newTierOrders[tierId]) {
          newTierOrders[tierId] = [];
        } else {
          newTierOrders[tierId] = [...newTierOrders[tierId]];
        }

        const currentIndex = newTierOrders[tierId].indexOf(animeId);
        if (currentIndex !== -1) {
          newTierOrders[tierId].splice(currentIndex, 1);
        }

        const insertPosition = Math.min(
          position || 0,
          newTierOrders[tierId].length
        );
        newTierOrders[tierId].splice(insertPosition, 0, animeId);

        return {
          ...prev,
          tierAssignments: newTierAssignments,
          tierOrders: newTierOrders,
        };
      });

      // Notifie les listeners
      if (listenersRef.current.onAnimeMoved) {
        listenersRef.current.onAnimeMoved(data);
      }
    });

    // Tiers mis à jour par un autre utilisateur
    socketInstance.on("tiers-updated", (tiers) => {
      console.log("Tiers mis à jour par un autre utilisateur");
      setCollaborativeState((prev) => ({
        ...prev,
        tiers,
      }));

      if (listenersRef.current.onTiersUpdated) {
        listenersRef.current.onTiersUpdated(tiers);
      }
    });

    // Import en lot par un autre utilisateur
    socketInstance.on("bulk-imported", (animes) => {
      console.log(`Import en lot reçu: ${animes.length} animes`);
      setCollaborativeState((prev) => ({
        ...prev,
        animes: [...prev.animes, ...animes],
      }));

      if (listenersRef.current.onBulkImported) {
        listenersRef.current.onBulkImported(animes);
      }
    });

    // Anime supprimé par un autre utilisateur
    socketInstance.on("anime-deleted", (animeId) => {
      console.log("Anime supprimé par un autre utilisateur:", animeId);
      setCollaborativeState((prev) => {
        const newAnimes = prev.animes.filter((anime) => anime.id !== animeId);
        const newTierAssignments = { ...prev.tierAssignments };
        delete newTierAssignments[animeId];

        const newTierOrders = { ...prev.tierOrders };
        Object.keys(newTierOrders).forEach((tierId) => {
          if (newTierOrders[tierId]) {
            newTierOrders[tierId] = newTierOrders[tierId].filter(
              (id) => id !== animeId
            );
          }
        });

        return {
          ...prev,
          animes: newAnimes,
          tierAssignments: newTierAssignments,
          tierOrders: newTierOrders,
        };
      });

      if (listenersRef.current.onAnimeDeleted) {
        listenersRef.current.onAnimeDeleted(animeId);
      }
    });

    // Anime mis à jour par un autre utilisateur (images enrichies)
    socketInstance.on("anime-updated", (updatedAnime) => {
      console.log(
        "Anime mis à jour par un autre utilisateur:",
        updatedAnime.title
      );
      setCollaborativeState((prev) => {
        const newAnimes = prev.animes.map((anime) => {
          if (
            (anime.id && updatedAnime.id && anime.id === updatedAnime.id) ||
            (anime.mal_id &&
              updatedAnime.mal_id &&
              anime.mal_id === updatedAnime.mal_id)
          ) {
            return { ...anime, ...updatedAnime };
          }
          return anime;
        });

        return {
          ...prev,
          animes: newAnimes,
        };
      });

      if (listenersRef.current.onAnimeUpdated) {
        listenersRef.current.onAnimeUpdated(updatedAnime);
      }
    });

    // Synchronisation complète
    socketInstance.on("full-sync", (state) => {
      console.log("Synchronisation complète reçue");
      setCollaborativeState({
        animes: state.animes || [],
        tierAssignments: state.tierAssignments || {},
        tiers: state.tiers || [],
        tierOrders: state.tierOrders || {},
      });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [mounted]);

  // Fonctions pour émettre des événements
  const emitAnimeAdd = (anime) => {
    if (socket) {
      socket.emit("anime-add", anime);
    }
  };

  const emitAnimeMove = (animeId, tierId, position = 0) => {
    if (socket) {
      socket.emit("anime-move", { animeId, tierId, position });
    }
  };

  const emitTiersUpdate = (tiers) => {
    if (socket) {
      socket.emit("tiers-update", tiers);
    }
  };

  const emitBulkImport = (animes) => {
    if (socket) {
      socket.emit("bulk-import", animes);
    }
  };

  const emitAnimeDelete = (animeId) => {
    console.log("🔥 Émission événement anime-delete:", animeId);
    if (socket) {
      socket.emit("anime-delete", animeId);
      console.log("✅ Événement anime-delete émis");
    } else {
      console.error("❌ Socket non connecté pour la suppression");
    }
  };

  const emitAnimeUpdate = (updatedAnime) => {
    console.log("🔄 Émission événement anime-update:", updatedAnime.title);
    if (socket) {
      socket.emit("anime-update", updatedAnime);
      console.log("✅ Événement anime-update émis");
    } else {
      console.error("❌ Socket non connecté pour la mise à jour");
    }
  };

  const requestSync = () => {
    if (socket) {
      socket.emit("request-sync");
    }
  };

  // Gestion des listeners
  const setEventListeners = (listeners) => {
    listenersRef.current = listeners;
  };

  return {
    isConnected,
    connectedUsers,
    collaborativeState,
    emitAnimeAdd,
    emitAnimeMove,
    emitAnimeDelete,
    emitAnimeUpdate,
    emitTiersUpdate,
    emitBulkImport,
    requestSync,
    setEventListeners,
  };
}
