const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, 'src', '..', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

let url = '';
let key = '';

envFile.split('\n').forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function run() {
  try {
    // 1. Get HifiTidal Product ID
    const { data: products } = await supabase.from('products').select('id, name');
    const hifiTidalProduct = products.find(p => p.name.toLowerCase().includes('hifitidal'));
    if (!hifiTidalProduct) {
      console.log('HifiTidal product not found');
      return;
    }
    const productId = hifiTidalProduct.id;
    console.log(`Found HifiTidal Product ID: ${productId}`);

    // 2. Find all accounts for this product
    const { data: accounts } = await supabase.from('accounts').select('id').eq('product_id', productId);
    if (!accounts || accounts.length === 0) {
      console.log('No HifiTidal accounts found to delete.');
      return;
    }
    const accountIds = accounts.map(a => a.id);
    console.log(`Found ${accountIds.length} HifiTidal accounts to delete.`);

    // 3. Delete order_accounts (slots) belonging to these accounts to avoid foreign key errors
    const chunkSize = 20;
    for (let i = 0; i < accountIds.length; i += chunkSize) {
        const chunk = accountIds.slice(i, i + chunkSize);
        const { error: slotErr } = await supabase.from('order_accounts').delete().in('account_id', chunk);
        if (slotErr) console.error('Error deleting slots:', slotErr);
    }
    console.log('Deleted all associated slots.');

    // 4. Delete the accounts
    for (let i = 0; i < accountIds.length; i += chunkSize) {
        const chunk = accountIds.slice(i, i + chunkSize);
        const { error: accErr } = await supabase.from('accounts').delete().in('id', chunk);
        if (accErr) console.error('Error deleting accounts:', accErr);
    }
    console.log('Successfully initialized HifiTidal database.');

  } catch (err) {
    console.error('Fatal error:', err);
  }
}

run();
