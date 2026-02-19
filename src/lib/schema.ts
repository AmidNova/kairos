import pool from "./db";

const createTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      url TEXT NOT NULL,
      name VARCHAR(255),
      image TEXT,
      current_price DECIMAL,
      in_stock BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES products(id),
      price DECIMAL NOT NULL,
      in_stock BOOLEAN,
      checked_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      product_id INTEGER REFERENCES products(id),
      target_price DECIMAL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("Tables créées avec succès");
  await pool.end();
};

createTables().catch(console.error);
