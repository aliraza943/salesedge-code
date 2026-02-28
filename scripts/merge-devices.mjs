import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  const [rows] = await conn.query(
    'SELECT device_id, data_json, updated_at FROM device_data WHERE LENGTH(data_json) > 50 ORDER BY LENGTH(data_json) DESC'
  );
  
  const merged = { events: [], rfps: [], deals: [], chatMessages: [], brokers: [], salesGoal: null };
  const seenEvents = new Set();
  const seenRfps = new Set();
  const seenDeals = new Set();
  const seenBrokers = new Set();
  
  for (const row of rows) {
    const data = JSON.parse(row.data_json);
    
    if (data.salesGoal && merged.salesGoal === null) {
      merged.salesGoal = data.salesGoal;
    }
    
    for (const e of (data.events || [])) {
      if (e.id && seenEvents.has(e.id) === false) {
        seenEvents.add(e.id);
        merged.events.push(e);
      }
    }
    
    for (const r of (data.rfps || [])) {
      if (r.id && seenRfps.has(r.id) === false) {
        seenRfps.add(r.id);
        merged.rfps.push(r);
      }
    }
    
    for (const d of (data.deals || [])) {
      if (d.id && seenDeals.has(d.id) === false) {
        seenDeals.add(d.id);
        merged.deals.push(d);
      }
    }
    
    for (const b of (data.brokers || [])) {
      if (b.id && seenBrokers.has(b.id) === false) {
        seenBrokers.add(b.id);
        merged.brokers.push(b);
      }
    }
  }
  
  console.log('Merged totals:');
  console.log('  Events:', merged.events.length);
  console.log('  RFPs:', merged.rfps.length);
  console.log('  Deals:', merged.deals.length);
  console.log('  Brokers:', merged.brokers.length);
  console.log('  Sales Goal:', JSON.stringify(merged.salesGoal));
  console.log('  Event titles:', merged.events.map(e => e.title).join(', '));
  console.log('  RFP titles:', merged.rfps.map(r => r.title).join(', '));
  
  const MASTER_ID = 'master-user-001';
  const json = JSON.stringify(merged);
  
  await conn.query(
    'INSERT INTO device_data (device_id, data_json, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE data_json = VALUES(data_json), updated_at = NOW()',
    [MASTER_ID, json]
  );
  
  console.log('\nSaved merged data under device ID:', MASTER_ID);
  await conn.end();
}

main().catch(e => console.error(e));
