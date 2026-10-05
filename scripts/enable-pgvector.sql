-- Production : accélération de la recherche vectorielle avec pgvector (optionnel).
-- 1. CREATE EXTENSION IF NOT EXISTS vector;
-- 2. Ajouter une colonne vector à partir de la colonne real[] existante (dimension = celle du fournisseur d'embeddings, ex. 1536 OpenAI, 768 Gemini, 512 local) :
--    ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS vec vector(1536);
--    UPDATE embeddings SET vec = vector::vector WHERE dims = 1536;
--    CREATE INDEX IF NOT EXISTS embeddings_vec_idx ON embeddings USING hnsw (vec vector_cosine_ops);
-- 3. Définir VECTOR_BACKEND=pgvector dans .env : le moteur utilisera alors l'opérateur <=> côté base (src/lib/rag/engine.ts, fonction retrieve).
CREATE EXTENSION IF NOT EXISTS vector;
