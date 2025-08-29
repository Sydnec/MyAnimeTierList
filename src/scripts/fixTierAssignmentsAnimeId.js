const Database = require('../database/db');

async function updateTierAssignmentsAnimeId() {
    const db = new Database();
    try {
        // Récupérer tous les enregistrements de tier_assignments
        const assignments = await db.manualSelect('SELECT * FROM tier_assignments');
        let updated = 0;
        for (const assign of assignments) {
            // Chercher l'anime correspondant par title et year
            const anime = await db.manualSelect(
                'SELECT id, title, year FROM animes WHERE id = ? LIMIT 1',
                [assign.anime_id]
            );
            if (anime && anime.length === 0) {
                // Si pas trouvé, essayer de retrouver par title+year
                const allAnimes = await db.manualSelect('SELECT id, title, year FROM animes');
                const found = allAnimes.find(a => (a.title + '_' + a.year).replace(/[^a-zA-Z0-9]/g, '') === assign.anime_id);
                if (found) {
                    // Mettre à jour l'anime_id dans tier_assignments
                    await db.manualRun('UPDATE tier_assignments SET anime_id = ? WHERE anime_id = ?', [found.id, assign.anime_id]);
                    updated++;
                    console.log(`✅ Correction : ${assign.anime_id} -> ${found.id}`);
                }
            }
        }
        console.log(`\n🎉 Correction terminée : ${updated} enregistrements mis à jour.`);
    } catch (e) {
        console.error('Erreur lors de la correction :', e);
    } finally {
        db.close();
    }
}

updateTierAssignmentsAnimeId();
