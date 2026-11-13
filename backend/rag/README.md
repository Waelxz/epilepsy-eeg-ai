# Medical RAG Knowledge Base

Place clinical epilepsy PDF references (guidelines, papers, EEG interpretation manuals) inside this folder (`backend/rag/`).

On first query, `RAGService` (`backend/app/utils/rag_service.py`) automatically:
1. Loads all `.pdf` files in `backend/rag/` using `PyPDFLoader`
2. Splits documents into overlapping chunks (`chunk_size=1000`, `chunk_overlap=200`)
3. Embeds chunks with `all-MiniLM-L6-v2` (`HuggingFaceEmbeddings`)
4. Builds and caches a local FAISS vector index in `backend/rag/faiss_index/`

*(PDFs and generated FAISS pickle files are gitignored so copyrighted literature and serialized indexes are never committed.)*
