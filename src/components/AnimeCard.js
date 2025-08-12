import styles from "./AnimeCard.module.css";

export default function AnimeCard({
  anime,
  onDragStart,
  onDragEnd,
  onDelete,
  tier = null,
  isPreview = false,
}) {
  const handleDragStart = (e) => {
    if (isPreview) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", anime.id);
    e.dataTransfer.effectAllowed = "move";
    if (onDragStart) onDragStart(anime);
  };

  const handleDragEnd = (e) => {
    if (onDragEnd) onDragEnd(anime);
  };

  const handleDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) onDelete(anime);
  };

  return (
    <div
      className={`${styles.card} ${tier ? styles[`tier-${tier}`] : ""} ${
        isPreview ? styles.preview : ""
      }`}
      draggable={!isPreview}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      title={anime.title}
    >
      <div className={styles.imageContainer}>
        <img
          src={anime.image || "/placeholder-anime.svg"}
          alt={anime.title}
          className={styles.image}
          loading="lazy"
        />
        {!isPreview && onDelete && (
          <button
            className={styles.deleteButton}
            onClick={handleDelete}
            title="Supprimer cet anime"
            type="button"
          >
            ×
          </button>
        )}
      </div>

      <div className={styles.overlay}>
        <div className={styles.title}>{anime.title}</div>
        {anime.year && <div className={styles.year}>({anime.year})</div>}
      </div>
    </div>
  );
}
