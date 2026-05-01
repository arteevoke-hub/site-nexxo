const fs = require('fs');
const data = JSON.parse(fs.readFileSync('skus_atualizados_supabase.json'));
const values = data.map(d => {
    const shopeeStr = d.sku_shopee ? `'${String(d.sku_shopee).replace('.0', '')}'` : 'NULL';
    const mlStr = d.sku_mercadolivre ? `'${d.sku_mercadolivre}'` : 'NULL';
    const urlStr = d.anuncio_url ? `'${d.anuncio_url}'` : 'NULL';
    return `(${d.id_produto_tiny}, '${d.sku_tiny}', ${mlStr}, ${shopeeStr}, ${urlStr})`;
}).join(',\n');
const sql = `TRUNCATE TABLE public.skus_marketplace;\nINSERT INTO public.skus_marketplace (id_produto_tiny, sku_tiny, sku_mercadolivre, sku_shopee, anuncio_url) VALUES \n${values};`;
fs.writeFileSync('import.sql', sql);
console.log('import.sql created successfully!');
