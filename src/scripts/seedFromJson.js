const fs = require('fs');
const path = require('path');
const Database = require('../database/db');

async function seed() {
    const db = new Database();
    // S'assurer que les tables existent avant toute insertion
    if (typeof db.createTables === 'function') {
        db.createTables();
    }

    const dataPath = path.join(__dirname, '../../data/data.json');
    const raw = fs.readFileSync(dataPath, 'utf-8');
    const tiersData = JSON.parse(raw);

    // 1. Insérer les tiers
    const tiers = tiersData.filter(t => t.tier_id && t.tier_name).map((t, idx) => ({
        id: t.tier_id,
        name: t.tier_name.trim(),
        color: t.color,
        position: idx
    }));
    if (tiers.length > 0) {
        await db.updateTiers(tiers);
        console.log('✅ Tiers insérés');
    }

    // 2. Insérer les animes et les affectations
    for (const tier of tiersData) {
        if (!tier.animes || !Array.isArray(tier.animes) || !tier.tier_id) continue;
        for (let i = 0; i < tier.animes.length; i++) {
            const anime = tier.animes[i];
            // Générer un id unique basé sur le titre et l'année (fallback simple)
            const animeId = (anime.title + '_' + anime.year).replace(/[^a-zA-Z0-9]/g, '');
            const animeData = {
                id: animeId,
                mal_id: null,
                title: anime.title,
                title_english: null,
                title_original: null,
                image: anime.image,
                score: null,
                year: anime.year
            };
            await db.addAnime(animeData);
            await db.assignAnimeToTier(animeId, tier.tier_id, i);
        }
    }
    console.log('✅ Animes et affectations insérés');

    db.close();
    console.log('🌱 Base de données alimentée depuis data.json');
}

seed().catch((err) => {
    console.error('Erreur lors du seed:', err);
});
