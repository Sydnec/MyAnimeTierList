"use client";

import { useState, useEffect } from "react";
import TierList from "../components/TierList";
import AnimeSearch from "../components/AnimeSearch";
import CollaborativeStatus from "../components/CollaborativeStatus";
import { AnimeCollection } from "../components/AnimeData";
import { useCollaborativeState } from "../hooks/useCollaborativeState";
import styles from "./page.module.css";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [animeCollection, setAnimeCollection] = useState(new AnimeCollection());
  const [uniqueAnimes, setUniqueAnimes] = useState([]);
  const [tierAssignments, setTierAssignments] = useState(new Map());
  const [customTiers, setCustomTiers] = useState(null);
  const [tierOrders, setTierOrders] = useState(new Map());

  // État collaboratif
  const {
    isConnected,
    connectedUsers,
    collaborativeState,
    emitAnimeAdd,
    emitAnimeMove,
    emitAnimeDelete,
    emitAnimeUpdate,
    emitTiersUpdate,
    emitBulkImport,
    setEventListeners,
  } = useCollaborativeState();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Synchronise l'état local avec l'état collaboratif
  useEffect(() => {
    if (collaborativeState.animes.length > 0) {
      const collection = new AnimeCollection();
      collaborativeState.animes.forEach((anime) => {
        collection.addAnime(anime);
      });
      setAnimeCollection(collection);
      setUniqueAnimes(collection.getAllAnimes());
    }

    if (Object.keys(collaborativeState.tierAssignments).length > 0) {
      const newAssignments = new Map();
      Object.entries(collaborativeState.tierAssignments).forEach(
        ([animeId, tierId]) => {
          newAssignments.set(parseInt(animeId), tierId);
        }
      );
      setTierAssignments(newAssignments);
    }

    if (collaborativeState.tiers.length > 0) {
      setCustomTiers(collaborativeState.tiers);
    }

    if (Object.keys(collaborativeState.tierOrders).length > 0) {
      const newOrders = new Map();
      Object.entries(collaborativeState.tierOrders).forEach(
        ([tierId, order]) => {
          newOrders.set(tierId, order);
        }
      );
      setTierOrders(newOrders);
    }
  }, [collaborativeState]);

  // Configure les listeners pour les événements collaboratifs
  useEffect(() => {
    setEventListeners({
      onAnimeAdded: (anime) => {
        console.log("Réception ajout collaboratif:", anime.title);
      },
      onAnimeMoved: (data) => {
        console.log("Réception déplacement collaboratif:", data);
      },
      onTiersUpdated: (tiers) => {
        console.log("Réception mise à jour tiers collaborative");
      },
      onBulkImported: (animes) => {
        console.log("Réception import collaboratif:", animes.length);
      },
    });
  }, [setEventListeners]);

  const handleAnimeAdd = (anime) => {
    console.log("Anime reçu pour ajout:", anime.title, "Image:", anime.image);

    // Ajoute localement d'abord
    const newCollection = new AnimeCollection();
    animeCollection.getAllAnimes().forEach((existingAnime) => {
      newCollection.addAnime(existingAnime);
    });
    const addedAnime = newCollection.addAnime(anime);

    console.log(
      "Anime après ajout:",
      addedAnime.title,
      "Image:",
      addedAnime.image
    );

    setAnimeCollection(newCollection);
    setUniqueAnimes(newCollection.getAllAnimes());

    // Émet l'événement collaboratif
    emitAnimeAdd(addedAnime);

    console.log("Anime ajouté:", anime.title);
  };

  const handleTierChange = (animeId, tierId, position = 0) => {
    console.log(
      `Anime ${animeId} moved to tier ${tierId} at position ${position}`
    );

    // Met à jour localement d'abord
    const newAssignments = new Map(tierAssignments);
    newAssignments.set(animeId, tierId);
    setTierAssignments(newAssignments);

    // Émet l'événement collaboratif
    emitAnimeMove(animeId, tierId, position);
  };

  const handleBulkImport = (importedAnimes) => {
    const newCollection = new AnimeCollection();
    animeCollection.getAllAnimes().forEach((existingAnime) => {
      newCollection.addAnime(existingAnime);
    });

    // Ajoute tous les animes importés
    const processedAnimes = [];
    importedAnimes.forEach((anime) => {
      const addedAnime = newCollection.addAnime(anime);
      processedAnimes.push(addedAnime);
    });

    setAnimeCollection(newCollection);
    setUniqueAnimes(newCollection.getAllAnimes());

    // Émet l'événement collaboratif
    emitBulkImport(processedAnimes);

    console.log(`Importé ${importedAnimes.length} animes uniques`);
  };

  const handleTierAssignmentsChange = (newAssignments) => {
    setTierAssignments(newAssignments);
  };

  const handleTiersChange = (newTiers) => {
    setCustomTiers(newTiers);
    // Émet l'événement collaboratif
    emitTiersUpdate(newTiers);
    console.log("Tiers updated:", newTiers);
  };

  const handleTierOrdersChange = (newOrders) => {
    setTierOrders(newOrders);
  };

  const handleAnimeDelete = (anime) => {
    console.log("🗑️ handleAnimeDelete appelée pour:", anime.title);
    console.log("📋 Anime object complet:", JSON.stringify(anime, null, 2));
    console.log(
      "🔑 ID utilisé pour suppression:",
      anime.id,
      "type:",
      typeof anime.id
    );

    // Cette fonction ne gère que la suppression complète (animes déjà non classés)
    // Le déclassement est maintenant géré par TierList.handleAnimeUnrank
    console.log("🗑️ Suppression complète de l'anime");
    
    // Supprime localement d'abord
    const newCollection = new AnimeCollection();
    animeCollection.getAllAnimes().forEach((existingAnime) => {
      if (existingAnime.id !== anime.id) {
        newCollection.addAnime(existingAnime);
      }
    });

    // Met à jour les affectations de tiers (au cas où)
    const newAssignments = new Map(tierAssignments);
    newAssignments.delete(anime.id);

    // Met à jour les ordres de tiers (au cas où)
    const newOrders = new Map(tierOrders);
    newOrders.forEach((order, tierId) => {
      const index = order.indexOf(anime.id);
      if (index !== -1) {
        const updatedOrder = [...order];
        updatedOrder.splice(index, 1);
        newOrders.set(tierId, updatedOrder);
      }
    });

    console.log("📊 Mise à jour de l'état local (suppression complète)...");
    setAnimeCollection(newCollection);
    setUniqueAnimes(newCollection.getAllAnimes());
    setTierAssignments(newAssignments);
    setTierOrders(newOrders);

    // Émet l'événement collaboratif
    console.log("📡 Émission de l'événement collaboratif (suppression)...");
    emitAnimeDelete(anime.id);
    console.log("✅ Suppression complète terminée");
  };

  return (
    <div className={styles.page}>
      {mounted && (
        <CollaborativeStatus
          isConnected={isConnected}
          connectedUsers={connectedUsers}
        />
      )}

      <AnimeSearch
        collection={animeCollection}
        onAnimeAdd={handleAnimeAdd}
        onBulkImport={handleBulkImport}
        emitAnimeUpdate={emitAnimeUpdate}
      />

      <TierList
        animes={uniqueAnimes}
        onTierChange={handleTierChange}
        onTierAssignmentsChange={handleTierAssignmentsChange}
        onTiersChange={handleTiersChange}
        onTierOrdersChange={handleTierOrdersChange}
        customTiers={customTiers}
        tierAssignments={tierAssignments}
        tierOrders={tierOrders}
        onAnimeDelete={handleAnimeDelete}
      />
    </div>
  );
}
