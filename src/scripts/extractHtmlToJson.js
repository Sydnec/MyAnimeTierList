const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Chemin du fichier HTML source
const htmlPath = path.join(__dirname, '../../data/data.html');
const html = fs.readFileSync(htmlPath, 'utf-8');
const $ = cheerio.load(html);

const tiers = [];

$('.TierList_tierRow__du7NV').each((_, tierRow) => {
    const tierId = $(tierRow).attr('data-tier');
    const labelDiv = $(tierRow).find('.TierList_tierLabel__VFEai');
    const colorMatch = labelDiv.attr('style')?.match(/background-color: rgb\(([^)]+)\)/);
    let color = null;
    if (colorMatch) {
        // Convertit le rgb en hex
        const rgb = colorMatch[1].split(',').map(x => parseInt(x.trim(), 10));
        color = '#' + rgb.map(x => x.toString(16).padStart(2, '0')).join('');
    }
    const tierName = labelDiv.find('.TierList_tierName__PnEJ2').text().trim();

    const animes = [];
    $(tierRow).find('.AnimeCard_card__ytnq5').each((_, card) => {
        const title = $(card).find('.AnimeCard_title__VJO92').text().trim();
        const yearText = $(card).find('.AnimeCard_year__5Kha9').text().trim();
        const year = parseInt(yearText.replace(/[()]/g, ''), 10);
        const image = $(card).find('img').attr('src');
        animes.push({ title, year, image });
    });

    tiers.push({ tier_id: tierId, tier_name: tierName, color, animes });
});

const outputPath = path.join(__dirname, '../../data/data_html.json');
fs.writeFileSync(outputPath, JSON.stringify(tiers, null, 2), 'utf-8');
console.log('✅ Extraction terminée : data_html.json généré');
