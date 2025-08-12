import { useState, useCallback, useEffect } from "react";
import AnimeCard from "./AnimeCard";
import styles from "./TierList.module.css";

const DEFAULT_TIERS = [
  { id: "S", name: "S - Légendaire", color: "#ff6b6b" },
  { id: "A", name: "A - Excellent", color: "#4ecdc4" },
  { id: "B", name: "B - Très bon", color: "#45b7d1" },
  { id: "C", name: "C - Bon", color: "#96ceb4" },
  { id: "D", name: "D - Moyen", color: "#feca57" },
  { id: "F", name: "F - Mauvais", color: "#ff9ff3" },
];

const TIER_COLORS = [
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#96ceb4",
  "#feca57",
  "#ff9ff3",
  "#a8e6cf",
  "#ffd93d",
  "#6c5ce7",
  "#fd79a8",
  "#e17055",
  "#74b9ff",
];

export default function TierList({
  animes = [],
  onTierChange,
  onAnimeDelete,
  customTiers = null,
  onTierAssignmentsChange,
  onTiersChange,
  onTierOrdersChange,
  tierAssignments: propTierAssignments = null,
  tierOrders: propTierOrders = null,
}) {
  const [tiers, setTiers] = useState(customTiers || DEFAULT_TIERS);
  const [tierAssignments, setTierAssignments] = useState(
    propTierAssignments || new Map()
  );
  const [tierOrders, setTierOrders] = useState(propTierOrders || new Map());
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverPosition, setDragOverPosition] = useState(null);
  const [editingTier, setEditingTier] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Synchronise avec les props collaboratives
  useEffect(() => {
    if (propTierAssignments) {
      setTierAssignments(propTierAssignments);
    }
  }, [propTierAssignments]);

  useEffect(() => {
    if (propTierOrders) {
      setTierOrders(propTierOrders);
    }
  }, [propTierOrders]);

  useEffect(() => {
    if (customTiers) {
      setTiers(customTiers);
    }
  }, [customTiers]);

  // Notifie les changements d'assignation
  const updateTierAssignments = (newAssignments) => {
    setTierAssignments(newAssignments);
    if (onTierAssignmentsChange) {
      onTierAssignmentsChange(newAssignments);
    }
  };

  // Notifie les changements de tiers
  const updateTiers = (newTiers) => {
    setTiers(newTiers);
    if (onTiersChange) {
      onTiersChange(newTiers);
    }
  };

  // Notifie les changements d'ordre
  const updateTierOrders = (newOrders) => {
    setTierOrders(newOrders);
    if (onTierOrdersChange) {
      onTierOrdersChange(newOrders);
    }
  };

  // Organise les animes par tier avec ordre personnalisé et espace de drop
  const organizeAnimesByTier = useCallback(() => {
    const organized = {};

    // Initialise tous les tiers
    tiers.forEach((tier) => {
      organized[tier.id] = [];
    });

    // Ajoute une section pour les animes non classés
    organized["unranked"] = [];

    // Distribue les animes
    animes.forEach((anime) => {
      const tier = tierAssignments.get(anime.id) || "unranked";
      organized[tier].push(anime);
    });

    // Applique l'ordre personnalisé pour chaque tier
    Object.keys(organized).forEach((tierId) => {
      const tierOrder = tierOrders.get(tierId);
      if (tierOrder && tierOrder.length > 0) {
        // Trie selon l'ordre personnalisé, puis ajoute les nouveaux animes à la fin
        const orderedAnimes = [];
        const remainingAnimes = [...organized[tierId]];

        // Ajoute d'abord les animes dans l'ordre défini
        tierOrder.forEach((animeId) => {
          const animeIndex = remainingAnimes.findIndex((a) => a.id === animeId);
          if (animeIndex !== -1) {
            orderedAnimes.push(remainingAnimes[animeIndex]);
            remainingAnimes.splice(animeIndex, 1);
          }
        });

        // Ajoute les animes restants (nouveaux) à la fin
        orderedAnimes.push(...remainingAnimes);
        organized[tierId] = orderedAnimes;
      }

      // Ajoute un placeholder pour l'espace de drop si nécessaire
      if (
        draggedItem &&
        dragOverPosition &&
        dragOverPosition.tierId === tierId
      ) {
        const targetIndex = organized[tierId].findIndex(
          (a) => a.id === dragOverPosition.targetAnimeId
        );
        if (targetIndex !== -1) {
          const insertIndex = dragOverPosition.insertBefore
            ? targetIndex
            : targetIndex + 1;
          // Crée un placeholder pour l'espace de drop
          const placeholder = {
            id: "__DROP_PLACEHOLDER__",
            isPlaceholder: true,
            draggedAnime: draggedItem,
          };
          organized[tierId].splice(insertIndex, 0, placeholder);
        }
      } else if (
        draggedItem &&
        dragOverPosition &&
        dragOverPosition.tierId === tierId &&
        organized[tierId].length === 0
      ) {
        // Tier vide, ajoute le placeholder
        const placeholder = {
          id: "__DROP_PLACEHOLDER__",
          isPlaceholder: true,
          draggedAnime: draggedItem,
        };
        organized[tierId] = [placeholder];
      }
    });

    return organized;
  }, [
    animes,
    tierAssignments,
    tierOrders,
    tiers,
    draggedItem,
    dragOverPosition,
  ]);

  const handleDragStart = (anime) => {
    setDraggedItem(anime);
    setDragOverPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverPosition(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // Gestion du survol pour insertion entre les animes
  const handleDragOverAnime = (e, targetAnime, tierId) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      !draggedItem ||
      draggedItem.id === targetAnime.id ||
      targetAnime.isPlaceholder
    )
      return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midPoint = rect.left + rect.width / 2;
    const insertBefore = e.clientX < midPoint;

    setDragOverPosition({
      tierId,
      targetAnimeId: targetAnime.id,
      insertBefore,
    });
  };

  // Gestion du survol sur un tier vide
  const handleDragOverEmptyTier = (e, tierId) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem) return;

    setDragOverPosition({
      tierId,
      targetAnimeId: null,
      insertBefore: true,
    });
  };

  const handleDrop = (e, tierId) => {
    e.preventDefault();
    if (!draggedItem) return;

    const newAssignments = new Map(tierAssignments);
    const currentTier = tierAssignments.get(draggedItem.id) || "unranked";

    // Assigner à un nouveau tier
    if (tierId === "unranked") {
      newAssignments.delete(draggedItem.id);
    } else {
      newAssignments.set(draggedItem.id, tierId);
    }

    // Gérer le réarrangement dans le même tier ou nouveau tier
    const newTierOrders = new Map(tierOrders);

    // Si on a une position spécifique (dragOverPosition), on l'utilise
    if (
      dragOverPosition &&
      dragOverPosition.tierId === tierId &&
      dragOverPosition.targetAnimeId
    ) {
      // Utiliser la même logique que l'affichage pour calculer les positions
      const currentOrganized = organizeAnimesWithPlaceholderAndDragRemoved();
      const tierAnimes = currentOrganized[tierId] || [];

      // Filtrer le placeholder pour avoir la vraie liste
      const realAnimes = tierAnimes.filter((a) => !a.isPlaceholder);
      const targetIndex = realAnimes.findIndex(
        (a) => a.id === dragOverPosition.targetAnimeId
      );

      if (targetIndex !== -1) {
        // Créer le nouvel ordre pour ce tier
        const newOrder = [...realAnimes.map((a) => a.id)];

        // Insérer l'anime à la nouvelle position
        const insertIndex = dragOverPosition.insertBefore
          ? targetIndex
          : targetIndex + 1;

        newOrder.splice(insertIndex, 0, draggedItem.id);
        newTierOrders.set(tierId, newOrder);
      }
    } else if (currentTier !== tierId) {
      // Si on change de tier sans position spécifique, ajouter à la fin
      const currentOrganized = organizeAnimesWithoutPlaceholder();
      const tierAnimes = currentOrganized[tierId] || [];
      // Retirer l'anime en cours de drag s'il était dans ce tier
      const filteredAnimes = tierAnimes.filter((a) => a.id !== draggedItem.id);
      const newOrder = [...filteredAnimes.map((a) => a.id), draggedItem.id];
      newTierOrders.set(tierId, newOrder);
    }

    // Nettoyer l'ordre de l'ancien tier si l'anime en sort
    if (currentTier !== tierId && currentTier !== "unranked") {
      const oldOrder = newTierOrders.get(currentTier) || [];
      const cleanedOrder = oldOrder.filter((id) => id !== draggedItem.id);
      newTierOrders.set(currentTier, cleanedOrder);
    }

    updateTierAssignments(newAssignments);
    setTierOrders(newTierOrders);

    // Notifier les changements d'ordre s'il y a un callback
    if (onTierOrdersChange) {
      onTierOrdersChange(newTierOrders);
    }

    // Calcule la position finale dans le tier avant de réinitialiser
    let finalPosition = 0;
    if (dragOverPosition && dragOverPosition.targetAnimeId) {
      const finalOrder = newTierOrders.get(tierId) || [];
      finalPosition = finalOrder.indexOf(draggedItem.id);
    } else {
      const finalOrder = newTierOrders.get(tierId) || [];
      finalPosition = Math.max(0, finalOrder.indexOf(draggedItem.id));
    }

    setDragOverPosition(null);
    setDraggedItem(null); // Réinitialiser draggedItem pour éviter que l'anime reste invisible

    // Toujours émettre l'événement collaboratif
    if (onTierChange) {
      onTierChange(draggedItem.id, tierId, finalPosition);
    }
  };

  // Fonction helper pour organiser avec retrait de l'anime en cours de drag (comme dans l'affichage)
  const organizeAnimesWithPlaceholderAndDragRemoved = () => {
    const organized = {};

    tiers.forEach((tier) => {
      organized[tier.id] = [];
    });
    organized["unranked"] = [];

    animes.forEach((anime) => {
      const tier = tierAssignments.get(anime.id) || "unranked";
      organized[tier].push(anime);
    });

    Object.keys(organized).forEach((tierId) => {
      const tierOrder = tierOrders.get(tierId);
      if (tierOrder && tierOrder.length > 0) {
        const orderedAnimes = [];
        const remainingAnimes = [...organized[tierId]];

        tierOrder.forEach((animeId) => {
          const animeIndex = remainingAnimes.findIndex((a) => a.id === animeId);
          if (animeIndex !== -1) {
            orderedAnimes.push(remainingAnimes[animeIndex]);
            remainingAnimes.splice(animeIndex, 1);
          }
        });

        orderedAnimes.push(...remainingAnimes);
        organized[tierId] = orderedAnimes;
      }

      // Retirer l'anime en cours de drag (comme dans l'affichage)
      if (draggedItem) {
        organized[tierId] = organized[tierId].filter(
          (anime) => anime.id !== draggedItem.id
        );
      }

      // Ajouter le placeholder si nécessaire (pour simuler l'affichage)
      if (
        draggedItem &&
        dragOverPosition &&
        dragOverPosition.tierId === tierId
      ) {
        const targetIndex = organized[tierId].findIndex(
          (a) => a.id === dragOverPosition.targetAnimeId
        );
        if (targetIndex !== -1) {
          const insertIndex = dragOverPosition.insertBefore
            ? targetIndex
            : targetIndex + 1;
          const placeholder = {
            id: "__DROP_PLACEHOLDER__",
            isPlaceholder: true,
            draggedAnime: draggedItem,
          };
          organized[tierId].splice(insertIndex, 0, placeholder);
        }
      } else if (
        draggedItem &&
        dragOverPosition &&
        dragOverPosition.tierId === tierId &&
        organized[tierId].length === 0
      ) {
        const placeholder = {
          id: "__DROP_PLACEHOLDER__",
          isPlaceholder: true,
          draggedAnime: draggedItem,
        };
        organized[tierId] = [placeholder];
      }
    });

    return organized;
  };

  // Fonction helper pour organiser sans placeholder (pour éviter les boucles infinies)
  const organizeAnimesWithoutPlaceholder = () => {
    const organized = {};

    tiers.forEach((tier) => {
      organized[tier.id] = [];
    });
    organized["unranked"] = [];

    animes.forEach((anime) => {
      const tier = tierAssignments.get(anime.id) || "unranked";
      organized[tier].push(anime);
    });

    Object.keys(organized).forEach((tierId) => {
      const tierOrder = tierOrders.get(tierId);
      if (tierOrder && tierOrder.length > 0) {
        const orderedAnimes = [];
        const remainingAnimes = [...organized[tierId]];

        tierOrder.forEach((animeId) => {
          const animeIndex = remainingAnimes.findIndex((a) => a.id === animeId);
          if (animeIndex !== -1) {
            orderedAnimes.push(remainingAnimes[animeIndex]);
            remainingAnimes.splice(animeIndex, 1);
          }
        });

        orderedAnimes.push(...remainingAnimes);
        organized[tierId] = orderedAnimes;
      }
    });

    return organized;
  };

  // Basculer le mode édition
  const toggleEditMode = () => {
    setEditMode(!editMode);
    setEditingTier(null); // Annule toute édition en cours
  };

  // Ajouter un nouveau tier
  const addTier = () => {
    if (!editMode) return;

    const newId = `T${Date.now()}`;
    const newTier = {
      id: newId,
      name: `Nouveau Tier`,
      color: TIER_COLORS[Math.floor(Math.random() * TIER_COLORS.length)],
    };
    const newTiers = [...tiers, newTier];
    updateTiers(newTiers);
    setEditingTier(newId);
  };

  // Supprimer un tier
  const deleteTier = (tierId) => {
    if (!editMode || tiers.length <= 1) return;

    const newTiers = tiers.filter((t) => t.id !== tierId);
    updateTiers(newTiers);

    // Déplacer les animes de ce tier vers "unranked"
    const newAssignments = new Map(tierAssignments);
    for (const [animeId, assignedTier] of newAssignments.entries()) {
      if (assignedTier === tierId) {
        newAssignments.delete(animeId);
      }
    }
    updateTierAssignments(newAssignments);

    // Nettoyer l'ordre de ce tier
    const newTierOrders = new Map(tierOrders);
    newTierOrders.delete(tierId);
    setTierOrders(newTierOrders);
  };

  // Modifier le nom d'un tier
  const updateTierName = (tierId, newName) => {
    if (!editMode) return;

    const newTiers = tiers.map((tier) =>
      tier.id === tierId ? { ...tier, name: newName } : tier
    );
    updateTiers(newTiers);
    setEditingTier(null);
  };

  // Changer la couleur d'un tier
  const updateTierColor = (tierId, newColor) => {
    if (!editMode) return;

    const newTiers = tiers.map((tier) =>
      tier.id === tierId ? { ...tier, color: newColor } : tier
    );
    updateTiers(newTiers);
  };

  const organizedAnimes = organizeAnimesByTier();
  const firstUnrankedAnime = organizedAnimes.unranked?.[0];

  return (
    <div className={styles.tierListContainer}>
      <div className={styles.tierList}>
        {/* Header avec bouton d'ajout et mode édition */}
        <div className={styles.tierHeader}>
          <h2>Tier List</h2>
          <div className={styles.headerControls}>
            <button
              onClick={toggleEditMode}
              className={`${styles.editModeButton} ${
                editMode ? styles.editModeActive : ""
              }`}
              title={
                editMode ? "Quitter le mode édition" : "Activer le mode édition"
              }
            >
              ✏️ {editMode ? "Terminer" : "Modifier"}
            </button>
            {editMode && (
              <button onClick={addTier} className={styles.addTierButton}>
                + Ajouter Tier
              </button>
            )}
          </div>
        </div>

        {/* Tiers configurables */}
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={styles.tierRow}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, tier.id)}
            data-tier={tier.id}
          >
            <div
              className={styles.tierLabel}
              style={{ backgroundColor: tier.color }}
            >
              {editingTier === tier.id && editMode ? (
                <input
                  type="text"
                  defaultValue={tier.name}
                  className={styles.tierNameInput}
                  onBlur={(e) => updateTierName(tier.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      updateTierName(tier.id, e.target.value);
                    }
                    if (e.key === "Escape") {
                      setEditingTier(null);
                    }
                  }}
                  autoFocus
                />
              ) : (
                <span
                  className={styles.tierName}
                  onClick={() => editMode && setEditingTier(tier.id)}
                  title={editMode ? "Cliquer pour modifier" : tier.name}
                  style={{ cursor: editMode ? "pointer" : "default" }}
                >
                  {tier.name}
                </span>
              )}

              <div className={styles.tierControls}>
                {editMode && (
                  <input
                    type="color"
                    value={tier.color}
                    onChange={(e) => updateTierColor(tier.id, e.target.value)}
                    className={styles.colorPicker}
                    title="Changer la couleur"
                  />
                )}
                <span className={styles.tierCount}>
                  {organizedAnimes[tier.id]?.length || 0}
                </span>
                {editMode && tiers.length > 1 && (
                  <button
                    onClick={() => deleteTier(tier.id)}
                    className={styles.deleteTierButton}
                    title="Supprimer ce tier"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div className={styles.tierContent}>
              {organizedAnimes[tier.id]?.length > 0 ? (
                organizedAnimes[tier.id].map((anime, index) => (
                  <div
                    key={anime.id}
                    className={`${styles.animeCardWrapper} ${
                      anime.isPlaceholder ? styles.placeholder : ""
                    } ${draggedItem?.id === anime.id ? styles.dragging : ""}`}
                    onDragOver={(e) =>
                      !anime.isPlaceholder &&
                      handleDragOverAnime(e, anime, tier.id)
                    }
                    onDrop={(e) => handleDrop(e, tier.id)}
                  >
                    {anime.isPlaceholder ? (
                      <div className={styles.dropPlaceholder}>
                        <AnimeCard
                          anime={anime.draggedAnime}
                          tier={tier.id}
                          isPreview={true}
                        />
                      </div>
                    ) : (
                      <AnimeCard
                        anime={anime}
                        tier={tier.id}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDelete={onAnimeDelete}
                        isDragging={draggedItem?.id === anime.id}
                      />
                    )}
                  </div>
                ))
              ) : (
                <div
                  className={`${styles.emptyTier} ${
                    !(draggedItem && dragOverPosition?.tierId === tier.id)
                      ? styles.hasPlaceholder
                      : ""
                  }`}
                  onDragOver={(e) => handleDragOverEmptyTier(e, tier.id)}
                  onDrop={(e) => handleDrop(e, tier.id)}
                >
                  {draggedItem && dragOverPosition?.tierId === tier.id ? (
                    <div className={styles.dropPlaceholder}>
                      <AnimeCard
                        anime={draggedItem}
                        tier={tier.id}
                        isPreview={true}
                      />
                    </div>
                  ) : (
                    "Glissez des animés ici"
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Section des animes non classés */}
        <div
          className={`${styles.tierRow} ${styles.unrankedRow}`}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, "unranked")}
        >
          <div className={styles.tierLabel}>
            <span className={styles.tierName}>Non classés</span>
            <span className={styles.tierCount}>
              {organizedAnimes.unranked?.length || 0}
            </span>
          </div>

          <div className={styles.tierContent}>
            {organizedAnimes.unranked?.length > 0 ? (
              organizedAnimes.unranked.map((anime, index) => (
                <div
                  key={anime.id}
                  className={`${styles.animeCardWrapper} ${
                    anime.isPlaceholder ? styles.placeholder : ""
                  } ${draggedItem?.id === anime.id ? styles.dragging : ""}`}
                  onDragOver={(e) =>
                    !anime.isPlaceholder &&
                    handleDragOverAnime(e, anime, "unranked")
                  }
                  onDrop={(e) => handleDrop(e, "unranked")}
                >
                  {anime.isPlaceholder ? (
                    <div className={styles.dropPlaceholder}>
                      <AnimeCard anime={anime.draggedAnime} isPreview={true} />
                    </div>
                  ) : (
                    <AnimeCard
                      anime={anime}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDelete={onAnimeDelete}
                      isDragging={draggedItem?.id === anime.id}
                    />
                  )}
                </div>
              ))
            ) : (
              <div
                className={`${styles.emptyTier} ${
                  !(draggedItem && dragOverPosition?.tierId === "unranked")
                    ? styles.hasPlaceholder
                    : ""
                }`}
                onDragOver={(e) => handleDragOverEmptyTier(e, "unranked")}
                onDrop={(e) => handleDrop(e, "unranked")}
              >
                {draggedItem && dragOverPosition?.tierId === "unranked" ? (
                  <div className={styles.dropPlaceholder}>
                    <AnimeCard anime={draggedItem} isPreview={true} />
                  </div>
                ) : (
                  "Tous vos animés sont classés !"
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Petit menu latéral fixe avec le premier anime non classé */}
      {firstUnrankedAnime && (
        <div
          className={`${styles.previewPanel} ${
            previewOpen ? styles.previewOpen : styles.previewClosed
          }`}
        >
          <button
            onClick={() => setPreviewOpen(!previewOpen)}
            className={styles.previewToggle}
            title={previewOpen ? "Fermer l'aperçu" : "Ouvrir l'aperçu"}
          >
            {previewOpen ? "›" : "‹"}
          </button>

          <div className={styles.previewContent}>
            <div className={styles.previewHeader}>
              <span className={styles.previewTitle}>
                {previewOpen ? "Prochain anime à classer" : ""}
              </span>
              {previewOpen && (
                <span className={styles.previewCount}>
                  {organizedAnimes.unranked?.length} restants
                </span>
              )}
            </div>

            <div className={styles.previewAnime}>
              <AnimeCard
                anime={firstUnrankedAnime}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDelete={onAnimeDelete}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
