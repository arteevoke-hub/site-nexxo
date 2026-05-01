import fs from 'fs';
import path from 'path';

const csvPath = 'c:\\Users\\lrosa_mff8ud9\\Downloads\\skus_atualizados_supabase.csv';
const content = fs.readFileSync(csvPath, 'utf-8');
const lines = content.split('\n').filter(l => l.trim() !== '');
const header = lines[0].split(',');
const data = lines.slice(1).map(line => {
    const values = line.split(',');
    return {
        id_tiny: values[0],
        sku_tiny: values[1],
        sku_ml: values[2],
        sku_shopee: values[3],
        url: values[4]
    };
});

let sql = 'INSERT INTO skus_marketplace (id_produto_tiny, sku_tiny, sku_mercadolivre, sku_shopee, anuncio_url) VALUES \n';
const valueLines = data.map(row => {
    const ml = row.sku_ml ? `'${row.sku_ml}'` : 'NULL';
    const shopee = row.sku_shopee ? `'${row.sku_shopee}'` : 'NULL';
    const url = row.url ? `'${row.url}'` : 'NULL';
    return `(${row.id_tiny}, '${row.sku_tiny}', ${ml}, ${shopee}, ${url})`;
});

sql += valueLines.join(',\n') + '\n';
sql += 'ON CONFLICT (id_produto_tiny) DO UPDATE SET \n';
sql += 'sku_tiny = EXCLUDED.sku_tiny, \n';
sql += 'sku_mercadolivre = EXCLUDED.sku_mercadolivre, \n';
sql += 'sku_shopee = EXCLUDED.sku_shopee, \n';
sql += 'anuncio_url = EXCLUDED.anuncio_url;';

fs.writeFileSync('import_skus.sql', sql);
console.log('SQL generated in import_skus.sql');
